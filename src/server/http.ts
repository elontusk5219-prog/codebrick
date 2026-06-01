import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { WebSocketServer } from 'ws';
import { emitEnvelope } from '../protocol/events';
import type { Registry } from './hub';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export interface HttpHandle {
  server: Server;
  wss: WebSocketServer;
  close: () => Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function queryParam(url: string, key: string): string | undefined {
  const q = url.split('?')[1];
  if (!q) return undefined;
  for (const pair of q.split('&')) {
    const [k, v] = pair.split('=');
    if (decodeURIComponent(k) === key) return decodeURIComponent(v ?? '');
  }
  return undefined;
}

/**
 * Serves the canvas, ingests events (POST /emit, tagged by project), lists
 * active projects (GET /projects), and streams one project's events over
 * /ws?project=ID — replaying that project's history on connect.
 */
export function createHttpServer(registry: Registry, opts: { webRoot: string }): HttpHandle {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const urlPath = (req.url || '/').split('?')[0];

    if (req.method === 'POST' && urlPath === '/emit') {
      try {
        const raw = JSON.parse(await readBody(req));
        const env = emitEnvelope.parse(Array.isArray(raw) ? { events: raw } : raw);
        const stamped = await registry.emit(env.projectId, env.projectLabel, env.events);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: stamped.length, projectId: env.projectId }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
      return;
    }

    if (req.method === 'GET' && urlPath === '/projects') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ projects: registry.listProjects() }));
      return;
    }

    try {
      const rel =
        urlPath === '/'
          ? 'index.html'
          : normalize(urlPath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
      const filePath = join(opts.webRoot, rel);
      const data = await readFile(filePath);
      res.writeHead(200, {
        'content-type': MIME[extname(filePath)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    const project = queryParam(req.url || '', 'project') || 'default';
    ws.send(JSON.stringify({ type: 'init', project, events: registry.getLog(project) }));
    const unsub = registry.subscribe(project, (event) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'event', event }));
    });
    ws.on('close', unsub);
    ws.on('error', unsub);
  });

  return {
    server,
    wss,
    close: () =>
      new Promise<void>((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close();
        server.close(() => resolve());
      }),
  };
}
