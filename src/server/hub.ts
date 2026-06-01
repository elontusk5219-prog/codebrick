import { appendFile } from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ArchEvent, ArchEventInput } from '../protocol/events';

export type Subscriber = (event: ArchEvent) => void;

/**
 * One project's event store, kept deliberately thin: accept events → stamp
 * (ts, seq) → keep in memory → append to JSONL → broadcast to subscribers.
 */
export class EventHub {
  private log: ArchEvent[] = [];
  private seq = 0;
  private subscribers = new Set<Subscriber>();

  constructor(
    private logPath?: string,
    private now: () => number = Date.now,
  ) {
    if (logPath && existsSync(logPath)) {
      const lines = readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const ev = JSON.parse(line) as ArchEvent;
          this.log.push(ev);
          if (typeof ev.seq === 'number' && ev.seq > this.seq) this.seq = ev.seq;
        } catch {
          // skip a corrupt line, keep going
        }
      }
    }
  }

  async emit(inputs: ArchEventInput[]): Promise<ArchEvent[]> {
    const stamped: ArchEvent[] = inputs.map((input) => ({
      ...input,
      ts: this.now(),
      seq: ++this.seq,
    }));
    for (const ev of stamped) {
      this.log.push(ev);
      for (const sub of this.subscribers) sub(ev);
    }
    if (this.logPath) {
      const text = stamped.map((e) => JSON.stringify(e)).join('\n') + '\n';
      await appendFile(this.logPath, text, 'utf8');
    }
    return stamped;
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  getLog(): ArchEvent[] {
    return [...this.log];
  }

  get count(): number {
    return this.log.length;
  }
}

export interface ProjectSummary {
  id: string;
  label: string;
  events: number;
  lastTs: number;
}

function safeFile(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120) + '.jsonl';
}

/**
 * Multi-project registry: one EventHub per project, keyed by projectId.
 * The daemon multiplexes every session's events through this.
 */
export class Registry {
  private hubs = new Map<string, EventHub>();
  private labels = new Map<string, string>();
  private lastTs = new Map<string, number>();

  constructor(
    private now: () => number = Date.now,
    private logDir?: string,
  ) {
    if (!logDir) return;
    if (!existsSync(logDir)) {
      try { mkdirSync(logDir, { recursive: true }); } catch { /* ignore */ }
      return;
    }
    // Restore previously-seen projects from disk so they survive a restart.
    try {
      for (const file of readdirSync(logDir)) {
        if (!file.endsWith('.jsonl')) continue;
        const id = file.slice(0, -'.jsonl'.length);
        const log = this.hub(id).getLog();
        if (log.length) this.lastTs.set(id, log[log.length - 1].ts);
      }
    } catch { /* ignore */ }
  }

  private hub(projectId: string): EventHub {
    let h = this.hubs.get(projectId);
    if (!h) {
      const logPath = this.logDir ? join(this.logDir, safeFile(projectId)) : undefined;
      h = new EventHub(logPath, this.now);
      this.hubs.set(projectId, h);
      if (!this.labels.has(projectId)) this.labels.set(projectId, projectId);
    }
    return h;
  }

  async emit(projectId: string, label: string | undefined, inputs: ArchEventInput[]): Promise<ArchEvent[]> {
    const h = this.hub(projectId);
    if (label) this.labels.set(projectId, label);
    const out = await h.emit(inputs);
    if (out.length) this.lastTs.set(projectId, out[out.length - 1].ts);
    return out;
  }

  subscribe(projectId: string, fn: Subscriber): () => void {
    return this.hub(projectId).subscribe(fn);
  }

  getLog(projectId: string): ArchEvent[] {
    return this.hubs.get(projectId)?.getLog() ?? [];
  }

  listProjects(): ProjectSummary[] {
    return [...this.hubs.entries()]
      .map(([id, h]) => ({
        id,
        label: this.labels.get(id) ?? id,
        events: h.count,
        lastTs: this.lastTs.get(id) ?? 0,
      }))
      .sort((a, b) => b.lastTs - a.lastTs);
  }
}
