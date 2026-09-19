"use server";

import { AppError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import { NOVEDAD_CONCEPTS, novedadSign } from "@/lib/constants";

type StoredDeduction = { id: string; concept: string; amount: number; note: string | null };

/** Recalcula deductions[] y net_total de una liquidación a partir de la tabla `deductions`. */
async function recomputeSettlement(client: any, periodId: string, employeeId: string) {
  const dedRes = await client.query(
    `SELECT id, concept, amount, note FROM deductions WHERE period_id = $1 AND employee_id = $2 ORDER BY created_at`,
    [periodId, employeeId]
  );
  const items: StoredDeduction[] = dedRes.rows.map((d: any) => ({
    id: d.id,
    concept: d.concept,
    amount: Number(d.amount),
    note: d.note,
  }));

  const settlementRes = await client.query(
    `SELECT id, total FROM settlements WHERE period_id = $1 AND employee_id = $2`,
    [periodId, employeeId]
  );
  if (settlementRes.rowCount === 0) return;
  const settlement = settlementRes.rows[0];

  const delta = items.reduce((sum, d) => sum + d.amount * novedadSign(d.concept), 0);
  const netTotal = Number(settlement.total) + delta;

  await client.query(`UPDATE settlements SET deductions = $1, net_total = $2 WHERE id = $3`, [
    JSON.stringify(items),
    netTotal,
    settlement.id,
  ]);
}

/** Agrega una novedad (deducción o pago adicional) directamente sobre una liquidación ya generada. */
export async function addNovedad(params: {
  settlementId: string;
  concept: string;
  amount: number;
  note?: string;
}) {
  const session = await requireAdmin();
  const amount = Number(params.amount);
  if (!NOVEDAD_CONCEPTS.some((c) => c.label === params.concept)) {
    throw new AppError("Concepto de novedad inválido.");
  }
  if (!amount || amount <= 0) {
    throw new AppError("El monto debe ser mayor a cero.");
  }

  return withTransaction(async (client) => {
    const settlementRes = await client.query(
      `SELECT s.period_id, s.employee_id, e.name AS employee_name
       FROM settlements s JOIN employees e ON e.id = s.employee_id
       WHERE s.id = $1 FOR UPDATE`,
      [params.settlementId]
    );
    if (settlementRes.rowCount === 0) throw new AppError("Liquidación no encontrada.");
    const { period_id, employee_id, employee_name } = settlementRes.rows[0];

    await client.query(
      `INSERT INTO deductions (period_id, employee_id, concept, amount, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [period_id, employee_id, params.concept, amount, params.note || null, session.name]
    );

    await recomputeSettlement(client, period_id, employee_id);

    await insertAudit(
      client,
      "admin",
      session.name,
      "Novedad agregada a liquidación",
      `${employee_name}: ${params.concept} por ${amount}`
    );
  });
}

export async function deleteDeduction(deductionId: string) {
  const session = await requireAdmin();
  return withTransaction(async (client) => {
    const res = await client.query(
      `DELETE FROM deductions d
       USING employees e
       WHERE d.id = $1 AND d.employee_id = e.id
       RETURNING d.concept, d.amount, e.name AS employee_name, d.period_id, d.employee_id`,
      [deductionId]
    );
    if (res.rowCount === 0) throw new AppError("Deducción no encontrada.");
    const row = res.rows[0];

    await recomputeSettlement(client, row.period_id, row.employee_id);

    await insertAudit(
      client,
      "admin",
      session.name,
      "Novedad eliminada",
      `${row.employee_name}: ${row.concept} por ${row.amount}`
    );
  });
}
