---
name: architecture-narrator
description: Use while implementing/building any software project when the CodeBrick MCP server (arch_emit tool) is available — narrate the architecture as you build so the CodeBrick canvas grows live. Trigger whenever you create a module/store/pipeline-stage, wire two parts together, or change a component's status.
---

# Architecture Narrator

You have an `arch_emit` MCP tool (from CodeBrick). As you build, **broadcast the architecture** so the user watches it form on a live blueprint canvas. The canvas is the user's window into what you're constructing — keep it honest and current.

## When to emit (natural build rhythm)

Emit at **meaningful milestones**, in the natural flow of work — NOT on a fixed cadence, and **never per line of code**:

- You created a new component → `node.add`
- You connected two components → `edge.add`
- A component went from being-built to finished, or you're reworking it → `node.update`

Batch related changes from one step into a **single** `arch_emit` call via the `events` array (e.g. "added the parser, wired it to the lexer, marked the lexer done" = one call, three events).

## Granularity

Report at **pipeline-stage / component granularity** — the level you'd draw on a whiteboard. Put the **data that flows** on data edges (`dataShape`). Do not report internal helper functions or every file.

## Event vocabulary

```
node.add     { id, label, kind, status?, layer?, note?, ref? }
node.update  { id, status?, label?, note?, ref? }
edge.add     { from, to, kind, dataShape?, label? }
```

- `kind`: `module` (code unit) · `store` (db/cache/file) · `external` (3rd-party/user) · `stage` (a pipeline step) · `decision` (a branch/routing point, drawn as a diamond)
- `status`: `planned` · `building` (default) · `done` · `refining`
- `edge.kind`: `data` (something flows; show it via `dataShape`) · `call` · `control`
- `ref` (optional): the file path or function the node maps to, e.g. `src/parser.ts`
- `id`: a short stable slug you reuse across events for the same component.

## Example

Building an ingestion pipeline, after finishing the fetcher and starting the transformer:

```
arch_emit({ events: [
  { "type": "node.update", "id": "fetch", "status": "done" },
  { "type": "node.add", "id": "transform", "label": "Transform", "kind": "stage", "status": "building", "note": "normalize + translate", "ref": "src/transform.ts" },
  { "type": "edge.add", "from": "fetch", "to": "transform", "kind": "data", "dataShape": "raw_signal[]" }
]})
```

## Rules

- Reuse the same `id` for a component across its lifetime — that's how the canvas updates it in place instead of duplicating.
- Mark `done` when a component actually works (tests pass / it runs), not when you start it.
- If you redesign something, emit `node.update` with `status: "refining"` and/or new `edges` — let the user see the architecture change, not just grow.
- Keep `label` short (it's a box on a diagram). Put detail in `note`.
