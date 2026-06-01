import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { Registry } from '../src/server/hub';
import { createHttpServer, type HttpHandle } from '../src/server/http';

const webRoot = join(process.cwd(), 'src', 'web');
let handle: HttpHandle | null = null;

afterEach(async () => {
  if (handle) {
    await handle.close();
    handle = null;
  }
});

function listen(registry: Registry): Promise<number> {
  handle = createHttpServer(registry, { webRoot });
  return new Promise((resolve) =>
    handle!.server.listen(0, () => resolve((handle!.server.address() as AddressInfo).port)),
  );
}

/** Buffer messages so none are lost between 'open' and a later read. */
function reader(ws: WebSocket): () => Promise<any> {
  const queue: any[] = [];
  const waiters: ((m: any) => void)[] = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    const w = waiters.shift();
    if (w) w(m);
    else queue.push(m);
  });
  return () =>
    new Promise((resolve) => {
      const m = queue.shift();
      if (m !== undefined) resolve(m);
      else waiters.push(resolve);
    });
}

const A = { type: 'node.add', id: 'a', label: 'A', kind: 'stage' } as const;
const B = { type: 'node.add', id: 'b', label: 'B', kind: 'stage' } as const;

describe('http server (multi-project)', () => {
  it('replays a project history then streams new events over /ws?project', async () => {
    const reg = new Registry();
    await reg.emit('p1', 'P1', [A]);
    const port = await listen(reg);

    const ws = new WebSocket(`ws://localhost:${port}/ws?project=p1`);
    const next = reader(ws);
    await new Promise((r) => ws.once('open', r));

    const init = await next();
    expect(init.type).toBe('init');
    expect(init.project).toBe('p1');
    expect(init.events).toHaveLength(1);

    await reg.emit('p1', 'P1', [B]);
    const ev = await next();
    expect(ev.type).toBe('event');
    expect(ev.event.id).toBe('b');
    ws.close();
  });

  it('keeps projects isolated on the WS stream', async () => {
    const reg = new Registry();
    const port = await listen(reg);
    const ws = new WebSocket(`ws://localhost:${port}/ws?project=p1`);
    const next = reader(ws);
    await new Promise((r) => ws.once('open', r));
    await next(); // init

    await reg.emit('p2', 'P2', [A]); // other project — should NOT arrive
    await reg.emit('p1', 'P1', [B]); // our project — should arrive
    const ev = await next();
    expect(ev.event.id).toBe('b'); // first (and only) streamed event is p1's
    ws.close();
  });

  it('POST /emit accepts an envelope with projectId', async () => {
    const reg = new Registry();
    const port = await listen(reg);
    const res = await fetch(`http://localhost:${port}/emit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'svc', projectLabel: 'My Service', events: [A] }),
    });
    expect(await res.json()).toMatchObject({ ok: true, count: 1, projectId: 'svc' });
    expect(reg.getLog('svc')).toHaveLength(1);
  });

  it('POST /emit accepts a bare event array (default project)', async () => {
    const reg = new Registry();
    const port = await listen(reg);
    const res = await fetch(`http://localhost:${port}/emit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([A]),
    });
    expect(await res.json()).toMatchObject({ ok: true, projectId: 'default' });
    expect(reg.getLog('default')).toHaveLength(1);
  });

  it('GET /projects lists projects with summaries', async () => {
    const reg = new Registry();
    await reg.emit('p1', 'Project One', [A, B]);
    await reg.emit('p2', 'Project Two', [A]);
    const port = await listen(reg);
    const res = await fetch(`http://localhost:${port}/projects`);
    const { projects } = await res.json();
    expect(projects).toHaveLength(2);
    const p1 = projects.find((p: any) => p.id === 'p1');
    expect(p1).toMatchObject({ label: 'Project One', events: 2 });
  });

  it('serves index.html at /', async () => {
    const port = await listen(new Registry());
    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('CodeBrick');
  });
});
