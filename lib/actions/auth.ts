"use server";

import { AuthError } from "@/lib/errors";
import { pool } from "@/lib/db";
import { createSession, destroySession, verifySecret } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";


export async function loginAdmin(username: string, password: string) {
  const res = await pool.query(
    `SELECT id, username, password_hash, active FROM users WHERE username = $1 AND role = 'admin'`,
    [username]
  );
  if (res.rowCount === 0 || !res.rows[0].active) {
    throw new AuthError("Usuario o contraseña incorrectos.");
  }
  const user = res.rows[0];
  const ok = await verifySecret(password, user.password_hash);
  if (!ok) {
    throw new AuthError("Usuario o contraseña incorrectos.");
  }
  await createSession({ sub: user.id, role: "admin", name: user.username });
  await insertAudit(pool, "admin", user.username, "Inicio de sesión");
}

export async function loginViewer(username: string, password: string) {
  const res = await pool.query(
    `SELECT id, username, password_hash, active FROM users WHERE username = $1 AND role = 'viewer'`,
    [username]
  );
  if (res.rowCount === 0 || !res.rows[0].active) {
    throw new AuthError("Usuario o contraseña incorrectos.");
  }
  const user = res.rows[0];
  const ok = await verifySecret(password, user.password_hash);
  if (!ok) {
    throw new AuthError("Usuario o contraseña incorrectos.");
  }
  await createSession({ sub: user.id, role: "viewer", name: user.username });
  await insertAudit(pool, "viewer", user.username, "Inicio de sesión");
}

export async function loginEmployee(employeeId: string, pin: string) {
  const res = await pool.query(
    `SELECT id, name, pin_hash, active FROM employees WHERE id = $1`,
    [employeeId]
  );
  if (res.rowCount === 0 || !res.rows[0].active) {
    throw new AuthError("Colaborador no encontrado o inactivo.");
  }
  const emp = res.rows[0];
  const ok = await verifySecret(pin, emp.pin_hash);
  if (!ok) {
    throw new AuthError("PIN incorrecto.");
  }
  await createSession({ sub: emp.id, role: "employee", name: emp.name });
  await insertAudit(pool, "employee", emp.name, "Inicio de sesión");
}

export async function logout() {
  await destroySession();
}

export async function listActiveEmployeesForLogin() {
  const res = await pool.query(
    `SELECT id, name FROM employees WHERE active = true ORDER BY name`
  );
  return res.rows;
}
