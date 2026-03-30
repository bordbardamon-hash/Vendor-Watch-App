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

    // Backfill resolved_at from updated_at for incidents that resolved during the broken window
    // (status=resolved but resolved_at never captured because the column didn't exist yet)
    const result = await client.query(`
      UPDATE incidents
      SET resolved_at = updated_at::TIMESTAMP
      WHERE status IN ('resolved', 'postmortem')
        AND resolved_at IS NULL
        AND updated_at IS NOT NULL
    `);
    if (result.rowCount && result.rowCount > 0) {
      console.log(`[db] Backfilled resolved_at for ${result.rowCount} incident(s)`);
    }

    console.log('[db] Startup migrations complete');
  } catch (err) {
    console.error('[db] Startup migrations failed:', err);
  } finally {
    client.release();
  }
}

// One-time: generate missing blog drafts for resolved critical/major incidents with no blog post.
// Safe to call on every startup — generateBlogPost is idempotent (checks existing before creating).
export async function backfillMissingBlogPosts(): Promise<void> {
  try {
    const { generateBlogPost } = await import('./blogService');
    const { incidents: incidentsTable, blogPosts } = await import('@shared/schema');
    const { eq, inArray, sql } = await import('drizzle-orm');

    // Find resolved critical/major incidents that have no blog post
    const targets = await db.execute(sql`
      SELECT i.id
      FROM incidents i
      LEFT JOIN blog_posts bp ON bp.incident_id = i.id
      WHERE i.status IN ('resolved', 'postmortem')
        AND i.severity IN ('critical', 'major')
        AND bp.id IS NULL
    `);

    const rows = targets.rows as { id: string }[];
    if (rows.length === 0) {
      return;
    }

    console.log(`[blog] Backfilling ${rows.length} missing blog draft(s)...`);
    let generated = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const post = await generateBlogPost(row.id);
        console.log(`[blog] Backfilled draft: ${post.slug}`);
        generated++;
      } catch (err: any) {
        console.log(`[blog] Skipped backfill for ${row.id}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`[blog] Backfill complete — ${generated} generated, ${skipped} skipped`);
  } catch (err) {
    console.error('[blog] Backfill failed:', err);
  }
}
