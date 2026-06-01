import type { PositionedGraph, PositionedNode, PositionedEdge } from './layout';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const STATUS_CLASS: Record<string, string> = {
  planned: 'st-planned',
  building: 'st-building',
  done: 'st-done',
  refining: 'st-refining',
};

function label(n: PositionedNode, cx: number, cy: number): string {
  const main = `<text class="cb-tx" x="${cx}" y="${cy - 1}" text-anchor="middle">${esc(n.label)}</text>`;
  const sub = n.note
    ? `<text class="cb-txs" x="${cx}" y="${cy + 15}" text-anchor="middle">${esc(n.note)}</text>`
    : '';
  return main + sub;
}

function nodeShape(n: PositionedNode): string {
  const cls = `cb-node kind-${n.kind} role-${n.role ?? 'mid'} ${STATUS_CLASS[n.status] ?? ''}`;
  const cx = n.x + n.width / 2;
  const cy = n.y + n.height / 2;
  let shape: string;
  if (n.kind === 'decision') {
    const pts = [
      `${cx},${n.y}`,
      `${n.x + n.width},${cy}`,
      `${cx},${n.y + n.height}`,
      `${n.x},${cy}`,
    ].join(' ');
    shape = `<polygon class="${cls} dia" points="${pts}"/>`;
  } else {
    shape = `<rect class="${cls} bx" x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="9"/>`;
  }
  return `<g class="cb-hit" data-node="${esc(n.id)}">${shape}${label(n, cx, cy)}</g>`;
}

function edgePath(e: PositionedEdge): string {
  if (e.points.length < 2) return '';
  const d = e.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const dash = e.kind === 'control' ? ' ln-d' : '';
  const line = `<path class="cb-ln${dash} edge-${e.kind}" d="${d}" marker-end="url(#cb-arrow)"/>`;
  const txt = e.dataShape || e.label;
  if (!txt) return line;
  const mid = e.points[Math.floor(e.points.length / 2)];
  return `${line}<text class="cb-txb" x="${mid.x}" y="${mid.y - 6}" text-anchor="middle">${esc(txt)}</text>`;
}

/** Render a positioned graph to an SVG string in the blueprint vocabulary. Pure. */
export function renderSvg(graph: PositionedGraph): string {
  const pad = 28;
  const w = Math.max(graph.width + pad * 2, 240);
  const h = Math.max(graph.height + pad * 2, 160);
  const defs =
    `<defs><marker id="cb-arrow" markerWidth="12" markerHeight="11" refX="9" refY="4" orient="auto">` +
    `<path d="M0,0 L9,4 L0,8 Z" class="cb-arrowhead"/></marker></defs>`;
  const edges = graph.edges.map(edgePath).join('');
  const nodes = graph.nodes.map(nodeShape).join('');
  return (
    `<svg class="cb-canvas" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
    `${defs}<g transform="translate(${pad},${pad})">${edges}${nodes}</g></svg>`
  );
}
