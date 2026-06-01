// Feeds a small generic "ingest pipeline" build sequence into a running
// CodeBrick server, one batch at a time, so you can watch the canvas grow.
// Demo / manual-verification only.
//   node scripts/seed.mjs            (default http://localhost:4317)
//   CODEBRICK_PORT=5000 node scripts/seed.mjs

const port = process.env.CODEBRICK_PORT || 4317;
const url = `http://localhost:${port}/emit`;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const steps = [
  [{ type: 'node.add', id: 'source', label: 'Data Source', kind: 'external', status: 'done' }],
  [{ type: 'node.add', id: 'ingest', label: 'Ingest', kind: 'stage', status: 'building', note: 'poll + buffer' },
   { type: 'edge.add', from: 'source', to: 'ingest', kind: 'data', dataShape: 'raw records' }],
  [{ type: 'node.update', id: 'ingest', status: 'done' },
   { type: 'node.add', id: 'parse', label: 'Parse', kind: 'stage', status: 'building' },
   { type: 'edge.add', from: 'ingest', to: 'parse', kind: 'data', dataShape: 'raw[]' }],
  [{ type: 'node.add', id: 'valid', label: 'Valid?', kind: 'decision', status: 'building', note: 'schema check' },
   { type: 'edge.add', from: 'parse', to: 'valid', kind: 'data', dataShape: 'parsed[]' }],
  [{ type: 'node.update', id: 'parse', status: 'done' },
   { type: 'node.add', id: 'transform', label: 'Transform', kind: 'stage', status: 'building', note: 'normalize' },
   { type: 'edge.add', from: 'valid', to: 'transform', kind: 'data', dataShape: 'ok records' }],
  [{ type: 'node.add', id: 'db', label: 'Database', kind: 'store', status: 'done', note: 'postgres' },
   { type: 'edge.add', from: 'transform', to: 'db', kind: 'data', dataShape: 'rows' }],
  [{ type: 'node.update', id: 'transform', status: 'done' },
   { type: 'node.update', id: 'valid', status: 'done' },
   { type: 'node.add', id: 'api', label: 'API', kind: 'external', status: 'done' },
   { type: 'edge.add', from: 'db', to: 'api', kind: 'data', dataShape: 'results' }],
  [{ type: 'node.add', id: 'scheduler', label: 'Scheduler', kind: 'module', status: 'done' },
   { type: 'node.add', id: 'worker', label: 'Worker', kind: 'module', status: 'done' },
   { type: 'edge.add', from: 'scheduler', to: 'worker', kind: 'call' },
   { type: 'edge.add', from: 'worker', to: 'db', kind: 'call' }],
];

for (const [i, events] of steps.entries()) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events }),
  });
  const json = await res.json();
  console.log(`step ${i + 1}/${steps.length}:`, json);
  await delay(700);
}
console.log('seed done');
