import { Pool, PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

// Proveedores como Supabase, Neon o Railway exigen conexión cifrada (SSL).
// En una base de datos local (localhost) no hace falta, así que solo la
// activamos cuando la conexión no es local.
const connectionString = process.env.DATABASE_URL;
const isLocal = connectionString?.includes("localhost") || connectionString?.includes("127.0.0.1");

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString,
    max: 10,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

/**
 * Ejecuta `fn` dentro de una transacción real de PostgreSQL.
 * Si `fn` lanza un error, se hace ROLLBACK automáticamente.
 * Esto es lo que garantiza que el descuento de inventario sea atómico
 * incluso si dos colaboradores registran producción al mismo tiempo.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
