import { describe, it, expect } from 'vitest';
import { applyLens, focusModel, hasChildren } from '../src/web/lenses';
import type { Model } from '../src/web/model';

const model: Model = {
  nodes: [
    { id: 's1', label: 'fetch', kind: 'stage', status: 'done' },
    { id: 'st', label: 'store', kind: 'store', status: 'done' },
    { id: 'm1', label: 'Engine', kind: 'module', status: 'done' },
    { id: 'ex', label: 'feed', kind: 'external', status: 'done' },
  ],
  edges: [
    { id: 'e1', from: 's1', to: 'st', kind: 'data', dataShape: 'x[]' },
    { id: 'e2', from: 'm1', to: 'st', kind: 'call' },
    { id: 'e3', from: 'm1', to: 'ghost', kind: 'call' },
  ],
};

describe('applyLens', () => {
  it('pipeline keeps stage/store/external + data edges only', () => {
    const g = applyLens(model, 'pipeline');
    expect(g.direction).toBe('DOWN');
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['ex', 's1', 'st']);
    expect(g.edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('module keeps module/store + call edges, drops dangling edge', () => {
    const g = applyLens(model, 'module');
    expect(g.direction).toBe('DOWN');
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['m1', 'st']);
    expect(g.edges.map((e) => e.id)).toEqual(['e2']);
  });
});

const hierModel: Model = {
  nodes: [
    { id: 'server', label: 'server', kind: 'module', status: 'done' },
    { id: 'web', label: 'web', kind: 'module', status: 'done' },
    { id: 'server/hub', label: 'hub', kind: 'module', status: 'done', parent: 'server' },
    { id: 'server/http', label: 'http', kind: 'module', status: 'done', parent: 'server' },
  ],
  edges: [
    { id: 'm1', from: 'server', to: 'web', kind: 'call' }, // module-level
    { id: 'f1', from: 'server/http', to: 'server/hub', kind: 'call' }, // intra-server
  ],
};

describe('focusModel (drill-down + edge lifting)', () => {
  it('overview = top-level nodes; leaf edges lift to their top node', () => {
    const m = focusModel(hierModel, null);
    expect(m.nodes.map((n) => n.id).sort()).toEqual(['server', 'web']);
    expect(m.edges.map((e) => `${e.from}->${e.to}`)).toEqual(['server->web']);
  });

  it('focusing a directory shows its children + edges between them', () => {
    const m = focusModel(hierModel, 'server');
    expect(m.nodes.map((n) => n.id).sort()).toEqual(['server/http', 'server/hub']);
    expect(m.edges.map((e) => `${e.from}->${e.to}`)).toEqual(['server/http->server/hub']);
  });

  it('hasChildren reflects drillability', () => {
    expect(hasChildren(hierModel, 'server')).toBe(true);
    expect(hasChildren(hierModel, 'web')).toBe(false);
  });
});
