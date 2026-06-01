import { z } from 'zod';

// ── The contract. Server and browser both depend on this. ──────────────────

export const nodeKind = z.enum(['module', 'store', 'external', 'stage', 'decision']);
export const nodeStatus = z.enum(['planned', 'building', 'done', 'refining']);
export const edgeKind = z.enum(['data', 'call', 'control']);

export const nodeAddInput = z.object({
  type: z.literal('node.add'),
  id: z.string().min(1),
  label: z.string(),
  kind: nodeKind,
  status: nodeStatus.optional(),
  parent: z.string().optional(),
  layer: z.string().optional(),
  facet: z.string().optional(),
  lifecycle: z.string().optional(),
  note: z.string().optional(),
  ref: z.string().optional(),
});

export const nodeUpdateInput = z.object({
  type: z.literal('node.update'),
  id: z.string().min(1),
  status: nodeStatus.optional(),
  label: z.string().optional(),
  note: z.string().optional(),
  ref: z.string().optional(),
  lifecycle: z.string().optional(),
});

export const edgeAddInput = z.object({
  type: z.literal('edge.add'),
  id: z.string().optional(),
  from: z.string().min(1),
  to: z.string().min(1),
  kind: edgeKind,
  dataShape: z.string().optional(),
  label: z.string().optional(),
  facet: z.string().optional(),
});

export const archEventInput = z.discriminatedUnion('type', [
  nodeAddInput,
  nodeUpdateInput,
  edgeAddInput,
]);

export type NodeKind = z.infer<typeof nodeKind>;
export type NodeStatus = z.infer<typeof nodeStatus>;
export type EdgeKind = z.infer<typeof edgeKind>;

/** What an agent sends (no ts/seq — the hub stamps those). */
export type ArchEventInput = z.infer<typeof archEventInput>;

/** What gets stored and broadcast (stamped by the hub). */
export type ArchEvent = ArchEventInput & { ts: number; seq: number };

/** Validate arbitrary input into a typed event array, or throw a ZodError. */
export function validateEvents(input: unknown): ArchEventInput[] {
  return z.array(archEventInput).parse(input);
}

/** A batch of events tagged with the project they belong to. */
export const emitEnvelope = z.object({
  projectId: z.string().min(1).default('default'),
  projectLabel: z.string().optional(),
  events: z.array(archEventInput),
});

export type EmitEnvelope = z.infer<typeof emitEnvelope>;
