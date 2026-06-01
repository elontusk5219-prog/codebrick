import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { EventHub, Registry } from '../src/server/hub';
import type { ArchEvent } from '../src/protocol/events';

function tmp(): string {
  return join(tmpdir(), `codebrick-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}.jsonl`);
}

describe('EventHub', () => {
  it('stamps ts and incrementing seq', async () => {
    const hub = new EventHub(undefined, () => 1234);
    const out = await hub.emit([
      { type: 'node.add', id: 'a', label: 'A', kind: 'stage' },
      { type: 'node.add', id: 'b', label: 'B', kind: 'stage' },
    ]);
    expect(out[0]).toMatchObject({ ts: 1234, seq: 1 });
    expect(out[1]).toMatchObject({ ts: 1234, seq: 2 });
  });

  it('notifies subscribers and stores the log', async () => {
    const hub = new EventHub();
    const seen: ArchEvent[] = [];
    hub.subscribe((e) => seen.push(e));
    await hub.emit([{ type: 'node.add', id: 'a', label: 'A', kind: 'stage' }]);
    expect(seen).toHaveLength(1);
    expect(hub.getLog()).toHaveLength(1);
  });

  it('unsubscribe stops delivery', async () => {
    const hub = new EventHub();
    const seen: ArchEvent[] = [];
    const off = hub.subscribe((e) => seen.push(e));
    off();
    await hub.emit([{ type: 'node.add', id: 'a', label: 'A', kind: 'stage' }]);
    expect(seen).toHaveLength(0);
  });

  it('persists to JSONL, reloads, and continues seq', async () => {
    const path = tmp();
    try {
      const hub1 = new EventHub(path);
      await hub1.emit([{ type: 'node.add', id: 'a', label: 'A', kind: 'stage' }]);
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path, 'utf8').trim().split('\n')).toHaveLength(1);

      const hub2 = new EventHub(path);
      expect(hub2.getLog()).toHaveLength(1);
      const out = await hub2.emit([{ type: 'node.add', id: 'b', label: 'B', kind: 'stage' }]);
      expect(out[0].seq).toBe(2);
      expect(hub2.getLog()).toHaveLength(2);
    } finally {
      if (existsSync(path)) rmSync(path);
    }
  });
});

describe('Registry (multi-project)', () => {
  const A = { type: 'node.add', id: 'a', label: 'A', kind: 'stage' } as const;
  const B = { type: 'node.add', id: 'b', label: 'B', kind: 'stage' } as const;

  it('keeps each project\'s log isolated', async () => {
    const reg = new Registry(() => 1);
    await reg.emit('p1', 'P1', [A, B]);
    await reg.emit('p2', 'P2', [A]);
    expect(reg.getLog('p1')).toHaveLength(2);
    expect(reg.getLog('p2')).toHaveLength(1);
    expect(reg.getLog('missing')).toHaveLength(0);
  });

  it('only notifies subscribers of their own project', async () => {
    const reg = new Registry();
    const seen: string[] = [];
    reg.subscribe('p1', (e) => seen.push(e.id));
    await reg.emit('p2', 'P2', [A]);
    await reg.emit('p1', 'P1', [B]);
    expect(seen).toEqual(['b']);
  });

  it('lists projects with labels and counts, most-recent first', async () => {
    let t = 0;
    const reg = new Registry(() => ++t);
    await reg.emit('p1', 'One', [A]);
    await reg.emit('p2', 'Two', [A, B]);
    const list = reg.listProjects();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('p2'); // most recent lastTs first
    expect(list[0]).toMatchObject({ label: 'Two', events: 2 });
  });

  it('restores projects from the log dir on restart', async () => {
    const dir = join(tmpdir(), `cb-reg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    try {
      const reg1 = new Registry(Date.now, dir);
      await reg1.emit('alpha', 'Alpha', [A, B]);
      const reg2 = new Registry(Date.now, dir); // simulate restart
      expect(reg2.getLog('alpha')).toHaveLength(2);
      expect(reg2.listProjects().find((p) => p.id === 'alpha')).toMatchObject({ events: 2 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('persists and restores non-ASCII (Chinese) names without collision', async () => {
    const dir = join(tmpdir(), `cb-reg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    try {
      const reg1 = new Registry(Date.now, dir);
      await reg1.emit('追女孩练习', undefined, [A]);
      await reg1.emit('乙女股神', undefined, [A, B]);
      const reg2 = new Registry(Date.now, dir);
      expect(reg2.getLog('追女孩练习')).toHaveLength(1); // would be 0 or merged if names collided
      expect(reg2.getLog('乙女股神')).toHaveLength(2);
      expect(reg2.listProjects().map((p) => p.id).sort()).toEqual(['乙女股神', '追女孩练习'].sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
