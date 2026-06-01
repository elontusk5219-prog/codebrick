import { describe, it, expect } from 'vitest';
import { layout } from '../src/web/layout';
import type { LensGraph } from '../src/web/lenses';

describe('layout (elkjs)', () => {
  it('assigns positions to nodes and polyline points to edges', async () => {
    const g: LensGraph = {
      lens: 'pipeline',
      direction: 'RIGHT',
      nodes: [
        { id: 'a', label: 'A', kind: 'stage', status: 'done' },
        { id: 'b', label: 'B', kind: 'stage', status: 'building' },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b', kind: 'data', dataShape: 'x[]' }],
    };
    const p = await layout(g);
    expect(p.nodes).toHaveLength(2);
    for (const n of p.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.width).toBeGreaterThan(0);
    }
    expect(p.edges[0].points.length).toBeGreaterThanOrEqual(2);
    const a = p.nodes.find((n) => n.id === 'a')!;
    const b = p.nodes.find((n) => n.id === 'b')!;
    expect(b.x).toBeGreaterThan(a.x); // RIGHT direction
  });

  it('handles an empty graph', async () => {
    const p = await layout({ lens: 'pipeline', direction: 'RIGHT', nodes: [], edges: [] });
    expect(p.nodes).toHaveLength(0);
  });
});
