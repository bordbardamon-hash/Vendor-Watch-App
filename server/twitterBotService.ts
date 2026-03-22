/**
 * X (Twitter) Outage Bot Service
 * - OAuth 1.0a signing for X API v2
 * - Tweet composition for detected / update / resolved incidents
 * - Cron evaluation loop (called every 2 minutes from index.ts)
 */

import crypto from 'crypto';
import { db } from './db';
import {
  incidents, blockchainIncidents, vendors, blockchainChains,
  userVendorSubscriptions, tweetLog, twitterBotSettings, blogPosts,
} from '@shared/schema';
import { eq, and, ne, gte, sql, inArray, desc } from 'drizzle-orm';

// ── In-memory tweet rate limit tracker ───────────────────────────────

const recentTweetTimestamps: number[] = [];

function countTweetsInLastHour(): number {
  const cutoff = Date.now() - 60 * 60 * 1000;
  while (recentTweetTimestamps.length > 0 && recentTweetTimestamps[0] < cutoff) {
    recentTweetTimestamps.shift();
  }
  return recentTweetTimestamps.length;
}

function recordTweet() {
  recentTweetTimestamps.push(Date.now());
}

// ── OAuth 1.0a signing ────────────────────────────────────────────────

function pct(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function buildOAuthHeader(method: string, url: string): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: process.env.TWITTER_API_KEY || '',
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts,
    oauth_token: process.env.TWITTER_ACCESS_TOKEN || '',
    oauth_version: '1.0',
  };

  const paramStr = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${pct(k)}=${pct(v)}`)
    .join('&');

  const base = `${method.toUpperCase()}&${pct(url)}&${pct(paramStr)}`;
  const signingKey = `${pct(process.env.TWITTER_API_SECRET || '')}&${pct(process.env.TWITTER_ACCESS_TOKEN_SECRET || '')}`;
  const sig = crypto.createHmac('sha1', signingKey).update(base).digest('base64');

  const all = { ...oauthParams, oauth_signature: sig };
  return 'OAuth ' + Object.entries(all).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ');
}

// ── X API v2 posting ──────────────────────────────────────────────────

const TWEET_URL = 'https://api.twitter.com/2/tweets';

interface PostTweetResult { tweetId: string | null; error: string | null }

export async function postTweet(text: string, replyToId?: string): Promise<PostTweetResult> {
  const body: Record<string, any> = { text };
  if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };

  try {
    const res = await fetch(TWEET_URL, {
      method: 'POST',
      headers: {
        'Authorization': buildOAuthHeader('POST', TWEET_URL),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      return { tweetId: null, error: `X API ${res.status}: ${errText}` };
    }

    const json = await res.json() as any;
    return { tweetId: json?.data?.id || null, error: null };
  } catch (err: any) {
    return { tweetId: null, error: err.message };
  }
}

// ── Tweet text composition ────────────────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  major: '🟠',
  minor: '🟡',
  info: '🔵',
};

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

function durationStr(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} mins`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}hr ${rem}min` : `${hrs}hr`;
}

function severityLabel(s: string): string {
  return s === 'critical' ? 'P1' : s === 'major' ? 'P2' : s === 'minor' ? 'P3' : s;
}

function vendorHashtag(name: string): string {
  return '#' + name.replace(/[^A-Za-z0-9]/g, '');
}

function composeDetectedTweet(
  vendorName: string, vendorKey: string, severity: string,
  impact: string, startedAt: string, chainEmoji?: string,
): string {
  const em = (chainEmoji || '') + SEVERITY_EMOJI[severity] || '🔴';
  const tag = vendorHashtag(vendorName);
  const started = durationStr(startedAt);
  const affected = truncate(impact, 60);
  const url = `vendorwatch.app/vendors/${vendorKey}`;
  const parts = [
    `${em} ${vendorName} is experiencing ${severityLabel(severity)} issues`,
    affected ? `Affected: ${affected}` : '',
    `Started: ${started} ago`,
    `Track it: ${url}`,
    `${tag} #outage #incident`,
  ].filter(Boolean);
  return truncate(parts.join('\n'), 280);
}

function composeUpdateTweet(
  vendorName: string, vendorKey: string, startedAt: string, latestUpdate: string,
): string {
  const duration = durationStr(startedAt);
  const tag = vendorHashtag(vendorName);
  const url = `vendorwatch.app/vendors/${vendorKey}`;
  const update = truncate(latestUpdate || 'Incident ongoing, engineers investigating.', 120);
  const parts = [
    `🟡 UPDATE: ${vendorName} incident ongoing (${duration} and counting)`,
    `Latest: ${update}`,
    url,
    tag,
  ];
  return truncate(parts.join('\n'), 280);
}

function composeResolvedTweet(
  vendorName: string, vendorKey: string, severity: string,
  startedAt: string, resolvedAt: string | null, blogSlug?: string,
): string {
  const tag = vendorHashtag(vendorName);
  const duration = durationStr(startedAt);
  const reportUrl = blogSlug
    ? `vendorwatch.app/outages/${blogSlug}`
    : `vendorwatch.app/vendors/${vendorKey}`;
  const parts = [
    `🟢 RESOLVED: ${vendorName} is back to normal`,
    `Duration: ${duration} | Severity: ${severityLabel(severity)}`,
    `Full report: ${reportUrl}`,
    `${tag} #resolved`,
  ];
  return truncate(parts.join('\n'), 280);
}

// ── Settings helpers ──────────────────────────────────────────────────

export async function getSettings() {
  const rows = await db.select().from(twitterBotSettings).limit(1);
  if (rows.length > 0) return rows[0];
  // Create default singleton row — tweetFromDate defaults to start of today
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [created] = await db.insert(twitterBotSettings).values({
    id: 'singleton', enabled: false, previewMode: true, tweetFromDate: todayStart,
  }).returning();
  return created;
}

export async function updateSettings(patch: Partial<typeof twitterBotSettings.$inferSelect>) {
  const existing = await getSettings();
  const [updated] = await db.insert(twitterBotSettings)
    .values({ id: 'singleton', ...existing, ...patch, updatedAt: new Date() })
    .onConflictDoUpdate({ target: twitterBotSettings.id, set: { ...patch, updatedAt: new Date() } })
    .returning();
  return updated;
}

// ── Log helpers ───────────────────────────────────────────────────────

async function getDetectedTweetId(incidentId: string): Promise<string | null> {
  const rows = await db.select({ tweetId: tweetLog.tweetId })
    .from(tweetLog)
    .where(and(eq(tweetLog.incidentId, incidentId), eq(tweetLog.tweetType, 'detected'), eq(tweetLog.status, 'posted')))
    .limit(1);
  return rows[0]?.tweetId || null;
}

async function hasResolvedTweet(incidentId: string): Promise<boolean> {
  const rows = await db.select({ id: tweetLog.id })
    .from(tweetLog)
    .where(and(eq(tweetLog.incidentId, incidentId), eq(tweetLog.tweetType, 'resolved')))
    .limit(1);
  return rows.length > 0;
}

async function lastTweetTime(incidentId: string): Promise<Date | null> {
  // Include 'posted', 'failed', and 'skipped' so preview mode also triggers the 30-min cooloff
  // and doesn't flood the log with an entry every 2 minutes for the same incident
  const rows = await db.select({ postedAt: tweetLog.postedAt })
    .from(tweetLog)
    .where(and(eq(tweetLog.incidentId, incidentId), inArray(tweetLog.status, ['posted', 'failed', 'skipped'])))
    .orderBy(desc(tweetLog.postedAt))
    .limit(1);
  if (rows.length === 0) return null;
  return rows[0]?.postedAt || null;
}

/**
 * Returns the "Latest: X" snippet from the most recent update tweet for this incident.
 * Used to detect whether the vendor has posted new content since we last tweeted.
 */
async function getLastTweetedUpdateSnippet(incidentId: string): Promise<string | null> {
  const rows = await db.select({ content: tweetLog.content })
    .from(tweetLog)
    .where(and(
      eq(tweetLog.incidentId, incidentId),
      eq(tweetLog.tweetType, 'update'),
      inArray(tweetLog.status, ['posted', 'skipped']),
    ))
    .orderBy(desc(tweetLog.postedAt))
    .limit(1);
  if (rows.length === 0) return null;
  const match = rows[0].content.match(/Latest: (.+)/);
  return match ? match[1].trim() : null;
}

async function countFailedAttempts(incidentId: string): Promise<number> {
  const rows = await db.select({ id: tweetLog.id })
    .from(tweetLog)
    .where(and(eq(tweetLog.incidentId, incidentId), eq(tweetLog.status, 'failed'), eq(tweetLog.tweetType, 'detected')));
  return rows.length;
}

async function logTweet(opts: {
  incidentId: string; incidentType: string; vendorKey: string;
  tweetId: string | null; tweetType: string; content: string;
  status: string; errorMessage?: string;
}) {
  await db.insert(tweetLog).values({
    incidentId: opts.incidentId, incidentType: opts.incidentType,
    vendorKey: opts.vendorKey, tweetId: opts.tweetId,
    tweetType: opts.tweetType, content: opts.content,
    status: opts.status, errorMessage: opts.errorMessage || null,
  });
}

// ── Monitor count check ───────────────────────────────────────────────

async function getMonitorCount(vendorKey: string): Promise<number> {
  const rows = await db.select({ cnt: sql<number>`count(*)` })
    .from(userVendorSubscriptions)
    .where(eq(userVendorSubscriptions.vendorKey, vendorKey));
  return Number(rows[0]?.cnt || 0);
}

// ── Core posting function ─────────────────────────────────────────────

async function sendOrPreview(
  settings: typeof twitterBotSettings.$inferSelect,
  content: string,
  opts: { incidentId: string; incidentType: string; vendorKey: string; tweetType: string; replyToId?: string },
): Promise<void> {
  if (settings.previewMode || !settings.enabled) {
    console.log(`[twitter-bot] PREVIEW: ${opts.tweetType} tweet for ${opts.vendorKey}:\n${content}`);
    await logTweet({ ...opts, tweetId: null, content, status: 'skipped', errorMessage: settings.enabled ? 'Preview mode' : 'Bot disabled' });
    return;
  }

  const { tweetId, error } = await postTweet(content, opts.replyToId);
  if (error) {
    console.error(`[twitter-bot] Failed to post ${opts.tweetType} for ${opts.vendorKey}:`, error);
    await logTweet({ ...opts, tweetId: null, content, status: 'failed', errorMessage: error });
  } else {
    console.log(`[twitter-bot] Posted ${opts.tweetType} for ${opts.vendorKey}: https://x.com/i/web/status/${tweetId}`);
    recordTweet();
    await logTweet({ ...opts, tweetId, content, status: 'posted' });
  }
}

// ── Manual post trigger ───────────────────────────────────────────────

export async function manualPostIncident(incidentId: string): Promise<{ success: boolean; content: string; tweetId?: string; error?: string }> {
  const settings = await getSettings();
  const [inc] = await db.select().from(incidents).where(eq(incidents.incidentId, incidentId)).limit(1);
  if (!inc) return { success: false, content: '', error: 'Incident not found' };

  const vendorInfo = await db.select({ name: vendors.name }).from(vendors).where(eq(vendors.key, inc.vendorKey)).limit(1);
  const vendorName = vendorInfo[0]?.name || inc.vendorKey;

  const content = composeDetectedTweet(vendorName, inc.vendorKey, inc.severity, inc.impact, inc.startedAt);
  const replyToId = await getDetectedTweetId(incidentId) || undefined;

  if (settings.previewMode || !settings.enabled) {
    await logTweet({ incidentId, incidentType: 'vendor', vendorKey: inc.vendorKey, tweetId: null, tweetType: 'detected', content, status: 'skipped', errorMessage: 'Manual trigger in preview mode' });
    return { success: true, content };
  }

  const { tweetId, error } = await postTweet(content, replyToId);
  if (error) {
    await logTweet({ incidentId, incidentType: 'vendor', vendorKey: inc.vendorKey, tweetId: null, tweetType: 'detected', content, status: 'failed', errorMessage: error });
    return { success: false, content, error };
  }
  recordTweet();
  await logTweet({ incidentId, incidentType: 'vendor', vendorKey: inc.vendorKey, tweetId, tweetType: 'detected', content, status: 'posted' });
  return { success: true, content, tweetId: tweetId! };
}

// ── Blockchain tweet composition ──────────────────────────────────────

function composeBlockchainDetectedTweet(
  chainName: string, chainKey: string, symbol: string | null,
  severity: string, description: string | null, startedAt: string,
): string {
  const em = SEVERITY_EMOJI[severity] || '🔴';
  const tag = '#' + (symbol || chainKey).replace(/[^A-Za-z0-9]/g, '');
  const started = durationStr(startedAt);
  const affected = truncate(description || 'core services', 60);
  const url = `vendorwatch.app/web3`;
  const parts = [
    `${em} ${chainName} is experiencing ${severityLabel(severity)} blockchain issues`,
    `Affected: ${affected}`,
    `Started: ${started} ago`,
    `Live status: ${url}`,
    `${tag} #blockchain #incident`,
  ].filter(Boolean);
  return truncate(parts.join('\n'), 280);
}

function composeBlockchainUpdateTweet(
  chainName: string, chainKey: string, symbol: string | null,
  startedAt: string, title: string,
): string {
  const duration = durationStr(startedAt);
  const tag = '#' + (symbol || chainKey).replace(/[^A-Za-z0-9]/g, '');
  const url = `vendorwatch.app/web3`;
  const update = truncate(title || 'Incident ongoing, engineers investigating.', 120);
  const parts = [
    `🟡 UPDATE: ${chainName} blockchain incident ongoing (${duration} and counting)`,
    `Latest: ${update}`,
    url,
    tag,
  ];
  return truncate(parts.join('\n'), 280);
}

function composeBlockchainResolvedTweet(
  chainName: string, chainKey: string, symbol: string | null,
  severity: string, startedAt: string, blogSlug?: string,
): string {
  const tag = '#' + (symbol || chainKey).replace(/[^A-Za-z0-9]/g, '');
  const duration = durationStr(startedAt);
  const reportUrl = blogSlug
    ? `vendorwatch.app/outages/${blogSlug}`
    : `vendorwatch.app/web3`;
  const parts = [
    `🟢 RESOLVED: ${chainName} blockchain is back to normal`,
    `Duration: ${duration} | Severity: ${severityLabel(severity)}`,
    `Full report: ${reportUrl}`,
    `${tag} #blockchain #resolved`,
  ];
  return truncate(parts.join('\n'), 280);
}

// ── Main cron evaluation ──────────────────────────────────────────────

export async function runTwitterBotCycle(): Promise<void> {
  const settings = await getSettings();

  // Check rate limit
  const tweetsThisHour = countTweetsInLastHour();
  if (tweetsThisHour >= settings.maxTweetsPerHour && !settings.previewMode) {
    console.log(`[twitter-bot] Rate limit reached: ${tweetsThisHour}/${settings.maxTweetsPerHour} tweets this hour`);
    return;
  }

  // Get excluded vendors
  let excludedKeys: string[] = [];
  try { excludedKeys = JSON.parse(settings.excludedVendorKeys || '[]'); } catch {}

  // Build severity filter
  const allowedSeverities = settings.minSeverity === 'critical' ? ['critical'] : ['critical', 'major'];

  // ── 1. NEW INCIDENT TWEETS ─────────────────────────────────────────

  const activeIncidents = await db.select().from(incidents)
    .where(and(
      ne(incidents.status, 'resolved'),
      ne(incidents.status, 'postmortem'),
      inArray(incidents.severity, allowedSeverities),
    ));

  for (const inc of activeIncidents) {
    if (countTweetsInLastHour() >= settings.maxTweetsPerHour && !settings.previewMode) break;

    if (excludedKeys.includes(inc.vendorKey)) continue;

    // Skip incidents that started before the tweetFromDate cutoff
    if (settings.tweetFromDate && new Date(inc.startedAt) < new Date(settings.tweetFromDate)) {
      continue;
    }

    // Must have been active for at least N minutes
    const activeMs = Date.now() - new Date(inc.startedAt).getTime();
    if (activeMs < settings.minActiveMinutes * 60 * 1000) continue;

    // Must not have been tweeted in last 30 minutes
    const last = await lastTweetTime(inc.incidentId);
    if (last && Date.now() - new Date(last).getTime() < 30 * 60 * 1000) continue;

    // Must not already have a detected tweet
    const existing = await getDetectedTweetId(inc.incidentId);
    if (existing) continue;

    // Skip if too many failed attempts (max 5 retries per incident)
    const failedAttempts = await countFailedAttempts(inc.incidentId);
    if (failedAttempts >= 5) {
      console.log(`[twitter-bot] Skipping ${inc.vendorKey}: ${failedAttempts} failed attempts, giving up`);
      continue;
    }

    // Check monitor count
    const monitorCount = await getMonitorCount(inc.vendorKey);
    if (monitorCount < settings.minMonitorCount) {
      console.log(`[twitter-bot] Skipping ${inc.vendorKey}: only ${monitorCount} monitors (min: ${settings.minMonitorCount})`);
      continue;
    }

    const vendorInfo = await db.select({ name: vendors.name }).from(vendors).where(eq(vendors.key, inc.vendorKey)).limit(1);
    const vendorName = vendorInfo[0]?.name || inc.vendorKey;
    const content = composeDetectedTweet(vendorName, inc.vendorKey, inc.severity, inc.impact, inc.startedAt);

    await sendOrPreview(settings, content, { incidentId: inc.incidentId, incidentType: 'vendor', vendorKey: inc.vendorKey, tweetType: 'detected' });
  }

  // ── 2. UPDATE TWEETS (incident ongoing > updateIntervalMinutes with no recent tweet) ──

  const tweetedIncidents = await db.selectDistinct({ incidentId: tweetLog.incidentId })
    .from(tweetLog)
    .where(and(eq(tweetLog.tweetType, 'detected'), eq(tweetLog.status, 'posted'), eq(tweetLog.incidentType, 'vendor')));

  const tweetedIds = tweetedIncidents.map(r => r.incidentId);

  if (tweetedIds.length > 0) {
    const ongoingTweeted = await db.select().from(incidents)
      .where(and(
        ne(incidents.status, 'resolved'),
        ne(incidents.status, 'postmortem'),
        inArray(incidents.incidentId, tweetedIds),
      ));

    for (const inc of ongoingTweeted) {
      if (countTweetsInLastHour() >= settings.maxTweetsPerHour && !settings.previewMode) break;
      if (excludedKeys.includes(inc.vendorKey)) continue;

      const durationMs = Date.now() - new Date(inc.startedAt).getTime();
      if (durationMs < settings.updateIntervalMinutes * 60 * 1000) continue;

      const last = await lastTweetTime(inc.incidentId);
      if (last && Date.now() - new Date(last).getTime() < settings.updateIntervalMinutes * 60 * 1000) continue;

      // Only tweet update if the vendor has posted new content since the last update tweet
      const currentSnippet = truncate(inc.title || 'Incident ongoing, engineers investigating.', 120);
      const lastSnippet = await getLastTweetedUpdateSnippet(inc.incidentId);
      if (lastSnippet !== null && lastSnippet === currentSnippet) {
        console.log(`[twitter-bot] Skipping update for ${inc.vendorKey}: vendor content unchanged`);
        continue;
      }

      const replyToId = await getDetectedTweetId(inc.incidentId) || undefined;
      const vendorInfo = await db.select({ name: vendors.name }).from(vendors).where(eq(vendors.key, inc.vendorKey)).limit(1);
      const vendorName = vendorInfo[0]?.name || inc.vendorKey;
      const content = composeUpdateTweet(vendorName, inc.vendorKey, inc.startedAt, inc.title);

      await sendOrPreview(settings, content, { incidentId: inc.incidentId, incidentType: 'vendor', vendorKey: inc.vendorKey, tweetType: 'update', replyToId });
    }
  }

  // ── 3. RESOLUTION TWEETS ──────────────────────────────────────────

  if (tweetedIds.length > 0) {
    const resolvedTweeted = await db.select().from(incidents)
      .where(and(
        inArray(incidents.status, ['resolved', 'postmortem']),
        inArray(incidents.incidentId, tweetedIds),
      ));

    for (const inc of resolvedTweeted) {
      if (countTweetsInLastHour() >= settings.maxTweetsPerHour && !settings.previewMode) break;
      if (excludedKeys.includes(inc.vendorKey)) continue;
      if (await hasResolvedTweet(inc.incidentId)) continue;

      const replyToId = await getDetectedTweetId(inc.incidentId) || undefined;
      const vendorInfo = await db.select({ name: vendors.name }).from(vendors).where(eq(vendors.key, inc.vendorKey)).limit(1);
      const vendorName = vendorInfo[0]?.name || inc.vendorKey;

      // Link to published blog post if one exists for this incident
      const [blogPost] = await db.select({ slug: blogPosts.slug })
        .from(blogPosts)
        .where(and(eq(blogPosts.incidentId, inc.incidentId), eq(blogPosts.status, 'published')))
        .limit(1);

      const content = composeResolvedTweet(vendorName, inc.vendorKey, inc.severity, inc.startedAt, inc.resolvedAt?.toISOString() ?? null, blogPost?.slug);

      await sendOrPreview(settings, content, { incidentId: inc.incidentId, incidentType: 'vendor', vendorKey: inc.vendorKey, tweetType: 'resolved', replyToId });
    }
  }

  // ── 4. NEW BLOCKCHAIN INCIDENT TWEETS ────────────────────────────

  const activeChainIncidents = await db.select().from(blockchainIncidents)
    .where(and(
      ne(blockchainIncidents.status, 'resolved'),
      inArray(blockchainIncidents.severity, allowedSeverities),
    ));

  for (const inc of activeChainIncidents) {
    if (countTweetsInLastHour() >= settings.maxTweetsPerHour && !settings.previewMode) break;

    // Skip incidents that started before the tweetFromDate cutoff
    if (settings.tweetFromDate && new Date(inc.startedAt) < new Date(settings.tweetFromDate)) {
      continue;
    }

    const activeMs = Date.now() - new Date(inc.startedAt).getTime();
    if (activeMs < settings.minActiveMinutes * 60 * 1000) continue;

    const last = await lastTweetTime(inc.id);
    if (last && Date.now() - new Date(last).getTime() < 30 * 60 * 1000) continue;

    const existingTweet = await getDetectedTweetId(inc.id);
    if (existingTweet) continue;

    // Skip if too many failed attempts (max 5 retries per incident)
    const failedAttempts = await countFailedAttempts(inc.id);
    if (failedAttempts >= 5) {
      console.log(`[twitter-bot] Skipping blockchain ${inc.chainKey}: ${failedAttempts} failed attempts, giving up`);
      continue;
    }

    const chainInfo = await db.select({ name: blockchainChains.name, symbol: blockchainChains.symbol })
      .from(blockchainChains).where(eq(blockchainChains.key, inc.chainKey)).limit(1);
    const chainName = chainInfo[0]?.name || inc.chainKey;
    const symbol = chainInfo[0]?.symbol || null;

    const content = composeBlockchainDetectedTweet(chainName, inc.chainKey, symbol, inc.severity, inc.description, inc.startedAt);
    await sendOrPreview(settings, content, { incidentId: inc.id, incidentType: 'blockchain', vendorKey: inc.chainKey, tweetType: 'detected' });
  }

  // ── 5. BLOCKCHAIN UPDATE TWEETS ───────────────────────────────────

  const tweetedChainIds = (await db.selectDistinct({ incidentId: tweetLog.incidentId })
    .from(tweetLog)
    .where(and(eq(tweetLog.tweetType, 'detected'), eq(tweetLog.status, 'posted'), eq(tweetLog.incidentType, 'blockchain'))))
    .map(r => r.incidentId);

  if (tweetedChainIds.length > 0) {
    const ongoingChainTweeted = await db.select().from(blockchainIncidents)
      .where(and(
        ne(blockchainIncidents.status, 'resolved'),
        inArray(blockchainIncidents.id, tweetedChainIds),
      ));

    for (const inc of ongoingChainTweeted) {
      if (countTweetsInLastHour() >= settings.maxTweetsPerHour && !settings.previewMode) break;

      const durationMs = Date.now() - new Date(inc.startedAt).getTime();
      if (durationMs < settings.updateIntervalMinutes * 60 * 1000) continue;

      const last = await lastTweetTime(inc.id);
      if (last && Date.now() - new Date(last).getTime() < settings.updateIntervalMinutes * 60 * 1000) continue;

      // Only tweet update if the chain has posted new content since the last update tweet
      const currentSnippet = truncate(inc.title || 'Incident ongoing, engineers investigating.', 120);
      const lastSnippet = await getLastTweetedUpdateSnippet(inc.id);
      if (lastSnippet !== null && lastSnippet === currentSnippet) {
        console.log(`[twitter-bot] Skipping update for blockchain ${inc.chainKey}: vendor content unchanged`);
        continue;
      }

      const replyToId = await getDetectedTweetId(inc.id) || undefined;
      const chainInfo = await db.select({ name: blockchainChains.name, symbol: blockchainChains.symbol })
        .from(blockchainChains).where(eq(blockchainChains.key, inc.chainKey)).limit(1);
      const chainName = chainInfo[0]?.name || inc.chainKey;
      const symbol = chainInfo[0]?.symbol || null;

      const content = composeBlockchainUpdateTweet(chainName, inc.chainKey, symbol, inc.startedAt, inc.title);
      await sendOrPreview(settings, content, { incidentId: inc.id, incidentType: 'blockchain', vendorKey: inc.chainKey, tweetType: 'update', replyToId });
    }
  }

  // ── 6. BLOCKCHAIN RESOLUTION TWEETS ──────────────────────────────

  if (tweetedChainIds.length > 0) {
    const resolvedChainTweeted = await db.select().from(blockchainIncidents)
      .where(and(
        eq(blockchainIncidents.status, 'resolved'),
        inArray(blockchainIncidents.id, tweetedChainIds),
      ));

    for (const inc of resolvedChainTweeted) {
      if (countTweetsInLastHour() >= settings.maxTweetsPerHour && !settings.previewMode) break;
      if (await hasResolvedTweet(inc.id)) continue;

      const replyToId = await getDetectedTweetId(inc.id) || undefined;
      const chainInfo = await db.select({ name: blockchainChains.name, symbol: blockchainChains.symbol })
        .from(blockchainChains).where(eq(blockchainChains.key, inc.chainKey)).limit(1);
      const chainName = chainInfo[0]?.name || inc.chainKey;
      const symbol = chainInfo[0]?.symbol || null;

      // Check if there's a blog post slug to link to
      const [blogPost] = await db.select({ slug: blogPosts.slug })
        .from(blogPosts)
        .where(and(eq(blogPosts.incidentId, inc.id), eq(blogPosts.status, 'published')))
        .limit(1);

      const content = composeBlockchainResolvedTweet(chainName, inc.chainKey, symbol, inc.severity, inc.startedAt, blogPost?.slug);
      await sendOrPreview(settings, content, { incidentId: inc.id, incidentType: 'blockchain', vendorKey: inc.chainKey, tweetType: 'resolved', replyToId });
    }
  }
}
