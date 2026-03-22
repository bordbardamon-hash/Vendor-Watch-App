// Hardcoded known dependency relationships (confidence 1=confirmed, 2=inferred, 3=community)
// upstream depends-on (is upstream for) downstream means: downstream DEPENDS ON upstream
// i.e. edge means: downstream → uses → upstream

export interface SeedEdge {
  upstreamId: string;
  upstreamType: 'vendor' | 'blockchain';
  downstreamId: string;
  downstreamType: 'vendor' | 'blockchain';
  relationship: 'hosted_on' | 'uses_rpc' | 'uses_auth' | 'uses_cdn' | 'uses_api';
  confidence: 1 | 2 | 3;
  notes?: string;
}

export const SEED_EDGES: SeedEdge[] = [
  // ── Infura / Alchemy infrastructure ──────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'infura',    downstreamType: 'blockchain', relationship: 'hosted_on', confidence: 1, notes: 'Infura runs its node infrastructure on AWS' },
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'alchemy',   downstreamType: 'blockchain', relationship: 'hosted_on', confidence: 1, notes: 'Alchemy primary cloud provider is AWS' },
  { upstreamId: 'gcp',      upstreamType: 'vendor',     downstreamId: 'alchemy',   downstreamType: 'blockchain', relationship: 'hosted_on', confidence: 1, notes: 'Alchemy also uses GCP for redundancy' },
  { upstreamId: 'ethereum', upstreamType: 'blockchain', downstreamId: 'infura',    downstreamType: 'blockchain', relationship: 'uses_rpc',  confidence: 1, notes: 'Infura provides Ethereum RPC access' },
  { upstreamId: 'ethereum', upstreamType: 'blockchain', downstreamId: 'alchemy',   downstreamType: 'blockchain', relationship: 'uses_rpc',  confidence: 1, notes: 'Alchemy provides Ethereum RPC access' },

  // ── MetaMask ──────────────────────────────────────────────────────
  { upstreamId: 'infura',   upstreamType: 'blockchain', downstreamId: 'metamask',  downstreamType: 'blockchain', relationship: 'uses_rpc',  confidence: 1, notes: 'MetaMask defaults to Infura for RPC' },
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'metamask',  downstreamType: 'blockchain', relationship: 'hosted_on', confidence: 2 },

  // ── Aave ─────────────────────────────────────────────────────────
  { upstreamId: 'infura',   upstreamType: 'blockchain', downstreamId: 'aave',      downstreamType: 'blockchain', relationship: 'uses_rpc',  confidence: 1 },
  { upstreamId: 'ethereum', upstreamType: 'blockchain', downstreamId: 'aave',      downstreamType: 'blockchain', relationship: 'uses_rpc',  confidence: 1 },
  { upstreamId: 'cloudflare', upstreamType: 'vendor',   downstreamId: 'aave',      downstreamType: 'blockchain', relationship: 'uses_cdn',  confidence: 2 },

  // ── OpenSea ──────────────────────────────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'opensea',   downstreamType: 'blockchain', relationship: 'hosted_on', confidence: 1 },
  { upstreamId: 'ethereum', upstreamType: 'blockchain', downstreamId: 'opensea',   downstreamType: 'blockchain', relationship: 'uses_rpc',  confidence: 1 },
  { upstreamId: 'cloudflare', upstreamType: 'vendor',   downstreamId: 'opensea',   downstreamType: 'blockchain', relationship: 'uses_cdn',  confidence: 2 },

  // ── L2s depend on Ethereum ────────────────────────────────────────
  { upstreamId: 'ethereum', upstreamType: 'blockchain', downstreamId: 'arbitrum',  downstreamType: 'blockchain', relationship: 'uses_rpc',  confidence: 1, notes: 'Arbitrum settles on Ethereum L1' },
  { upstreamId: 'ethereum', upstreamType: 'blockchain', downstreamId: 'optimism',  downstreamType: 'blockchain', relationship: 'uses_rpc',  confidence: 1, notes: 'Optimism settles on Ethereum L1' },
  { upstreamId: 'ethereum', upstreamType: 'blockchain', downstreamId: 'base',      downstreamType: 'blockchain', relationship: 'uses_rpc',  confidence: 1, notes: 'Base (Coinbase L2) settles on Ethereum L1' },
  { upstreamId: 'ethereum', upstreamType: 'blockchain', downstreamId: 'polygon',   downstreamType: 'blockchain', relationship: 'uses_rpc',  confidence: 2, notes: 'Polygon PoS checkpoints to Ethereum' },

  // ── Vercel / Netlify ──────────────────────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'vercel',    downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 1, notes: 'Vercel Lambda functions run on AWS' },
  { upstreamId: 'cloudflare', upstreamType: 'vendor',   downstreamId: 'vercel',    downstreamType: 'vendor',     relationship: 'uses_cdn',  confidence: 2 },
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'netlify',   downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 1, notes: 'Netlify edge functions run on AWS' },

  // ── GitHub ────────────────────────────────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'github',    downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 2 },
  { upstreamId: 'cloudflare', upstreamType: 'vendor',   downstreamId: 'github',    downstreamType: 'vendor',     relationship: 'uses_cdn',  confidence: 2 },

  // ── Stripe ────────────────────────────────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'stripe',    downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 2 },
  { upstreamId: 'cloudflare', upstreamType: 'vendor',   downstreamId: 'stripe',    downstreamType: 'vendor',     relationship: 'uses_cdn',  confidence: 2 },

  // ── Slack ─────────────────────────────────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'slack',     downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 1 },

  // ── Twilio ────────────────────────────────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'twilio',    downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 2 },

  // ── Shopify ───────────────────────────────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'shopify',   downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 2 },
  { upstreamId: 'cloudflare', upstreamType: 'vendor',   downstreamId: 'shopify',   downstreamType: 'vendor',     relationship: 'uses_cdn',  confidence: 1, notes: 'Shopify uses Cloudflare as primary CDN' },

  // ── HubSpot ───────────────────────────────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'hubspot',   downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 2 },

  // ── Datadog ───────────────────────────────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'datadog',   downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 2 },

  // ── PagerDuty ─────────────────────────────────────────────────────
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'pagerduty', downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 2 },

  // ── OpenAI ────────────────────────────────────────────────────────
  { upstreamId: 'azure',    upstreamType: 'vendor',     downstreamId: 'openai',    downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 1, notes: 'OpenAI runs on Azure infrastructure (Microsoft partnership)' },
  { upstreamId: 'aws',      upstreamType: 'vendor',     downstreamId: 'openai',    downstreamType: 'vendor',     relationship: 'hosted_on', confidence: 2 },
];
