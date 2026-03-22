import { db } from './db';
import { dependencyEdges, dependencySuggestions, vendors, blockchainChains } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { SEED_EDGES } from './dependencyMapSeed';

export interface GraphNode {
  id: string;
  label: string;
  type: 'vendor' | 'blockchain';
  category: string;
  status: string;
  logoUrl: string | null;
  downstreamCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  confidence: number;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Seed the dependency_edges table from the hardcoded list (idempotent)
export async function seedDependencyEdges(): Promise<void> {
  const existing = await db.select({ id: dependencyEdges.id }).from(dependencyEdges).limit(1);
  if (existing.length > 0) return; // already seeded

  const rows = SEED_EDGES.map(e => ({
    upstreamId: e.upstreamId,
    upstreamType: e.upstreamType,
    downstreamId: e.downstreamId,
    downstreamType: e.downstreamType,
    relationship: e.relationship,
    confidence: e.confidence,
    notes: e.notes ?? null,
  }));

  await db.insert(dependencyEdges).values(rows);
  console.log(`[dependency-map] Seeded ${rows.length} dependency edges`);
}

export async function getGraph(): Promise<GraphResponse> {
  const [edges, allVendors, allChains] = await Promise.all([
    db.select().from(dependencyEdges),
    db.select({ key: vendors.key, name: vendors.name, status: vendors.status, logoUrl: vendors.logoUrl, category: vendors.category }).from(vendors),
    db.select({ key: blockchainChains.key, name: blockchainChains.name, status: blockchainChains.status, logoUrl: blockchainChains.logoUrl, category: blockchainChains.category }).from(blockchainChains),
  ]);

  // Build lookup maps
  const vendorMap = new Map(allVendors.map(v => [v.key, v]));
  const chainMap = new Map(allChains.map(c => [c.key, c]));

  // Collect all node IDs referenced in edges
  const nodeIds = new Set<string>();
  const nodeTypes = new Map<string, 'vendor' | 'blockchain'>();
  for (const e of edges) {
    nodeIds.add(e.upstreamId);
    nodeIds.add(e.downstreamId);
    nodeTypes.set(e.upstreamId, e.upstreamType as 'vendor' | 'blockchain');
    nodeTypes.set(e.downstreamId, e.downstreamType as 'vendor' | 'blockchain');
  }

  // Count downstream dependents per node (how many things depend on it)
  const downstreamCount = new Map<string, number>();
  for (const e of edges) {
    downstreamCount.set(e.upstreamId, (downstreamCount.get(e.upstreamId) || 0) + 1);
  }

  // Build nodes
  const nodes: GraphNode[] = Array.from(nodeIds).map(id => {
    const type = nodeTypes.get(id) || 'vendor';
    const info = type === 'vendor' ? vendorMap.get(id) : chainMap.get(id);
    return {
      id,
      label: info?.name || id,
      type,
      category: info?.category || (type === 'vendor' ? 'Other' : 'chain'),
      status: info?.status || 'operational',
      logoUrl: info?.logoUrl || null,
      downstreamCount: downstreamCount.get(id) || 0,
    };
  });

  // Build edges
  const graphEdges: GraphEdge[] = edges.map(e => ({
    id: e.id,
    source: e.upstreamId,
    target: e.downstreamId,
    relationship: e.relationship,
    confidence: e.confidence,
  }));

  return { nodes, edges: graphEdges };
}

export interface BlastRadiusResult {
  upstreamNode: GraphNode | null;
  affected: GraphNode[];
  severity: 'Low' | 'Medium' | 'High';
}

export async function getBlastRadius(upstreamId: string): Promise<BlastRadiusResult> {
  const { nodes, edges } = await getGraph();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // BFS/DFS to find all downstream nodes (things that depend on upstreamId, recursively)
  const visited = new Set<string>();
  const queue = [upstreamId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const e of edges) {
      if (e.source === current && !visited.has(e.target)) {
        visited.add(e.target);
        queue.push(e.target);
      }
    }
  }
  visited.delete(upstreamId);

  const affected = Array.from(visited).map(id => nodeMap.get(id)!).filter(Boolean);
  const count = affected.length;
  const severity: 'Low' | 'Medium' | 'High' = count >= 5 ? 'High' : count >= 2 ? 'Medium' : 'Low';

  return {
    upstreamNode: nodeMap.get(upstreamId) || null,
    affected,
    severity,
  };
}

export async function submitSuggestion(data: {
  upstreamId: string;
  upstreamType: string;
  downstreamId: string;
  downstreamType: string;
  relationship: string;
  notes?: string;
  submittedBy?: string;
}): Promise<void> {
  await db.insert(dependencySuggestions).values({
    upstreamId: data.upstreamId,
    upstreamType: data.upstreamType,
    downstreamId: data.downstreamId,
    downstreamType: data.downstreamType,
    relationship: data.relationship,
    notes: data.notes || null,
    submittedBy: data.submittedBy || null,
    status: 'pending',
  });
}

export async function getPendingSuggestions() {
  return db.select().from(dependencySuggestions).where(eq(dependencySuggestions.status, 'pending'));
}

export async function reviewSuggestion(id: string, action: 'approved' | 'rejected', reviewerUserId: string) {
  const [suggestion] = await db
    .select()
    .from(dependencySuggestions)
    .where(eq(dependencySuggestions.id, id))
    .limit(1);

  if (!suggestion) throw new Error('Suggestion not found');

  await db
    .update(dependencySuggestions)
    .set({ status: action, reviewedAt: new Date() })
    .where(eq(dependencySuggestions.id, id));

  // If approved, promote to a confirmed edge (confidence 3 = community)
  if (action === 'approved') {
    await db.insert(dependencyEdges).values({
      upstreamId: suggestion.upstreamId,
      upstreamType: suggestion.upstreamType,
      downstreamId: suggestion.downstreamId,
      downstreamType: suggestion.downstreamType,
      relationship: suggestion.relationship,
      confidence: 3,
      notes: suggestion.notes,
    });
  }
}
