import { PoolClient } from "pg";
import { pool } from "./db";

export async function insertAudit(
  clientOrPool: PoolClient | typeof pool,
  actorType: "admin" | "employee" | "viewer" | "empaque" | "system",
  actorName: string | null,
  action: string,
  detail?: string
) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (actor_type, actor_name, action, detail) VALUES ($1,$2,$3,$4)`,
    [actorType, actorName, action, detail || null]
  );
}
