import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Safe column additions that run on every startup — idempotent via IF NOT EXISTS
export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
    `);
    console.log('[db] Startup migrations complete');
  } catch (err) {
    console.error('[db] Startup migrations failed:', err);
  } finally {
    client.release();
  }
}
