"use server";

import { OrderError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";


export async function createOrder(params: {
  number: string;
  garmentId: string;
  client?: string;
  color?: string;
  size?: string;
  initialQty: number;
  startDate?: string;
  dueDate?: string;
}) {
  const session = await requireAdmin();
  const number = params.number.trim();
  const qty = Math.trunc(Number(params.initialQty));

  if (!number) throw new OrderError("Escribe el número de orden.");
  if (!qty || qty <= 0) throw new OrderError("La cantidad inicial debe ser mayor a cero.");

  return withTransaction(async (client) => {
    const dup = await client.query(`SELECT id FROM production_orders WHERE number = $1`, [number]);
    if ((dup.rowCount ?? 0) > 0) throw new OrderError("Ya existe una orden con ese número.");

    const garmentRes = await client.query(`SELECT name FROM garments WHERE id = $1`, [params.garmentId]);
    if (garmentRes.rowCount === 0) throw new OrderError("Prenda no encontrada.");

    const orderRes = await client.query(
      `INSERT INTO production_orders (number, garment_id, client, color, size, initial_qty, start_date, due_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente') RETURNING id`,
      [
        number,
        params.garmentId,
        params.client || null,
        params.color || null,
        params.size || null,
        qty,
        params.startDate || null,
        params.dueDate || null,
      ]
    );
    const orderId = orderRes.rows[0].id;

    const opsRes = await client.query(
      `SELECT id, name, rate FROM operations WHERE garment_id = $1 AND active = true`,
      [params.garmentId]
    );
    if (opsRes.rowCount === 0) {
      throw new OrderError("Esta prenda no tiene operaciones configuradas todavía.");
    }

    for (const op of opsRes.rows) {
      await client.query(
        `INSERT INTO order_operations (order_id, operation_id, operation_name, rate, total_qty, processed_qty)
         VALUES ($1,$2,$3,$4,$5,0)`,
        [orderId, op.id, op.name, op.rate, qty]
      );
    }

    await insertAudit(
      client,
      "admin",
      session.name,
      "Creación de orden",
      `${number} · ${garmentRes.rows[0].name} · ${qty} u · ${opsRes.rowCount} operaciones`
    );

    return { id: orderId, number, operationsCount: opsRes.rowCount };
  });
}

export async function setOrderStatus(orderId: string, status: string) {
  const session = await requireAdmin();
  const valid = ["pendiente", "en_produccion", "terminada", "cerrada"];
  if (!valid.includes(status)) throw new OrderError("Estado inválido.");

  return withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE production_orders SET status = $1 WHERE id = $2 RETURNING number`,
      [status, orderId]
    );
    if (res.rowCount === 0) throw new OrderError("Orden no encontrada.");
    await insertAudit(client, "admin", session.name, "Cambio de estado de orden", `${res.rows[0].number} -> ${status}`);
  });
}

export async function getOrdersWithOperations() {
  await requireAdmin();
  const ordersRes = await pool.query(
    `SELECT po.id, po.number, po.client, po.color, po.size, po.initial_qty, po.status,
            po.start_date, po.due_date, g.name AS garment_name, g.id AS garment_id
     FROM production_orders po
     JOIN garments g ON g.id = po.garment_id
     ORDER BY po.created_at DESC`
  );
  const opsRes = await pool.query(
    `SELECT id, order_id, operation_name, rate, total_qty, processed_qty FROM order_operations ORDER BY operation_name`
  );
  return ordersRes.rows.map((o) => ({
    ...o,
    operations: opsRes.rows.filter((oo) => oo.order_id === o.id),
  }));
}
