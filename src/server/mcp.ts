import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { archEventInput, type ArchEventInput } from '../protocol/events';

const DESCRIPTION = [
  'Broadcast one or more architecture events to the CodeBrick canvas as you build.',
  'Call this whenever you finish a meaningful step — created a module/store/pipeline-stage,',
  'wired two things together, or changed a component\'s status (building -> done, refining).',
  'Report at pipeline-stage granularity (and put the data shape on data edges); do NOT report',
  'per line of code. Batch related changes into one call via the events array.',
].join(' ');

/** Wires the arch_emit tool to an emit sink (a registry, or a forwarder to a daemon). */
export function createMcpServer(emit: (events: ArchEventInput[]) => Promise<number>): McpServer {
  const server = new McpServer({ name: 'codebrick', version: '0.1.0' });

  server.tool(
    'arch_emit',
    DESCRIPTION,
    { events: z.array(archEventInput) },
    async ({ events }) => {
      try {
        const n = await emit(events);
        return { content: [{ type: 'text', text: `ok: ${n} event(s) rendered on the canvas` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `warn: CodeBrick canvas not reachable (${String(e)})` }] };
      }
    },
  );

  return server;
}
