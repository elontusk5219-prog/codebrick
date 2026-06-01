import { describe, it, expect } from 'vitest';
import { analyzeRepo, findGitRepos } from '../src/analyzer/analyze';

// Analyze this repo itself — a real, stable structure to assert against.
const events = analyzeRepo(process.cwd());
const nodeAdds = events.filter((e) => e.type === 'node.add') as { id: string; parent?: string }[];
const byId = new Map(nodeAdds.map((n) => [n.id, n]));
const allIds = new Set(nodeAdds.map((n) => n.id));
const edges = events.filter((e) => e.type === 'edge.add') as { from: string; to: string }[];

describe('analyzeRepo', () => {
  it('builds a directory tree (src at top, server nested under it)', () => {
    expect(byId.get('src')?.parent).toBeUndefined();
    expect(byId.get('src/server')?.parent).toBe('src');
  });

  it('parents files to their directory (drill-down data)', () => {
    expect(byId.get('src/server/hub.ts')?.parent).toBe('src/server');
  });

  it('derives file→file deps, e.g. imports of the protocol contract', () => {
    expect(edges.some((e) => e.to === 'src/protocol/events.ts')).toBe(true);
  });

  it('emits only edges between known nodes', () => {
    for (const e of edges) {
      expect(allIds.has(e.from)).toBe(true);
      expect(allIds.has(e.to)).toBe(true);
    }
  });
});

describe('findGitRepos', () => {
  it('finds this repository (it has a .git)', () => {
    expect(findGitRepos(process.cwd())).toContain(process.cwd());
  });
});
