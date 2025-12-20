export type VendorDef = {
  key: string;
  name: string;
  statusUrl: string;
  parserHint?: "statuspage" | "khoros" | "custom" | "unknown";
  tags?: string[];
};

export const EXTRA_VENDORS: VendorDef[] = [
  {
    key: "connectwise",
    name: "ConnectWise",
    statusUrl: "https://status.connectwise.com/",
    parserHint: "statuspage",
    tags: ["MSP", "IT Ops"],
  },
  {
    key: "kaseya",
    name: "Kaseya",
    statusUrl: "https://status.kaseya.com/",
    parserHint: "statuspage",
    tags: ["MSP", "IT Ops"],
  },
  {
    key: "nable",
    name: "N-able",
    statusUrl: "https://status.n-able.com/",
    parserHint: "custom",
    tags: ["MSP", "IT Ops"],
  },
  {
    key: "syncro",
    name: "Syncro",
    statusUrl: "https://www.syncrostatus.com/",
    parserHint: "custom",
    tags: ["MSP", "IT Ops"],
  },
  {
    key: "sentinelone",
    name: "SentinelOne",
    statusUrl: "https://status.sentinelone.com/",
    parserHint: "statuspage",
    tags: ["Security"],
  },
  {
    key: "auth0",
    name: "Auth0",
    statusUrl: "https://status.auth0.com/",
    parserHint: "statuspage",
    tags: ["Identity", "Auth"],
  },
  {
    key: "pingidentity",
    name: "Ping Identity",
    statusUrl: "https://status.pingidentity.com/",
    parserHint: "custom",
    tags: ["Identity", "Auth"],
  },
  {
    key: "slack",
    name: "Slack",
    statusUrl: "https://slack-status.com/",
    parserHint: "custom",
    tags: ["SaaS", "Collaboration"],
  },
  {
    key: "hubspot",
    name: "HubSpot",
    statusUrl: "https://status.hubspot.com/",
    parserHint: "statuspage",
    tags: ["SaaS", "CRM"],
  },
  {
    key: "quickbooks",
    name: "QuickBooks Online",
    statusUrl: "https://status.quickbooks.intuit.com/",
    parserHint: "statuspage",
    tags: ["SaaS", "Finance"],
  },
  {
    key: "netsuite",
    name: "Oracle NetSuite",
    statusUrl: "https://status.netsuite.com/",
    parserHint: "statuspage",
    tags: ["SaaS", "ERP", "Finance"],
  },
  {
    key: "fastly",
    name: "Fastly",
    statusUrl: "https://www.fastlystatus.com/",
    parserHint: "custom",
    tags: ["CDN", "Edge"],
  },
  {
    key: "akamai",
    name: "Akamai",
    statusUrl: "https://www.akamaistatus.com/",
    parserHint: "statuspage",
    tags: ["CDN", "Edge"],
  },
  {
    key: "veeam_datacloud",
    name: "Veeam Data Cloud",
    statusUrl: "https://vdcstatus.veeam.com/",
    parserHint: "custom",
    tags: ["Backup", "Data Protection"],
  },
  {
    key: "fireblocks",
    name: "Fireblocks",
    statusUrl: "https://status.fireblocks.com/",
    parserHint: "unknown",
    tags: ["Crypto", "Custody", "Payments"],
  },
];

export function dedupeVendorsByKey<T extends { key: string }>(vendors: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of vendors) {
    const k = (v.key || "").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}
