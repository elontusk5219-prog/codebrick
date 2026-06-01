import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/server/mcp';

describe('mcp server', () => {
  it('registers the arch_emit tool without throwing (validates SDK API surface)', () => {
    expect(() => createMcpServer(async (events) => events.length)).not.toThrow();
  });
});
