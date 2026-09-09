"use server";

import { AppError } from "@/lib/errors";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin, hashSecret } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";

export async function getViewerUsers() {
  await requireAdmin();
  const res = await pool.query(
    `SELECT id, username, active, created_at FROM users WHERE role = 'viewer' ORDER BY username`
  );
  return res.rows;
}

export async function createViewerUser(username: string, password: string) {
  const session = await requireAdmin();
  const cleanUsername = username.trim();
  const cleanPassword = password.trim();
  if (!cleanUsername) throw new AppError("Escribe un nombre de usuario.");
  if (!cleanPassword || cleanPassword.length < 4) {
    throw new AppError("La contraseña debe tener al menos 4 caracteres.");
  }

  return withTransaction(async (client) => {
    const dup = await client.query(`SELECT id FROM users WHERE username = $1`, [cleanUsername]);
    if ((dup.rowCount ?? 0) > 0) throw new AppError("Ya existe un usuario con ese nombre.");

    const passwordHash = await hashSecret(cleanPassword);
    const res = await client.query(
      `INSERT INTO users (username, password_hash, role, active) VALUES ($1,$2,'viewer',true) RETURNING id`,
      [cleanUsername, passwordHash]
    );
    await insertAudit(client, "admin", session.name, "Usuario de consulta creado", cleanUsername);
    return { id: res.rows[0].id, username: cleanUsername };
  });
}

export async function toggleViewerActive(userId: string) {
  const session = await requireAdmin();
  return withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE users SET active = NOT active WHERE id = $1 AND role = 'viewer' RETURNING username, active`,
      [userId]
    );
    if (res.rowCount === 0) throw new AppError("Usuario no encontrado.");
    await insertAudit(
      client,
      "admin",
      session.name,
      "Cambio de estado de usuario de consulta",
      `${res.rows[0].username}: ${res.rows[0].active ? "activo" : "inactivo"}`
    );
    return res.rows[0];
  });
}

export async function resetViewerPassword(userId: string, newPassword: string) {
  const session = await requireAdmin();
  const cleanPassword = newPassword.trim();
  if (!cleanPassword || cleanPassword.length < 4) {
    throw new AppError("La contraseña debe tener al menos 4 caracteres.");
  }
  const passwordHash = await hashSecret(cleanPassword);

  return withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 AND role = 'viewer' RETURNING username`,
      [passwordHash, userId]
    );
    if (res.rowCount === 0) throw new AppError("Usuario no encontrado.");
    await insertAudit(client, "admin", session.name, "Contraseña de usuario de consulta actualizada", res.rows[0].username);
  });
}
