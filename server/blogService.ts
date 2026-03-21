import OpenAI from 'openai';
import { db } from './db';
import { blogPosts, incidentArchive, incidents, vendors } from '@shared/schema';
import { eq, desc, and, lt, gt } from 'drizzle-orm';
import type { BlogPost, InsertBlogPost } from '@shared/schema';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are a technical writer for VendorWatch, a vendor monitoring platform for MSPs (Managed Service Providers). Write a factual, professional incident report blog post. Include:
1. A clear summary of the incident
2. Timeline of events (with timestamps where available)
3. Affected services and components
4. Impact assessment for MSPs and their clients
5. What MSPs should do next time (actionable recommendations)

Tone: informative, neutral, helpful. Do not speculate. Do not add information not present in the context. Length: 400–600 words. Format the output as markdown with proper headings (## for sections). Start directly with the title as an H1 heading.`;

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

  const durationStr = durationMinutes ? formatDuration(durationMinutes) : 'Duration unknown';
  const monthYear = startedAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const affectedComponents = incidentData.affectedComponents || 'Service components';

  const prompt = `Generate a vendor incident report blog post for the following incident:

**Vendor:** ${vendorName}
**Incident Title:** ${incidentData.title}
**Severity:** ${incidentData.severity}
**Start Time:** ${startedAt.toISOString()}
**End Time:** ${resolvedAt ? resolvedAt.toISOString() : 'Ongoing'}
**Duration:** ${durationStr}
**Final Status:** ${incidentData.status}
**Affected Components:** ${affectedComponents}
**Impact Description:** ${incidentData.impact}
**Status Page:** ${incidentData.url}

Write a 400–600 word incident report blog post following the system instructions. The title should be: "${vendorName} ${incidentData.severity.charAt(0).toUpperCase() + incidentData.severity.slice(1)} Incident — ${monthYear}"`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    max_tokens: 900,
    temperature: 0.4,
  });

  const body = completion.choices[0]?.message?.content || '';

  // Extract title from first line if it starts with #
  const lines = body.split('\n');
  const titleLine = lines.find(l => l.startsWith('# '));
  const generatedTitle = titleLine
    ? titleLine.replace(/^#+\s*/, '').trim()
    : `${vendorName} Incident — ${monthYear}`;

  // Build meta description (first non-heading paragraph, truncated to 155)
  const firstPara = lines.find(l => l.trim() && !l.startsWith('#') && !l.startsWith('**'));
  const metaDescription = (firstPara || `Detailed incident report: ${archive.title} affecting ${vendorName} MSP clients.`)
    .replace(/[*_`#]/g, '')
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
  updates: Partial<Pick<BlogPost, 'status' | 'body' | 'title' | 'metaDescription' | 'publishedAt'>>
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
