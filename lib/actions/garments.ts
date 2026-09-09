"use server";

import { GarmentError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";


export async function getGarments() {
  const garmentsRes = await pool.query(
    `SELECT id, name, sale_price, active FROM garments ORDER BY name`
  );
  const opsRes = await pool.query(
    `SELECT id, garment_id, name, rate, active FROM operations WHERE active = true ORDER BY name`
  );
  return garmentsRes.rows.map((g) => ({
    ...g,
    operations: opsRes.rows.filter((o) => o.garment_id === g.id),
  }));
}

export async function createGarment(params: {
  name: string;
  salePrice?: number | null;
  operations: { name: string; rate: number }[];
}) {
  const session = await requireAdmin();
  const name = params.name.trim();
  const cleanOps = params.operations
    .map((o) => ({ name: o.name.trim(), rate: Number(o.rate) }))
    .filter((o) => o.name && o.rate > 0);

  if (!name) throw new GarmentError("Escribe el nombre de la prenda.");
  if (cleanOps.length === 0) throw new GarmentError("Agrega al menos una operación con su tarifa.");

  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM garments WHERE lower(name) = lower($1)`,
      [name]
    );
    if ((existing.rowCount ?? 0) > 0) throw new GarmentError("Ya existe una prenda con ese nombre.");

    const garmentRes = await client.query(
      `INSERT INTO garments (name, sale_price) VALUES ($1, $2) RETURNING id`,
      [name, params.salePrice || null]
    );
    const garmentId = garmentRes.rows[0].id;

    for (const op of cleanOps) {
      await client.query(
        `INSERT INTO operations (garment_id, name, rate) VALUES ($1,$2,$3)`,
        [garmentId, op.name, op.rate]
      );
    }

    await insertAudit(
      client,
      "admin",
      session.name,
      "Prenda nueva creada",
      `${name} · ${cleanOps.length} operaciones`
    );
    return { id: garmentId, name };
  });
}

export async function addOperationToGarment(garmentId: string, name: string, rate: number) {
  const session = await requireAdmin();
  const cleanName = name.trim();
  const cleanRate = Number(rate);
  if (!cleanName || !cleanRate || cleanRate <= 0) {
    throw new GarmentError("Escribe el nombre de la operación y una tarifa válida.");
  }

  return withTransaction(async (client) => {
    const garment = await client.query(`SELECT name FROM garments WHERE id = $1`, [garmentId]);
    if (garment.rowCount === 0) throw new GarmentError("Prenda no encontrada.");

    const dup = await client.query(
      `SELECT id FROM operations WHERE garment_id = $1 AND lower(name) = lower($2)`,
      [garmentId, cleanName]
    );
    if ((dup.rowCount ?? 0) > 0) {
      throw new GarmentError("Esa prenda ya tiene una operación con ese nombre.");
    }

    await client.query(
      `INSERT INTO operations (garment_id, name, rate) VALUES ($1,$2,$3)`,
      [garmentId, cleanName, cleanRate]
    );

    await insertAudit(
      client,
      "admin",
      session.name,
      "Operación agregada",
      `${garment.rows[0].name}: ${cleanName} (${cleanRate})`
    );
  });
}

/**
 * Elimina una operación del catálogo de una prenda, SOLO si nunca se usó
 * en ninguna orden (es decir, ninguna orden se creó todavía con esa
 * operación incluida). Si ya se usó, se rechaza para no romper la
 * trazabilidad de órdenes existentes.
 */
export async function deleteOperationFromGarment(operationId: string) {
  const session = await requireAdmin();
  return withTransaction(async (client) => {
    const opRes = await client.query(
      `SELECT o.name, g.name AS garment_name FROM operations o
       JOIN garments g ON g.id = o.garment_id
       WHERE o.id = $1`,
      [operationId]
    );
    if (opRes.rowCount === 0) throw new GarmentError("Operación no encontrada.");

    const usedRes = await client.query(
      `SELECT COUNT(*) AS n FROM order_operations WHERE operation_id = $1`,
      [operationId]
    );
    if (Number(usedRes.rows[0].n) > 0) {
      throw new GarmentError(
        "Esta operación ya se usó en al menos una orden, no se puede eliminar (se perdería la trazabilidad de esa orden)."
      );
    }

    await client.query(`DELETE FROM operations WHERE id = $1`, [operationId]);
    await insertAudit(
      client,
      "admin",
      session.name,
      "Operación eliminada",
      `${opRes.rows[0].garment_name}: ${opRes.rows[0].name}`
    );
  });
}

export async function updateOperationRate(operationId: string, newRate: number) {
  const session = await requireAdmin();
  const rate = Number(newRate);
  if (!rate || rate <= 0) throw new GarmentError("La tarifa debe ser un número mayor a cero.");

  return withTransaction(async (client) => {
    const res = await client.query(
      `SELECT rate, garment_id, name FROM operations WHERE id = $1 FOR UPDATE`,
      [operationId]
    );
    if (res.rowCount === 0) throw new GarmentError("Operación no encontrada.");
    const oldRate = res.rows[0].rate;

    await client.query(`UPDATE operations SET rate = $1 WHERE id = $2`, [rate, operationId]);
    await client.query(
      `INSERT INTO operation_rate_history (operation_id, old_rate, new_rate, changed_by) VALUES ($1,$2,$3,$4)`,
      [operationId, oldRate, rate, session.name]
    );
    await insertAudit(
      client,
      "admin",
      session.name,
      "Cambio de tarifa",
      `${res.rows[0].name}: ${oldRate} -> ${rate}`
    );
  });
}

export async function updateGarmentSalePrice(garmentId: string, newPrice: number) {
  const session = await requireAdmin();
  const price = Number(newPrice);
  if (!price || price <= 0) throw new GarmentError("El precio de venta debe ser un número mayor a cero.");

  return withTransaction(async (client) => {
    const res = await client.query(
      `SELECT sale_price, name FROM garments WHERE id = $1 FOR UPDATE`,
      [garmentId]
    );
    if (res.rowCount === 0) throw new GarmentError("Prenda no encontrada.");
    const oldPrice = res.rows[0].sale_price;

    await client.query(`UPDATE garments SET sale_price = $1 WHERE id = $2`, [price, garmentId]);
    await client.query(
      `INSERT INTO garment_price_history (garment_id, old_price, new_price, changed_by) VALUES ($1,$2,$3,$4)`,
      [garmentId, oldPrice, price, session.name]
    );
    await insertAudit(
      client,
      "admin",
      session.name,
      "Precio de venta actualizado",
      `${res.rows[0].name}: ${oldPrice ?? "sin definir"} -> ${price}`
    );
  });
}
