"use server";

import { AppError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import { DEDUCTION_CONCEPTS } from "@/lib/constants";

export async function getOpenPeriodDeductions() {
  await requireAdmin();
  const res = await pool.query(
    `SELECT d.id, d.employee_id, e.name AS employee_name, d.concept, d.amount, d.note, d.created_at
     FROM deductions d
     JOIN employees e ON e.id = d.employee_id
     JOIN production_periods pp ON pp.id = d.period_id
     WHERE pp.status = 'abierto'
     ORDER BY d.created_at DESC`
  );
  return res.rows;
}

export async function addDeduction(params: {
  employeeId: string;
  concept: string;
  amount: number;
  note?: string;
}) {
  const session = await requireAdmin();
  const amount = Number(params.amount);
  if (!DEDUCTION_CONCEPTS.includes(params.concept as any)) {
    throw new AppError("Concepto de deducción inválido.");
  }
  if (!amount || amount <= 0) {
    throw new AppError("El monto debe ser mayor a cero.");
  }

  return withTransaction(async (client) => {
    const periodRes = await client.query(
      `SELECT id FROM production_periods WHERE status = 'abierto' LIMIT 1`
    );
    if (periodRes.rowCount === 0) {
      throw new AppError("No hay un período abierto para registrar la deducción.");
    }
    const empRes = await client.query(`SELECT name FROM employees WHERE id = $1`, [params.employeeId]);
    if (empRes.rowCount === 0) throw new AppError("Colaborador no encontrado.");

    const res = await client.query(
      `INSERT INTO deductions (period_id, employee_id, concept, amount, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [periodRes.rows[0].id, params.employeeId, params.concept, amount, params.note || null, session.name]
    );

    await insertAudit(
      client,
      "admin",
      session.name,
      "Deducción agregada",
      `${empRes.rows[0].name}: ${params.concept} por ${amount}`
    );

    return { id: res.rows[0].id };
  });
}

export async function deleteDeduction(deductionId: string) {
  const session = await requireAdmin();
  return withTransaction(async (client) => {
    const res = await client.query(
      `DELETE FROM deductions d
       USING employees e
       WHERE d.id = $1 AND d.employee_id = e.id
       RETURNING d.concept, d.amount, e.name AS employee_name`,
      [deductionId]
    );
    if (res.rowCount === 0) throw new AppError("Deducción no encontrada.");
    await insertAudit(
      client,
      "admin",
      session.name,
      "Deducción eliminada",
      `${res.rows[0].employee_name}: ${res.rows[0].concept} por ${res.rows[0].amount}`
    );
  });
}
