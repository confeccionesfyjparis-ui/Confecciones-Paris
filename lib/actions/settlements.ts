"use server";

import { SettlementError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";


export async function getSettlements() {
  await requireAdmin();
  const res = await pool.query(
    `SELECT s.id, s.period_id, s.employee_id, s.total, s.lines, s.deductions, s.net_total,
            s.sealed, s.sealed_at, s.generated_at,
            e.name AS employee_name,
            pp.start_date::text AS period_start, pp.end_date::text AS period_end
     FROM settlements s
     JOIN employees e ON e.id = s.employee_id
     JOIN production_periods pp ON pp.id = s.period_id
     ORDER BY pp.start_date DESC, s.total DESC`
  );
  return res.rows;
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
