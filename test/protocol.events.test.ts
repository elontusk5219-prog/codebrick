import { describe, it, expect } from 'vitest';
import { validateEvents, archEventInput } from '../src/protocol/events';

describe('protocol/events', () => {
  it('accepts a valid mixed event array', () => {
    const evs = validateEvents([
      { type: 'node.add', id: 'a', label: 'A', kind: 'stage' },
      { type: 'edge.add', from: 'a', to: 'b', kind: 'data', dataShape: 'x[]' },
      { type: 'node.update', id: 'a', status: 'done' },
    ]);
    expect(evs).toHaveLength(3);
    expect(evs[0].type).toBe('node.add');
  });

  it('rejects unknown node kind', () => {
    expect(() => validateEvents([{ type: 'node.add', id: 'a', label: 'A', kind: 'banana' }])).toThrow();
  });

  it('rejects node.add missing id', () => {
    expect(() => validateEvents([{ type: 'node.add', label: 'A', kind: 'stage' }])).toThrow();
  });

  it('rejects unknown event type', () => {
    expect(() => archEventInput.parse({ type: 'node.delete', id: 'a' })).toThrow();
  });
});
