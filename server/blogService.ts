import OpenAI from 'openai';
import { db } from './db';
import { blogPosts, incidentArchive, incidents, vendors } from '@shared/schema';
import { eq, desc, and, lt, gt } from 'drizzle-orm';
import type { BlogPost, InsertBlogPost } from '@shared/schema';
import { OUTAGE_BLOG_PROMPT, PROMPT_VERSION } from './prompts';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function buildSlug(vendorName: string, date: Date, shortDesc: string): string {
  const dateStr = date.toISOString().slice(0, 7).replace('-', '-'); // YYYY-MM
  const vendorSlug = slugify(vendorName);
  const descSlug = slugify(shortDesc.split(' ').slice(0, 4).join(' '));
  return `${vendorSlug}-${descSlug}-${dateStr}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h} hour${h !== 1 ? 's' : ''}`;
}

export async function generateBlogPost(incidentId: string): Promise<BlogPost> {
  // Check if already exists
  const existing = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.incidentId, incidentId))
    .limit(1);
  if (existing.length > 0) {
    return existing[0];
  }

  // Fetch incident — check archive first, fall back to active incidents table
  let incidentData: {
    vendorKey: string;
    title: string;
    severity: string;
    status: string;
    impact: string;
    url: string;
    startedAt: string;
    resolvedAt: Date | null;
    affectedComponents: string | null;
  } | null = null;

  const [archive] = await db
    .select()
    .from(incidentArchive)
    .where(eq(incidentArchive.originalId, incidentId))
    .limit(1);

  if (archive) {
    incidentData = {
      vendorKey: archive.vendorKey,
      title: archive.title,
      severity: archive.severity,
      status: archive.status,
      impact: archive.impact,
      url: archive.url,
      startedAt: archive.startedAt,
      resolvedAt: archive.resolvedAt,
      affectedComponents: archive.affectedComponents ?? null,
    };
  } else {
    // Fallback: look in active incidents table
    const [active] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    if (!active) throw new Error(`Incident ${incidentId} not found in archive or active incidents`);

    incidentData = {
      vendorKey: active.vendorKey,
      title: active.title,
      severity: active.severity,
      status: active.status,
      impact: active.impact,
      url: active.url,
      startedAt: active.startedAt,
      resolvedAt: null, // not yet archived with resolvedAt
      affectedComponents: null,
    };
  }

  // Fetch vendor info
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.key, incidentData.vendorKey))
    .limit(1);

  const vendorName = vendor?.name || incidentData.vendorKey;

  // Calculate duration in minutes
  const startedAt = new Date(incidentData.startedAt);
  const resolvedAt = incidentData.resolvedAt;
  const durationMinutes = resolvedAt
    ? Math.round((resolvedAt.getTime() - startedAt.getTime()) / 60000)
    : null;

  // Skip if less than 15 minutes
  if (durationMinutes !== null && durationMinutes < 15) {
    throw new Error(`Incident lasted only ${durationMinutes} minutes (< 15 min threshold)`);
  }

  const monthYear = startedAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const affectedComponentsList = incidentData.affectedComponents
    ? incidentData.affectedComponents.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // Structured incident data passed as JSON to the AI (matches spec format)
  const incidentPayload = {
    vendor_name: vendorName,
    affected_services: affectedComponentsList.length > 0 ? affectedComponentsList : [incidentData.title],
    severity: incidentData.severity === 'critical' ? 'P1' : incidentData.severity === 'major' ? 'P2' : 'P3',
    started_at: startedAt.toISOString(),
    resolved_at: resolvedAt ? resolvedAt.toISOString() : null,
    duration_minutes: durationMinutes,
    status_updates: [] as { timestamp: string; message: string }[], // populated below if available
    region: null,
    vendor_rca_published: false,
    impact_description: incidentData.impact,
    status_page_url: incidentData.url,
  };

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: OUTAGE_BLOG_PROMPT },
      { role: 'user', content: JSON.stringify(incidentPayload) },
    ],
    max_tokens: 1200,
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed: { headline?: string; meta_description?: string; body?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // If JSON parse fails, treat raw as body
    parsed = { body: raw };
  }

  const generatedTitle = parsed.headline?.trim() || `${vendorName} Incident — ${monthYear}`;
  const body = parsed.body?.trim() || raw;
  const metaDescription = (parsed.meta_description?.trim() || `${vendorName} experienced an outage affecting ${affectedComponentsList[0] || 'core services'} in ${monthYear}. Read the full incident report.`)
    .slice(0, 155);

  // Build unique slug
  const baseSlug = buildSlug(vendorName, startedAt, incidentData.title);
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const exists = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
    if (exists.length === 0) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const insertData: InsertBlogPost = {
    slug,
    title: generatedTitle,
    body,
    metaDescription,
    vendorKey: incidentData.vendorKey,
    vendorName,
    incidentId,
    severity: incidentData.severity,
    durationMinutes,
    affectedComponents: incidentData.affectedComponents || null,
    status: 'draft',
    promptVersion: PROMPT_VERSION,
    publishedAt: null,
  };

  const [created] = await db.insert(blogPosts).values(insertData).returning();
  return created;
}

export interface BlogListOptions {
  page?: number;
  pageSize?: number;
  vendorKey?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: 'draft' | 'published' | 'all';
}

export async function listBlogPosts(opts: BlogListOptions = {}): Promise<{ posts: BlogPost[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize || 12));
  const offset = (page - 1) * pageSize;
  const status = opts.status || 'published';

  let query = db.select().from(blogPosts);
  const countQuery = db.select().from(blogPosts);

  const conditions: any[] = [];
  if (status !== 'all') {
    conditions.push(eq(blogPosts.status, status));
  }
  if (opts.vendorKey) {
    conditions.push(eq(blogPosts.vendorKey, opts.vendorKey));
  }
  if (opts.dateFrom) {
    conditions.push(gt(blogPosts.createdAt, new Date(opts.dateFrom)));
  }
  if (opts.dateTo) {
    conditions.push(lt(blogPosts.createdAt, new Date(opts.dateTo)));
  }

  const whereClause = conditions.length > 0
    ? conditions.reduce((acc, c) => and(acc, c))
    : undefined;

  const [posts, countResult] = await Promise.all([
    db.select().from(blogPosts)
      .where(whereClause)
      .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select().from(blogPosts).where(whereClause),
  ]);

  return { posts, total: countResult.length, page, pageSize };
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const [post] = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);
  return post || null;
}

export async function updateBlogPost(
  id: string,
  updates: Partial<Pick<BlogPost, 'status' | 'body' | 'title' | 'metaDescription' | 'publishedAt' | 'confidenceScore'>>
): Promise<BlogPost> {
  const now = new Date();

  // Auto-set publishedAt when publishing
  if (updates.status === 'published' && !updates.publishedAt) {
    updates.publishedAt = now;
  }
  // Clear publishedAt when reverting to draft
  if (updates.status === 'draft') {
    updates.publishedAt = null as any;
  }

  const [updated] = await db
    .update(blogPosts)
    .set({ ...updates, updatedAt: now })
    .where(eq(blogPosts.id, id))
    .returning();

  return updated;
}

export async function getRelatedPosts(vendorKey: string, excludeId: string, limit = 3): Promise<BlogPost[]> {
  return db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.vendorKey, vendorKey), eq(blogPosts.status, 'published')))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit + 1)
    .then(posts => posts.filter(p => p.id !== excludeId).slice(0, limit));
}

export async function getDraftQueue(): Promise<BlogPost[]> {
  return db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.status, 'draft'))
    .orderBy(desc(blogPosts.createdAt));
}
