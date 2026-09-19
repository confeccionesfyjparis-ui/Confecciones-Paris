"use server";

import { PeriodError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import { nextAvailablePeriodRange } from "@/lib/dates";


export async function getPeriods() {
  const res = await pool.query(
    `SELECT id, start_date::text AS start_date, end_date::text AS end_date, status
     FROM production_periods ORDER BY start_date DESC`
  );
  return res.rows;
}

export async function getOpenPeriod() {
  const res = await pool.query(
    `SELECT id, start_date::text AS start_date, end_date::text AS end_date
     FROM production_periods WHERE status = 'abierto' LIMIT 1`
  );
  return res.rows[0] || null;
}

export async function openNextPeriod() {
  const session = await requireAdmin();
  return withTransaction(async (client) => {
    const openRes = await client.query(`SELECT id FROM production_periods WHERE status = 'abierto'`);
    if ((openRes.rowCount ?? 0) > 0) {
      throw new PeriodError("Ya hay un período abierto. Ciérralo antes de abrir uno nuevo.");
    }

    const existingRes = await client.query(
      `SELECT start_date::text AS start, end_date::text AS end FROM production_periods`
    );
    const { start, end } = nextAvailablePeriodRange(existingRes.rows);

    const insertRes = await client.query(
      `INSERT INTO production_periods (start_date, end_date, status) VALUES ($1,$2,'abierto') RETURNING id`,
      [start, end]
    );

    await insertAudit(client, "admin", session.name, "Período abierto", `${start} a ${end}`);
    return { id: insertRes.rows[0].id, start, end };
  });
}

/**
 * Cierra el período abierto: bloquea nuevos registros sobre él, agrupa la
 * producción por colaborador + operación + tarifa, y genera una liquidación
 * (snapshot) por cada colaborador con producción en ese corte.
 */
export async function closeOpenPeriod() {
  const session = await requireAdmin();
  return withTransaction(async (client) => {
    const periodRes = await client.query(
      `SELECT id, start_date::text as start_date, end_date::text as end_date
       FROM production_periods WHERE status = 'abierto' FOR UPDATE`
    );
    if (periodRes.rowCount === 0) throw new PeriodError("No hay ningún período abierto.");
    const period = periodRes.rows[0];

    await client.query(`UPDATE production_periods SET status = 'cerrado' WHERE id = $1`, [period.id]);

    const recordsRes = await client.query(
      `SELECT pr.employee_id, e.name AS employee_name, pr.operation_name, pr.rate, pr.qty, pr.total,
              g.name AS garment_name, po.number AS order_number
       FROM production_records pr
       JOIN employees e ON e.id = pr.employee_id
       JOIN production_orders po ON po.id = pr.order_id
       JOIN garments g ON g.id = po.garment_id
       WHERE pr.period_id = $1 AND pr.status = 'activo'`,
      [period.id]
    );

    type Line = { operationName: string; garmentName: string; orderNumber: string; rate: number; qty: number; total: number };
    const byEmployee = new Map<string, { name: string; lines: Map<string, Line>; total: number }>();

    for (const r of recordsRes.rows) {
      if (!byEmployee.has(r.employee_id)) {
        byEmployee.set(r.employee_id, { name: r.employee_name, lines: new Map(), total: 0 });
      }
      const bucket = byEmployee.get(r.employee_id)!;
      const key = `${r.order_number}__${r.garment_name}__${r.operation_name}__${r.rate}`;
      if (!bucket.lines.has(key)) {
        bucket.lines.set(key, {
          operationName: r.operation_name,
          garmentName: r.garment_name,
          orderNumber: r.order_number,
          rate: Number(r.rate),
          qty: 0,
          total: 0,
        });
      }
      const line = bucket.lines.get(key)!;
      line.qty += r.qty;
      line.total += Number(r.total);
      bucket.total += Number(r.total);
    }

    // Deducciones (novedades): ya NO se aplican aquí — ahora se agregan
    // directamente sobre la liquidación ya generada, desde la pestaña
    // Liquidaciones (ver lib/actions/deductions.ts -> addNovedad).

    let count = 0;
    for (const [employeeId, bucket] of byEmployee.entries()) {
      const lines = Array.from(bucket.lines.values());

      await client.query(
        `INSERT INTO settlements (period_id, employee_id, total, lines, deductions, net_total, sealed)
         VALUES ($1,$2,$3,$4,'[]'::jsonb,$3,false)
         ON CONFLICT (period_id, employee_id) DO NOTHING`,
        [period.id, employeeId, bucket.total, JSON.stringify(lines)]
      );
      count++;
    }

    await client.query(
      `UPDATE production_records SET status = 'liquidado' WHERE period_id = $1 AND status = 'activo'`,
      [period.id]
    );

    await insertAudit(
      client,
      "admin",
      session.name,
      "Período cerrado",
      `${period.start_date} a ${period.end_date} · ${count} liquidaciones`
    );

    return { count, periodId: period.id };
  });
}

/**
 * Reabre un período que se cerró por error: devuelve los registros de
 * producción a estado 'activo' (no cuentan como pagados) y elimina las
 * liquidaciones generadas (incluidas las ya selladas/con PDF descargado,
 * ya que se van a volver a calcular cuando el período se cierre de
 * verdad). Solo se puede reabrir si no hay ya otro período abierto.
 */
export async function reopenPeriod(periodId: string) {
  const session = await requireAdmin();
  return withTransaction(async (client) => {
    const otherOpenRes = await client.query(
      `SELECT id FROM production_periods WHERE status = 'abierto' AND id != $1`,
      [periodId]
    );
    if ((otherOpenRes.rowCount ?? 0) > 0) {
      throw new PeriodError(
        "Ya hay otro período abierto distinto a este. Ciérralo primero antes de reabrir este."
      );
    }

    const periodRes = await client.query(
      `SELECT id, start_date::text AS start_date, end_date::text AS end_date, status
       FROM production_periods WHERE id = $1 FOR UPDATE`,
      [periodId]
    );
    if (periodRes.rowCount === 0) throw new PeriodError("Período no encontrado.");
    const period = periodRes.rows[0];
    if (period.status !== "cerrado") {
      throw new PeriodError("Este período no está cerrado, no hace falta reabrirlo.");
    }

    const revertRes = await client.query(
      `UPDATE production_records SET status = 'activo' WHERE period_id = $1 AND status = 'liquidado' RETURNING id`,
      [periodId]
    );
    const deletedSettlementsRes = await client.query(
      `DELETE FROM settlements WHERE period_id = $1 RETURNING id`,
      [periodId]
    );
    await client.query(`UPDATE production_periods SET status = 'abierto' WHERE id = $1`, [periodId]);

    await insertAudit(
      client,
      "admin",
      session.name,
      "Período reabierto",
      `${period.start_date} a ${period.end_date} · ${revertRes.rowCount} registros devueltos a activo · ${deletedSettlementsRes.rowCount} liquidaciones eliminadas`
    );

    return {
      recordsReverted: revertRes.rowCount,
      settlementsDeleted: deletedSettlementsRes.rowCount,
    };
  });
}
