"use server";

import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/dates";

export async function getDashboardData() {
  await requireAdmin();
  const today = todayISO();

  const periodRes = await pool.query(
    `SELECT id, start_date::text AS start_date, end_date::text AS end_date
     FROM production_periods WHERE status = 'abierto' LIMIT 1`
  );
  const period = periodRes.rows[0] || null;

  const totalTodayRes = await pool.query(
    `SELECT COALESCE(SUM(total),0) AS total FROM production_records WHERE registered_at::date = $1`,
    [today]
  );
  const totalToday = Number(totalTodayRes.rows[0].total);

  let totalPeriod = 0;
  let unitsPeriod = 0;
  let topEmployees: { name: string; total: number }[] = [];
  let topOperations: { name: string; qty: number }[] = [];
  let revenuePeriod = 0;
  let missingPriceGarments: string[] = [];

  if (period) {
    const periodRecordsRes = await pool.query(
      `SELECT pr.employee_id, e.name AS employee_name, pr.operation_name, pr.qty, pr.total, pr.order_id
       FROM production_records pr
       JOIN employees e ON e.id = pr.employee_id
       WHERE pr.period_id = $1`,
      [period.id]
    );

    for (const r of periodRecordsRes.rows) {
      totalPeriod += Number(r.total);
      unitsPeriod += r.qty;
    }

    const byEmployee = new Map<string, number>();
    const byOperation = new Map<string, number>();
    for (const r of periodRecordsRes.rows) {
      byEmployee.set(r.employee_name, (byEmployee.get(r.employee_name) || 0) + Number(r.total));
      byOperation.set(r.operation_name, (byOperation.get(r.operation_name) || 0) + r.qty);
    }
    topEmployees = Array.from(byEmployee.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    topOperations = Array.from(byOperation.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // --- Utilidad del corte: solo cuenta prendas que terminaron TODAS sus operaciones ---
    const ordersRes = await pool.query(
      `SELECT po.id, g.name AS garment_name, g.sale_price
       FROM production_orders po
       JOIN garments g ON g.id = po.garment_id`
    );
    const opsRes = await pool.query(
      `SELECT id, order_id, processed_qty FROM order_operations`
    );
    const beforePeriodRes = await pool.query(
      `SELECT order_operation_id, COALESCE(SUM(qty),0) AS qty
       FROM production_records
       WHERE registered_at::date < $1::date
       GROUP BY order_operation_id`,
      [period.start_date]
    );
    const beforeMap = new Map<string, number>();
    for (const row of beforePeriodRes.rows) beforeMap.set(row.order_operation_id, Number(row.qty));

    const missing = new Set<string>();
    for (const order of ordersRes.rows) {
      const ops = opsRes.rows.filter((o) => o.order_id === order.id);
      if (ops.length === 0) continue;
      const minNow = Math.min(...ops.map((o) => o.processed_qty));
      const minBefore = Math.min(...ops.map((o) => beforeMap.get(o.id) || 0));
      const finishedThisPeriod = Math.max(0, minNow - minBefore);
      if (finishedThisPeriod > 0) {
        if (!order.sale_price) {
          missing.add(order.garment_name);
        } else {
          revenuePeriod += finishedThisPeriod * Number(order.sale_price);
        }
      }
    }
    missingPriceGarments = Array.from(missing);
  }

  const activeEmployeesRes = await pool.query(`SELECT COUNT(*) FROM employees WHERE active = true`);
  const activeEmployees = Number(activeEmployeesRes.rows[0].count);

  const alertsRes = await pool.query(
    `SELECT po.number, oo.operation_name, oo.total_qty, oo.processed_qty
     FROM order_operations oo
     JOIN production_orders po ON po.id = oo.order_id
     WHERE po.status != 'cerrada' AND oo.total_qty > 0
       AND (oo.processed_qty::float / oo.total_qty) >= 0.9
       AND oo.processed_qty < oo.total_qty`
  );
  const inventoryAlerts = alertsRes.rows.map(
    (a) =>
      `${a.number} · ${a.operation_name}: ${Math.round((a.processed_qty / a.total_qty) * 100)}% procesado, casi agotado`
  );

  return {
    period,
    totalToday,
    totalPeriod,
    unitsPeriod,
    activeEmployees,
    topEmployees,
    topOperations,
    inventoryAlerts,
    revenuePeriod,
    profitPeriod: revenuePeriod - totalPeriod,
    missingPriceGarments,
  };
}
