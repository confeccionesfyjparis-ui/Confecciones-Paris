"use server";

import { EmployeeError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin, hashSecret } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";


function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function getEmployees() {
  await requireAdmin();
  const res = await pool.query(
    `SELECT id, name, active, created_at FROM employees ORDER BY name`
  );
  return res.rows;
}

/** Devuelve el PIN en texto plano SOLO en el momento de creación/reseteo, para que el admin lo comparta. */
export async function createEmployee(name: string, pin?: string) {
  const session = await requireAdmin();
  const cleanName = name.trim();
  if (!cleanName) throw new EmployeeError("Escribe un nombre.");
  const finalPin = (pin && pin.trim()) || randomPin();
  const pinHash = await hashSecret(finalPin);

  return withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO employees (name, pin_hash, active) VALUES ($1,$2,true) RETURNING id`,
      [cleanName, pinHash]
    );
    await insertAudit(client, "admin", session.name, "Colaborador creado", cleanName);
    return { id: res.rows[0].id, name: cleanName, pin: finalPin };
  });
}

export async function toggleEmployeeActive(employeeId: string) {
  const session = await requireAdmin();
  return withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE employees SET active = NOT active WHERE id = $1 RETURNING name, active`,
      [employeeId]
    );
    if (res.rowCount === 0) throw new EmployeeError("Colaborador no encontrado.");
    await insertAudit(
      client,
      "admin",
      session.name,
      "Cambio de estado de colaborador",
      `${res.rows[0].name}: ${res.rows[0].active ? "activo" : "inactivo"}`
    );
    return res.rows[0];
  });
}

export async function resetEmployeePin(employeeId: string, newPin?: string) {
  const session = await requireAdmin();
  const finalPin = (newPin && newPin.trim()) || randomPin();
  const pinHash = await hashSecret(finalPin);

  return withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE employees SET pin_hash = $1 WHERE id = $2 RETURNING name`,
      [pinHash, employeeId]
    );
    if (res.rowCount === 0) throw new EmployeeError("Colaborador no encontrado.");
    await insertAudit(client, "admin", session.name, "PIN de colaborador actualizado", res.rows[0].name);
    return { pin: finalPin };
  });
}
