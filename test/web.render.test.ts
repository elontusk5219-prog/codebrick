import { describe, it, expect } from 'vitest';
import { renderSvg } from '../src/web/render';
import type { PositionedGraph } from '../src/web/layout';

const g: PositionedGraph = {
  width: 400,
  height: 200,
  nodes: [
    { id: 'a', label: 'Fetch', kind: 'stage', status: 'done', x: 0, y: 0, width: 190, height: 62, note: '2x/day' },
    { id: 'd', label: 'Link?', kind: 'decision', status: 'building', x: 250, y: 0, width: 190, height: 62 },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'd', kind: 'data', dataShape: 'raw[]', points: [{ x: 190, y: 31 }, { x: 250, y: 31 }] },
  ],
};

describe('renderSvg', () => {
  it('produces svg with node shapes, edge, label, dataShape, and status class', () => {
    const svg = renderSvg(g);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<rect');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('Fetch');
    expect(svg).toContain('raw[]');
    expect(svg).toContain('st-done');
    expect(svg).toContain('marker-end="url(#cb-arrow)"');
  });

  it('escapes angle brackets in labels (no injection)', () => {
    const svg = renderSvg({
      width: 200,
      height: 100,
      nodes: [{ id: 'x', label: '<script>', kind: 'module', status: 'done', x: 0, y: 0, width: 190, height: 62 }],
      edges: [],
    });
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).not.toContain('<script>');
  });
});
