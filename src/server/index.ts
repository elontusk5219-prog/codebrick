import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { Registry } from './hub';
import { createHttpServer } from './http';

// The CodeBrick daemon: one long-lived process (launched by the menu-bar app)
// that holds every project's events and serves the canvas. Per-session MCP
// reporters forward their events here via POST /emit. No MCP/stdio here.

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.CODEBRICK_PORT || 4317);
const logDir = process.env.CODEBRICK_LOGDIR || resolve(process.cwd(), '.codebrick-logs');
const webRoot = process.env.CODEBRICK_WEBROOT || join(here, '..', 'web');

const registry = new Registry(Date.now, logDir);
const http = createHttpServer(registry, { webRoot });
http.server.listen(port, () => {
  console.error(`[codebrick daemon] canvas:  http://localhost:${port}`);
  console.error(`[codebrick daemon] log dir: ${logDir}`);
});
