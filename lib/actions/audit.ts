"use server";

import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function getAuditLogs() {
  await requireAdmin();
  const res = await pool.query(
    `SELECT id, actor_type, actor_name, action, detail, created_at
     FROM audit_logs ORDER BY created_at DESC LIMIT 300`
  );
  return res.rows;
}
