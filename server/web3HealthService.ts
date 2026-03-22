import { db } from './db';
import { blockchainChains, blockchainIncidents, incidents, vendors } from '@shared/schema';
import { sql, isNull, and, ne } from 'drizzle-orm';

export type Verdict = 'All Systems Healthy' | 'Minor Disruptions' | 'Degraded Performance' | 'Major Outage';
export type VerdictColor = 'green' | 'yellow' | 'orange' | 'red';

export interface SummaryIncident {
  id: string;
  source: 'chain' | 'vendor';
  key: string;
  name: string;
  title: string;
  severity: string;
  status: string;
  startedAt: string;
}

export interface ChainStatus {
  key: string;
  name: string;
  symbol: string | null;
  logoUrl: string | null;
  tier: string;
  category: string;
  status: string;
  avgBlockTime: number | null;
  lastBlockTime: Date | null;
  activeIncidents: number;
  lastChecked: Date | null;
}

export interface InfraVendor {
  key: string;
  name: string;
  logoUrl: string | null;
  status: string;
  category: string;
}

export interface Web3Summary {
  verdict: Verdict;
  verdictColor: VerdictColor;
  chainsMonitored: number;
  vendorsMonitored: number;
  activeIncidents: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  lastUpdated: string;
  incidents: SummaryIncident[];
  chains: ChainStatus[];
  infraVendors: InfraVendor[];
}

export interface TrendDay {
  date: string;
  chainCount: number;
  vendorCount: number;
  total: number;
}

// ── 30-second server-side cache ───────────────────────────────────────
let summaryCache: { data: Web3Summary; expires: number } | null = null;
let trendCache: { data: TrendDay[]; expires: number } | null = null;

// Priority order for chains (by ecosystem size / market cap)
const CHAIN_PRIORITY: Record<string, number> = {
  bitcoin: 1, ethereum: 2, solana: 3, bsc: 4, binance: 4,
  polygon: 5, avalanche: 6, tron: 7, cosmos: 8, arbitrum: 9,
  optimism: 10, base: 11, ripple: 12, stellar: 13, hedera: 14,
  sui: 15, flow: 16, starknet: 17, scroll: 18, blast: 19, immutablex: 20,
};

function chainSortKey(c: ChainStatus): number {
  const prio = CHAIN_PRIORITY[c.key];
  if (prio) return prio;
  // tier1 < tier2 < tier3 < tier4, then alphabetical
  const tierNum = parseInt(c.tier.replace('tier', '') || '9');
  return 100 + tierNum * 10;
}

function calcVerdict(critical: number, major: number, minor: number): [Verdict, VerdictColor] {
  if (critical > 0) return ['Major Outage', 'red'];
  if (major > 0)    return ['Degraded Performance', 'orange'];
  if (minor >= 4)   return ['Degraded Performance', 'orange'];
  if (minor >= 1)   return ['Minor Disruptions', 'yellow'];
  return ['All Systems Healthy', 'green'];
}

// Web3-relevant blockchain categories to show in infra strip
const INFRA_CATEGORIES = ['rpc_provider', 'oracle', 'indexer', 'bridge', 'nft', 'staking', 'defi'];

export async function getWeb3Summary(): Promise<Web3Summary> {
  if (summaryCache && Date.now() < summaryCache.expires) return summaryCache.data;

  const [allChains, allVendors, activeChainIncidents, activeVendorIncidents] = await Promise.all([
    db.select().from(blockchainChains),
    db.select({ key: vendors.key, name: vendors.name, logoUrl: vendors.logoUrl, status: vendors.status, category: vendors.category }).from(vendors),
    db.select().from(blockchainIncidents).where(
      and(isNull(blockchainIncidents.resolvedAt), isNull(blockchainIncidents.manuallyResolvedAt))
    ),
    db.select({
      id: incidents.id,
      vendorKey: incidents.vendorKey,
      title: incidents.title,
      severity: incidents.severity,
      status: incidents.status,
      startedAt: incidents.startedAt,
    }).from(incidents).where(
      and(
        ne(incidents.status, 'resolved'),
        ne(incidents.status, 'postmortem'),
      )
    ),
  ]);

  // Count active chain incidents per chain
  const chainIncidentCount = new Map<string, number>();
  for (const inc of activeChainIncidents) {
    chainIncidentCount.set(inc.chainKey, (chainIncidentCount.get(inc.chainKey) || 0) + 1);
  }

  // Build ChainStatus list (only category: chain, l2, and major DeFi)
  const watchedCategories = ['chain', 'l2'];
  const chains: ChainStatus[] = allChains
    .filter(c => watchedCategories.includes(c.category))
    .map(c => ({
      key: c.key,
      name: c.name,
      symbol: c.symbol,
      logoUrl: c.logoUrl,
      tier: c.tier,
      category: c.category,
      status: c.status,
      avgBlockTime: c.avgBlockTime,
      lastBlockTime: c.lastBlockTime,
      activeIncidents: chainIncidentCount.get(c.key) || 0,
      lastChecked: c.lastChecked,
    }))
    .sort((a, b) => chainSortKey(a) - chainSortKey(b));

  // Build infra vendor strip from blockchain_chains
  const infraVendors: InfraVendor[] = allChains
    .filter(c => INFRA_CATEGORIES.includes(c.category))
    .sort((a, b) => {
      const tierA = parseInt(a.tier.replace('tier', '') || '9');
      const tierB = parseInt(b.tier.replace('tier', '') || '9');
      return tierA - tierB || a.name.localeCompare(b.name);
    })
    .map(c => ({
      key: c.key,
      name: c.name,
      logoUrl: c.logoUrl,
      status: c.status,
      category: c.category,
    }));

  // Count severities across chain + vendor active incidents
  let critical = 0, major = 0, minor = 0;

  for (const inc of activeChainIncidents) {
    if (inc.severity === 'critical') critical++;
    else if (inc.severity === 'major') major++;
    else if (inc.severity === 'minor' || inc.severity === 'info') minor++;
  }
  for (const inc of activeVendorIncidents) {
    if (inc.severity === 'critical') critical++;
    else if (inc.severity === 'major') major++;
    else if (inc.severity === 'minor' || inc.severity === 'info') minor++;
  }

  const [verdict, verdictColor] = calcVerdict(critical, major, minor);

  // Build combined incident feed (active, sorted by severity then time)
  const severityOrder: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };

  const chainNameMap = new Map(allChains.map(c => [c.key, c.name]));
  const vendorNameMap = new Map(allVendors.map(v => [v.key, v.name]));

  const combinedIncidents: SummaryIncident[] = [
    ...activeChainIncidents.map(inc => ({
      id: inc.id,
      source: 'chain' as const,
      key: inc.chainKey,
      name: chainNameMap.get(inc.chainKey) || inc.chainKey,
      title: inc.title,
      severity: inc.severity,
      status: inc.status,
      startedAt: inc.startedAt,
    })),
    ...activeVendorIncidents.map(inc => ({
      id: inc.id,
      source: 'vendor' as const,
      key: inc.vendorKey,
      name: vendorNameMap.get(inc.vendorKey) || inc.vendorKey,
      title: inc.title,
      severity: inc.severity,
      status: inc.status,
      startedAt: inc.startedAt,
    })),
  ].sort((a, b) =>
    (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9) ||
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  ).slice(0, 50);

  const data: Web3Summary = {
    verdict,
    verdictColor,
    chainsMonitored: chains.length,
    vendorsMonitored: allVendors.length,
    activeIncidents: critical + major + minor,
    criticalCount: critical,
    majorCount: major,
    minorCount: minor,
    lastUpdated: new Date().toISOString(),
    incidents: combinedIncidents,
    chains,
    infraVendors,
  };

  summaryCache = { data, expires: Date.now() + 30_000 };
  return data;
}

export async function getWeb3Trend(): Promise<TrendDay[]> {
  if (trendCache && Date.now() < trendCache.expires) return trendCache.data;

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29); // 29 days ago → today = 30 data points

  // Build 30-day map scaffold (days -29 through 0, i.e. 30 points inclusive of today)
  const trendMap = new Map<string, { chain: number; vendor: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    trendMap.set(d.toISOString().slice(0, 10), { chain: 0, vendor: 0 });
  }

  // Fetch raw incidents in the window and group in JS
  const [chainIncs, vendorIncs] = await Promise.all([
    db.select({ createdAt: blockchainIncidents.createdAt })
      .from(blockchainIncidents)
      .where(sql`${blockchainIncidents.createdAt} >= ${thirtyDaysAgo}`),
    db.select({ createdAt: incidents.createdAt })
      .from(incidents)
      .where(sql`${incidents.createdAt} >= ${thirtyDaysAgo}`),
  ]);

  for (const r of chainIncs) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const entry = trendMap.get(key) || { chain: 0, vendor: 0 };
    entry.chain++;
    trendMap.set(key, entry);
  }
  for (const r of vendorIncs) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const entry = trendMap.get(key) || { chain: 0, vendor: 0 };
    entry.vendor++;
    trendMap.set(key, entry);
  }

  const trend: TrendDay[] = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { chain, vendor }]) => ({
      date,
      chainCount: chain,
      vendorCount: vendor,
      total: chain + vendor,
    }));

  trendCache = { data: trend, expires: Date.now() + 30_000 };
  return trend;
}
