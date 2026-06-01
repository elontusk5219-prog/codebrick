import type { ArchEvent, NodeKind, NodeStatus, EdgeKind } from '../protocol/events';

export interface ModelNode {
  id: string;
  label: string;
  kind: NodeKind;
  status: NodeStatus;
  parent?: string;
  role?: string; // structural role (core/entry/mid/iso), assigned at render time
  layer?: string;
  facet?: string;
  lifecycle?: string;
  note?: string;
  ref?: string;
}

export interface ModelEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  dataShape?: string;
  label?: string;
  facet?: string;
}

export interface Model {
  nodes: ModelNode[];
  edges: ModelEdge[];
}

/** Fold an ordered event stream into the current graph state. Pure. */
export function buildModel(events: ArchEvent[]): Model {
  const nodes = new Map<string, ModelNode>();
  const edges: ModelEdge[] = [];
  const sorted = [...events].sort((a, b) => a.seq - b.seq);

  for (const ev of sorted) {
    if (ev.type === 'node.add') {
      const prev = nodes.get(ev.id);
      nodes.set(ev.id, {
        id: ev.id,
        label: ev.label,
        kind: ev.kind,
        status: ev.status ?? prev?.status ?? 'building',
        parent: ev.parent ?? prev?.parent,
        layer: ev.layer ?? prev?.layer,
        facet: ev.facet ?? prev?.facet,
        lifecycle: ev.lifecycle ?? prev?.lifecycle,
        note: ev.note ?? prev?.note,
        ref: ev.ref ?? prev?.ref,
      });
    } else if (ev.type === 'node.update') {
      const prev = nodes.get(ev.id);
      if (!prev) continue;
      nodes.set(ev.id, {
        ...prev,
        status: ev.status ?? prev.status,
        label: ev.label ?? prev.label,
        note: ev.note ?? prev.note,
        ref: ev.ref ?? prev.ref,
        lifecycle: ev.lifecycle ?? prev.lifecycle,
      });
    } else if (ev.type === 'edge.add') {
      const id = ev.id ?? `${ev.from}->${ev.to}#${edges.length}`;
      if (edges.some((e) => e.id === id)) continue;
      edges.push({
        id,
        from: ev.from,
        to: ev.to,
        kind: ev.kind,
        dataShape: ev.dataShape,
        label: ev.label,
        facet: ev.facet,
      });
    }
  }

  return { nodes: [...nodes.values()], edges };
}
