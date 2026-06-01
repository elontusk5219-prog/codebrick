import { describe, it, expect } from 'vitest';
import { buildModel } from '../src/web/model';
import type { ArchEvent } from '../src/protocol/events';

function ev(partial: Record<string, unknown>, seq: number): ArchEvent {
  return { ts: seq, seq, ...partial } as ArchEvent;
}

describe('buildModel', () => {
  it('adds a node then merges an update', () => {
    const m = buildModel([
      ev({ type: 'node.add', id: 'a', label: 'A', kind: 'stage' }, 1),
      ev({ type: 'node.update', id: 'a', status: 'done', note: 'ok' }, 2),
    ]);
    expect(m.nodes).toHaveLength(1);
    expect(m.nodes[0]).toMatchObject({ id: 'a', status: 'done', note: 'ok' });
  });

  it('defaults status to building on add', () => {
    const m = buildModel([ev({ type: 'node.add', id: 'a', label: 'A', kind: 'stage' }, 1)]);
    expect(m.nodes[0].status).toBe('building');
  });

  it('ignores an update for an unknown node', () => {
    const m = buildModel([ev({ type: 'node.update', id: 'ghost', status: 'done' }, 1)]);
    expect(m.nodes).toHaveLength(0);
  });

  it('adds edges and folds events in seq order regardless of input order', () => {
    const m = buildModel([
      ev({ type: 'edge.add', from: 'a', to: 'b', kind: 'data', dataShape: 'x[]' }, 3),
      ev({ type: 'node.add', id: 'a', label: 'A', kind: 'stage' }, 1),
      ev({ type: 'node.add', id: 'b', label: 'B', kind: 'stage' }, 2),
    ]);
    expect(m.nodes).toHaveLength(2);
    expect(m.edges).toHaveLength(1);
    expect(m.edges[0].dataShape).toBe('x[]');
  });
});
