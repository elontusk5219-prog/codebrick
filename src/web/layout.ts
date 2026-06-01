import ELK from 'elkjs/lib/elk.bundled.js';
import type { LensGraph } from './lenses';
import type { ModelNode, ModelEdge } from './model';

export interface PositionedNode extends ModelNode {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PositionedEdge extends ModelEdge {
  points: { x: number; y: number }[];
}
export interface PositionedGraph {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const elk: any = new (ELK as any)();
const NODE_W = 200;
const NODE_H = 70;

/** Run elkjs layered layout over a lens graph; returns absolute positions + edge polylines. */
export async function layout(graph: LensGraph): Promise<PositionedGraph> {
  if (graph.nodes.length === 0) {
    return { width: 0, height: 0, nodes: [], edges: [] };
  }

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': graph.direction,
      'elk.spacing.nodeNode': '28',
      'elk.layered.spacing.nodeNodeBetweenLayers': '54',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.compaction.postCompaction.strategy': 'LEFT',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '34',
      'elk.aspectRatio': '0.7',
    },
    children: graph.nodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
    edges: graph.edges.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
  };

  const res = await elk.layout(elkGraph);

  const posById = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const c of res.children ?? []) {
    posById.set(c.id, { x: c.x ?? 0, y: c.y ?? 0, width: c.width ?? NODE_W, height: c.height ?? NODE_H });
  }
  const nodes: PositionedNode[] = graph.nodes.map((n) => ({
    ...n,
    ...(posById.get(n.id) ?? { x: 0, y: 0, width: NODE_W, height: NODE_H }),
  }));

  const edgeById = new Map(graph.edges.map((e) => [e.id, e] as const));
  const edges: PositionedEdge[] = (res.edges ?? []).map((re: any) => {
    const orig = edgeById.get(re.id)!;
    const points: { x: number; y: number }[] = [];
    for (const sec of re.sections ?? []) {
      points.push(sec.startPoint);
      for (const bp of sec.bendPoints ?? []) points.push(bp);
      points.push(sec.endPoint);
    }
    return { ...orig, points };
  });

  return { width: res.width ?? 0, height: res.height ?? 0, nodes, edges };
}
