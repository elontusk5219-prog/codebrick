import type { Model, ModelNode, ModelEdge } from './model';

export type LensId = 'pipeline' | 'module';

export interface LensGraph {
  lens: LensId;
  direction: 'RIGHT' | 'DOWN';
  nodes: ModelNode[];
  edges: ModelEdge[];
}

export const LENSES: { id: LensId; label: string }[] = [
  { id: 'pipeline', label: '管线' },
  { id: 'module', label: '模块' },
];

const PIPELINE_KINDS = new Set<ModelNode['kind']>(['stage', 'store', 'external', 'decision']);
const MODULE_KINDS = new Set<ModelNode['kind']>(['module', 'store']);

function keepEdges(edges: ModelEdge[], ids: Set<string>, kinds: Set<ModelEdge['kind']>): ModelEdge[] {
  return edges.filter((e) => kinds.has(e.kind) && ids.has(e.from) && ids.has(e.to));
}

/** Whether a node has drill-down children (other nodes whose parent is its id). */
export function hasChildren(model: Model, id: string): boolean {
  return model.nodes.some((n) => n.parent === id);
}

/**
 * Restrict the model to one drill level: the top level (focus === null → nodes
 * with no parent) or the inside of a directory (focus === id → its immediate
 * children). Leaf-level (file→file) edges are LIFTED to whichever visible node
 * contains each endpoint, so dependencies aggregate at every level. Pure.
 */
export function focusModel(model: Model, focus: string | null): Model {
  const visible = model.nodes.filter((n) => (focus === null ? !n.parent : n.parent === focus));
  const visibleIds = new Set(visible.map((n) => n.id));
  const parentById = new Map<string, string | undefined>(model.nodes.map((n) => [n.id, n.parent]));

  const cache = new Map<string, string | undefined>();
  function liftToVisible(id: string): string | undefined {
    if (cache.has(id)) return cache.get(id);
    let cur: string | undefined = id;
    while (cur !== undefined) {
      if (visibleIds.has(cur)) { cache.set(id, cur); return cur; }
      cur = parentById.get(cur);
    }
    cache.set(id, undefined);
    return undefined;
  }

  const seen = new Set<string>();
  const edges: ModelEdge[] = [];
  for (const e of model.edges) {
    const a = liftToVisible(e.from);
    const b = liftToVisible(e.to);
    if (!a || !b || a === b) continue;
    const key = `${a} ${b} ${e.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ ...e, id: key, from: a, to: b });
  }
  return { nodes: visible, edges };
}

/** Project the full tagged model onto one 2D lens (filter + layout direction). Pure. */
export function applyLens(model: Model, lens: LensId): LensGraph {
  if (lens === 'pipeline') {
    const nodes = model.nodes.filter((n) => PIPELINE_KINDS.has(n.kind));
    const ids = new Set(nodes.map((n) => n.id));
    return { lens, direction: 'DOWN', nodes, edges: keepEdges(model.edges, ids, new Set(['data'])) };
  }
  const nodes = model.nodes.filter((n) => MODULE_KINDS.has(n.kind));
  const ids = new Set(nodes.map((n) => n.id));
  return { lens, direction: 'DOWN', nodes, edges: keepEdges(model.edges, ids, new Set(['call', 'control'])) };
}
