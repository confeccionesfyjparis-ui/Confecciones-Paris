"use server";

import { AppError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requirePackager, requireAdmin } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";

export async function getOrdersForPackaging() {
  await requirePackager();
  const res = await pool.query(
    `SELECT po.id, po.number, g.name AS garment_name, po.color, po.size,
            COALESCE((SELECT SUM(qty) FROM packaging_records WHERE order_id = po.id), 0) AS already_packaged
     FROM production_orders po
     JOIN garments g ON g.id = po.garment_id
     WHERE po.status != 'cerrada'
     ORDER BY po.created_at DESC`
  );
  return res.rows;
}

export async function registerPackaging(orderId: string, qty: number) {
  const session = await requirePackager();
  const cleanQty = Math.trunc(Number(qty));
  if (!cleanQty || cleanQty <= 0) {
    throw new AppError("La cantidad debe ser un número entero mayor a cero.");
  }

  return withTransaction(async (client) => {
    const orderRes = await client.query(
      `SELECT po.number, g.name AS garment_name FROM production_orders po
       JOIN garments g ON g.id = po.garment_id WHERE po.id = $1`,
      [orderId]
    );
    if (orderRes.rowCount === 0) throw new AppError("Orden no encontrada.");

    const res = await client.query(
      `INSERT INTO packaging_records (order_id, qty, registered_by) VALUES ($1,$2,$3) RETURNING id`,
      [orderId, cleanQty, session.name]
    );

    await insertAudit(
      client,
      "empaque",
      session.name,
      "Prendas empacadas",
      `${orderRes.rows[0].number} · ${orderRes.rows[0].garment_name} · ${cleanQty} unidades`
    );

    return { id: res.rows[0].id };
  });
}

export async function getMyPackagingHistory() {
  const session = await requirePackager();
  const res = await pool.query(
    `SELECT pr.id, pr.qty, pr.registered_at, po.number AS order_number, g.name AS garment_name
     FROM packaging_records pr
     JOIN production_orders po ON po.id = pr.order_id
     JOIN garments g ON g.id = po.garment_id
     WHERE pr.registered_by = $1
     ORDER BY pr.registered_at DESC
     LIMIT 100`,
    [session.name]
  );
  return res.rows;
}

/** Vista para el administrador: total empacado por orden. */
export async function getPackagingSummary() {
  await requireAdmin();
  const res = await pool.query(
    `SELECT po.id, po.number, g.name AS garment_name, po.initial_qty,
            COALESCE(SUM(pr.qty), 0) AS total_packaged
     FROM production_orders po
     JOIN garments g ON g.id = po.garment_id
     LEFT JOIN packaging_records pr ON pr.order_id = po.id
     GROUP BY po.id, po.number, g.name, po.initial_qty
     HAVING COALESCE(SUM(pr.qty), 0) > 0
     ORDER BY po.created_at DESC`
  );
  return res.rows;
}
