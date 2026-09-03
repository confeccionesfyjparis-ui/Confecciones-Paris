import "dotenv/config";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { registerProductionCore } from "../lib/actions/production";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();

  // --- Preparar datos de prueba aislados ---
  const garmentRes = await client.query(
    `INSERT INTO garments (name) VALUES ('__TEST_CONCURRENCIA__') RETURNING id`
  );
  const garmentId = garmentRes.rows[0].id;

  const opRes = await client.query(
    `INSERT INTO operations (garment_id, name, rate) VALUES ($1,'Operacion Test', 100) RETURNING id`,
    [garmentId]
  );
  const operationId = opRes.rows[0].id;

  const CAPACITY = 100;
  const orderRes = await client.query(
    `INSERT INTO production_orders (number, garment_id, initial_qty, status)
     VALUES ('__TEST-CONCURRENCIA__', $1, $2, 'pendiente') RETURNING id`,
    [garmentId, CAPACITY]
  );
  const orderId = orderRes.rows[0].id;

  await client.query(
    `INSERT INTO order_operations (order_id, operation_id, operation_name, rate, total_qty, processed_qty)
     VALUES ($1,$2,'Operacion Test',100,$3,0)`,
    [orderId, operationId, CAPACITY]
  );

  await client.query(
    `INSERT INTO production_periods (start_date, end_date, status)
     SELECT CURRENT_DATE, CURRENT_DATE + 6, 'abierto'
     WHERE NOT EXISTS (SELECT 1 FROM production_periods WHERE status = 'abierto')`
  );

  const N_EMPLOYEES = 45;
  const employeeIds: string[] = [];
  const pinHash = await bcrypt.hash("0000", 4); // costo bajo, solo para la prueba
  for (let i = 0; i < N_EMPLOYEES; i++) {
    const res = await client.query(
      `INSERT INTO employees (name, pin_hash, active) VALUES ($1,$2,true) RETURNING id`,
      [`__TEST_EMP_${i}__`, pinHash]
    );
    employeeIds.push(res.rows[0].id);
  }
  client.release();

  console.log(
    `\nInventario disponible: ${CAPACITY} unidades. ${N_EMPLOYEES} colaboradores van a intentar registrar 5 unidades CADA UNO al mismo tiempo (total solicitado: ${
      N_EMPLOYEES * 5
    }, muy por encima de las ${CAPACITY} disponibles).\n`
  );

  // --- Disparar las 45 peticiones EXACTAMENTE al mismo tiempo ---
  const results = await Promise.allSettled(
    employeeIds.map((employeeId) =>
      registerProductionCore(employeeId, { orderId, operationId, qty: 5 })
    )
  );

  const succeeded = results.filter((r) => r.status === "fulfilled");
  const failed = results.filter((r) => r.status === "rejected");

  console.log(`Registros aceptados: ${succeeded.length}`);
  console.log(`Registros rechazados: ${failed.length}`);
  console.log(
    `Rechazos por falta de disponibilidad: ${
      failed.filter((r) => (r as any).reason?.message?.includes("no disponible")).length
    }`
  );

  // --- Verificar el estado final en la base de datos ---
  const finalRes = await pool.query(
    `SELECT total_qty, processed_qty FROM order_operations WHERE order_id = $1`,
    [orderId]
  );
  const final = finalRes.rows[0];

  const recordsRes = await pool.query(
    `SELECT COALESCE(SUM(qty),0) AS sum_qty, COUNT(*) AS n FROM production_records WHERE order_id = $1`,
    [orderId]
  );
  const sumRecorded = Number(recordsRes.rows[0].sum_qty);

  console.log(`\n--- Estado final en la base de datos ---`);
  console.log(`processed_qty: ${final.processed_qty} / total_qty: ${final.total_qty}`);
  console.log(`Suma de qty en production_records: ${sumRecorded}`);
  console.log(`Cantidad de registros insertados: ${recordsRes.rows[0].n}`);

  const neverNegative = final.processed_qty <= final.total_qty;
  const consistent = final.processed_qty === sumRecorded;
  const exactCapacity = final.processed_qty === CAPACITY; // 100/5 = exactamente 20 deberían caber

  console.log(`\n✓ Inventario nunca superó el total (${final.processed_qty} <= ${final.total_qty}): ${neverNegative}`);
  console.log(`✓ processed_qty coincide EXACTO con la suma de registros guardados: ${consistent}`);
  console.log(`✓ Se aceptaron exactamente hasta llenar la capacidad (100/5 = 20 registros): ${exactCapacity && succeeded.length === 20}`);

  const allGood = neverNegative && consistent && exactCapacity && succeeded.length === 20 && failed.length === 25;

  // --- Limpieza de los datos de prueba ---
  await pool.query(`DELETE FROM production_records WHERE order_id = $1`, [orderId]);
  await pool.query(`DELETE FROM order_operations WHERE order_id = $1`, [orderId]);
  await pool.query(`DELETE FROM production_orders WHERE id = $1`, [orderId]);
  await pool.query(`DELETE FROM operations WHERE id = $1`, [operationId]);
  await pool.query(`DELETE FROM garments WHERE id = $1`, [garmentId]);
  await pool.query(`DELETE FROM employees WHERE id = ANY($1)`, [employeeIds]);

  console.log(allGood ? "\n✅ PRUEBA DE CONCURRENCIA: APROBADA" : "\n❌ PRUEBA DE CONCURRENCIA: FALLÓ");
  await pool.end();
  process.exit(allGood ? 0 : 1);
}

main().catch(async (err) => {
  console.error("Error en la prueba:", err);
  await pool.end();
  process.exit(1);
});
