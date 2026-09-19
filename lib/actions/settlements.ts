"use server";

import { SettlementError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";


export async function getSettlements() {
  await requireAdmin();
  const res = await pool.query(
    `SELECT s.id, s.period_id, s.employee_id, s.total, s.lines, s.deductions, s.net_total,
            s.is_manual, s.sealed, s.sealed_at, s.generated_at,
            e.name AS employee_name,
            pp.start_date::text AS period_start, pp.end_date::text AS period_end
     FROM settlements s
     JOIN employees e ON e.id = s.employee_id
     JOIN production_periods pp ON pp.id = s.period_id
     ORDER BY pp.start_date DESC, s.total DESC`
  );
  return res.rows;
}

/**
 * Crea una liquidación manual e independiente de la producción por destajo —
 * para colaboradores de salario fijo, bajo el concepto "Prestación de
 * servicios". Se asocia a un período existente solo para efectos de
 * organización/reporte, no depende de si ese período está abierto o cerrado.
 */
export async function createManualSettlement(params: {
  employeeId: string;
  periodId: string;
  amount: number;
  note?: string;
}) {
  const session = await requireAdmin();
  const amount = Number(params.amount);
  if (!amount || amount <= 0) {
    throw new SettlementError("El monto debe ser mayor a cero.");
  }

  return withTransaction(async (client) => {
    const empRes = await client.query(`SELECT name FROM employees WHERE id = $1`, [params.employeeId]);
    if (empRes.rowCount === 0) throw new SettlementError("Colaborador no encontrado.");

    const periodRes = await client.query(
      `SELECT id FROM production_periods WHERE id = $1`,
      [params.periodId]
    );
    if (periodRes.rowCount === 0) throw new SettlementError("Período no encontrado.");

    const dup = await client.query(
      `SELECT id FROM settlements WHERE period_id = $1 AND employee_id = $2`,
      [params.periodId, params.employeeId]
    );
    if ((dup.rowCount ?? 0) > 0) {
      throw new SettlementError(
        "Ya existe una liquidación para este colaborador en este período (por producción o manual). Elige otro período, o elimínala primero si fue un error."
      );
    }

    const line = { operationName: "Prestación de servicios", qty: 1, rate: amount, total: amount };
    const res = await client.query(
      `INSERT INTO settlements (period_id, employee_id, total, lines, deductions, net_total, is_manual, sealed)
       VALUES ($1,$2,$3,$4,'[]'::jsonb,$3,true,false) RETURNING id`,
      [params.periodId, params.employeeId, amount, JSON.stringify([line])]
    );

    await insertAudit(
      client,
      "admin",
      session.name,
      "Liquidación manual creada",
      `${empRes.rows[0].name}: Prestación de servicios por ${amount}${params.note ? ` (${params.note})` : ""}`
    );

    return { id: res.rows[0].id };
  });
}

/** Elimina una liquidación manual (solo las manuales, nunca las generadas por producción). */
export async function deleteManualSettlement(settlementId: string) {
  const session = await requireAdmin();
  return withTransaction(async (client) => {
    const res = await client.query(
      `DELETE FROM settlements WHERE id = $1 AND is_manual = true
       RETURNING (SELECT name FROM employees WHERE id = employee_id) AS employee_name, total`,
      [settlementId]
    );
    if (res.rowCount === 0) {
      throw new SettlementError("No se encontró esa liquidación manual (o no es manual).");
    }
    await insertAudit(
      client,
      "admin",
      session.name,
      "Liquidación manual eliminada",
      `${res.rows[0].employee_name}: ${res.rows[0].total}`
    );
  });
}

/** Marca la liquidación como sellada (idempotente: si ya estaba sellada, no cambia nada). */
export async function sealSettlement(settlementId: string) {
  const session = await requireAdmin();
  return withTransaction(async (client) => {
    const res = await client.query(
      `SELECT sealed, employee_id FROM settlements WHERE id = $1 FOR UPDATE`,
      [settlementId]
    );
    if (res.rowCount === 0) throw new SettlementError("Liquidación no encontrada.");
    if (res.rows[0].sealed) return { alreadySealed: true };

    await client.query(
      `UPDATE settlements SET sealed = true, sealed_at = now() WHERE id = $1`,
      [settlementId]
    );
    const emp = await client.query(`SELECT name FROM employees WHERE id = $1`, [res.rows[0].employee_id]);
    await insertAudit(client, "admin", session.name, "Liquidación sellada", emp.rows[0]?.name);
    return { alreadySealed: false };
  });
}
