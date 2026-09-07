"use server";

import { ProductionError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requireEmployee } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";


/**
 * Núcleo de la lógica de registro de producción, SIN depender de la sesión
 * HTTP — recibe el employeeId ya resuelto. Se exporta así para poder
 * probarlo directamente contra PostgreSQL con concurrencia real (ver
 * scripts/concurrency-test.ts) y para que la Server Action de más abajo
 * sea solo una capa delgada de autenticación sobre esta función.
 *
 * GARANTÍA DE CONCURRENCIA:
 * El SELECT ... FOR UPDATE bloquea la fila de order_operations hasta que
 * termina la transacción. Si dos colaboradores registran al mismo tiempo
 * sobre la misma operación, el segundo espera a que el primero termine
 * (COMMIT o ROLLBACK) y entonces relee el saldo YA actualizado — por eso
 * es imposible que el inventario quede negativo, sin importar cuántas
 * peticiones lleguen exactamente al mismo tiempo.
 */
export async function registerProductionCore(
  employeeId: string,
  params: { orderId: string; operationId: string; qty: number }
) {
  const qty = Math.trunc(Number(params.qty));
  if (!qty || qty <= 0) {
    throw new ProductionError("La cantidad debe ser un número entero mayor a cero.");
  }

  return withTransaction(async (client) => {
    const empRes = await client.query(
      `SELECT id, name, active FROM employees WHERE id = $1`,
      [employeeId]
    );
    if (empRes.rowCount === 0 || !empRes.rows[0].active) {
      throw new ProductionError("Tu usuario está inactivo. Avisa al administrador.");
    }
    const employeeName = empRes.rows[0].name;

    const periodRes = await client.query(
      `SELECT id, start_date, end_date FROM production_periods WHERE status = 'abierto' LIMIT 1`
    );
    if (periodRes.rowCount === 0) {
      throw new ProductionError("No hay un período de producción abierto. Avisa al administrador.");
    }
    const period = periodRes.rows[0];

    const orderRes = await client.query(
      `SELECT id, number, status, garment_id FROM production_orders WHERE id = $1`,
      [params.orderId]
    );
    if (orderRes.rowCount === 0) {
      throw new ProductionError("La orden no existe.");
    }
    const order = orderRes.rows[0];
    if (order.status === "cerrada" || order.status === "terminada") {
      throw new ProductionError("Esta orden ya no admite más producción.");
    }

    // BLOQUEO DE FILA: aquí es donde se garantiza la concurrencia segura.
    const opRes = await client.query(
      `SELECT id, operation_name, rate, total_qty, processed_qty
       FROM order_operations
       WHERE order_id = $1 AND operation_id = $2
       FOR UPDATE`,
      [params.orderId, params.operationId]
    );
    if (opRes.rowCount === 0) {
      throw new ProductionError("Esa operación no es válida para esta orden.");
    }
    const op = opRes.rows[0];
    const available = op.total_qty - op.processed_qty;

    if (qty > available) {
      throw new ProductionError(
        `Cantidad no disponible. Solo quedan ${available} unidades disponibles para esta operación.`
      );
    }

    await client.query(
      `UPDATE order_operations SET processed_qty = processed_qty + $1 WHERE id = $2`,
      [qty, op.id]
    );

    if (order.status === "pendiente") {
      await client.query(
        `UPDATE production_orders SET status = 'en_produccion' WHERE id = $1`,
        [order.id]
      );
    }

    const total = qty * Number(op.rate);
    const recordRes = await client.query(
      `INSERT INTO production_records
        (employee_id, order_id, order_operation_id, operation_name, qty, rate, total, period_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'activo')
       RETURNING id`,
      [employeeId, order.id, op.id, op.operation_name, qty, op.rate, total, period.id]
    );

    await insertAudit(
      client,
      "employee",
      employeeName,
      "Registro de producción",
      `${order.number} · ${op.operation_name} x${qty}`
    );

    return {
      recordId: recordRes.rows[0].id,
      available: available - qty,
    };
  });
}

/** Server Action real usada por la UI: resuelve la identidad desde la sesión firmada. */
export async function registerProduction(params: {
  orderId: string;
  operationId: string;
  qty: number;
}) {
  const session = await requireEmployee();
  return registerProductionCore(session.sub, params);
}

/**
 * Permite a un colaborador corregir la CANTIDAD de un registro propio,
 * solo el mismo día en que lo hizo. Usa el mismo bloqueo de fila que el
 * registro original para que el ajuste de inventario sea igual de seguro
 * bajo concurrencia. Queda registrado en el historial de auditoría.
 */
export async function updateMyProductionQty(recordId: string, newQty: number) {
  const session = await requireEmployee();
  const qty = Math.trunc(Number(newQty));
  if (Number.isNaN(qty) || qty < 0) {
    throw new ProductionError("La cantidad debe ser un número entero de 0 o más (pon 0 si te equivocaste y quieres anular este registro).");
  }

  return withTransaction(async (client) => {
    const recordRes = await client.query(
      `SELECT id, employee_id, order_operation_id, qty, rate, status,
              registered_at::date >= (CURRENT_DATE - INTERVAL '4 days') AS is_editable
       FROM production_records
       WHERE id = $1
       FOR UPDATE`,
      [recordId]
    );
    if (recordRes.rowCount === 0) {
      throw new ProductionError("Registro no encontrado.");
    }
    const record = recordRes.rows[0];

    if (record.employee_id !== session.sub) {
      throw new ProductionError("Solo puedes editar tus propios registros.");
    }
    if (!record.is_editable) {
      throw new ProductionError("Solo puedes editar un registro dentro de los 5 días siguientes a cuando lo hiciste.");
    }
    if (record.status !== "activo") {
      throw new ProductionError("Este registro ya no se puede editar (el período fue cerrado).");
    }

    const opRes = await client.query(
      `SELECT id, operation_name, total_qty, processed_qty
       FROM order_operations WHERE id = $1 FOR UPDATE`,
      [record.order_operation_id]
    );
    const op = opRes.rows[0];
    const oldQty = record.qty;
    const maxAllowed = op.total_qty - op.processed_qty + oldQty;

    if (qty > maxAllowed) {
      throw new ProductionError(
        `Cantidad no disponible. El máximo al que puedes corregir este registro es ${maxAllowed} unidades.`
      );
    }

    const delta = qty - oldQty;
    const newTotal = qty * Number(record.rate);

    await client.query(
      `UPDATE order_operations SET processed_qty = processed_qty + $1 WHERE id = $2`,
      [delta, op.id]
    );
    await client.query(
      `UPDATE production_records SET qty = $1, total = $2 WHERE id = $3`,
      [qty, newTotal, recordId]
    );

    const empRes = await client.query(`SELECT name FROM employees WHERE id = $1`, [session.sub]);
    await insertAudit(
      client,
      "employee",
      empRes.rows[0]?.name,
      "Corrección de producción (colaborador)",
      `${op.operation_name}: ${oldQty} -> ${qty} unidades`
    );

    return { available: op.total_qty - (op.processed_qty + delta) };
  });
}

export async function getMyOpenOrders() {
  await requireEmployee();
  const res = await pool.query(
    `SELECT po.id, po.number, g.name AS garment_name
     FROM production_orders po
     JOIN garments g ON g.id = po.garment_id
     WHERE po.status IN ('pendiente','en_produccion')
     ORDER BY po.created_at DESC`
  );
  return res.rows;
}

export async function getOrderOperationsForEmployee(orderId: string) {
  await requireEmployee();
  const res = await pool.query(
    `SELECT oo.id AS order_operation_id, oo.operation_id, oo.operation_name, oo.rate,
            oo.total_qty, oo.processed_qty, (oo.total_qty - oo.processed_qty) AS available
     FROM order_operations oo
     WHERE oo.order_id = $1
     ORDER BY oo.operation_name`,
    [orderId]
  );
  return res.rows;
}

export async function getMyProductionThisPeriod() {
  const session = await requireEmployee();
  const res = await pool.query(
    `SELECT pr.id, pr.operation_name, pr.qty, pr.rate, pr.total, pr.registered_at,
            po.number AS order_number, g.name AS garment_name
     FROM production_records pr
     JOIN production_orders po ON po.id = pr.order_id
     JOIN garments g ON g.id = po.garment_id
     JOIN production_periods pp ON pp.id = pr.period_id
     WHERE pr.employee_id = $1 AND pp.status = 'abierto' AND pr.status = 'activo'
     ORDER BY pr.registered_at DESC`,
    [session.sub]
  );
  return res.rows;
}
