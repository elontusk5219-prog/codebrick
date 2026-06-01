import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp';
import type { ArchEventInput } from '../protocol/events';

// The CodeBrick reporter: a thin per-session MCP server. Claude Code spawns one
// per session (no port of its own); it forwards arch_emit events to the daemon,
// tagged with this session's project (its working directory).

/** Build a forwarder that POSTs events to the daemon under a given project. */
export function makeForwarder(daemonUrl: string, projectId: string, projectLabel?: string) {
  return async (events: ArchEventInput[]): Promise<number> => {
    const res = await fetch(`${daemonUrl}/emit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, projectLabel: projectLabel ?? projectId, events }),
    });
    if (!res.ok) throw new Error(`daemon responded ${res.status}`);
    const json = (await res.json()) as { count: number };
    return json.count;
  };
}

// Only run the stdio server when executed directly (not when imported by tests).
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  const port = process.env.CODEBRICK_PORT || '4317';
  const daemonUrl = process.env.CODEBRICK_DAEMON || `http://localhost:${port}`;
  const projectId = process.env.CODEBRICK_PROJECT || basename(process.cwd()) || 'default';

  const server = createMcpServer(makeForwarder(daemonUrl, projectId));
  await server.connect(new StdioServerTransport());
  console.error(`[codebrick reporter] project '${projectId}' -> ${daemonUrl}`);
}
