---
name: codebrick-architect
description: Use when the user wants to see or understand a repo's architecture on the CodeBrick canvas ("map this repo", "show the architecture", "what does this codebase do"). You distill the codebase into a small conceptual mechanism diagram (like a whiteboard sketch) and emit it via the arch_emit tool. The AI here is THIS Claude Code session — no API key needed.
---

# CodeBrick Architect — distill a repo's architecture

Draw the **conceptual architecture** of the current repo on the CodeBrick canvas:
what the system *does* and how data flows through it — a whiteboard sketch, not a
file listing.

> **Architecture ≠ folders.** Do NOT mirror the directory tree. A `lib/` folder
> with 50 files is not "the architecture" — it's the file system. The architecture
> is the handful of meaningful stages, stores, boundaries, and decisions the system
> is actually built around. **Aim for ~6–15 nodes. Never one node per file.**

**Prerequisite:** the CodeBrick daemon must be running (the menu-bar app, or
`npm run daemon`). `arch_emit` forwards to it, tagged by your working directory —
so run this from the repo you're mapping.

## Process

1. **Understand what the system does.** Read the README, the entry points
   (`main`, `index`, server bootstrap, route registration), `package.json`
   scripts, and the few busiest/most-imported files. For a file map as a *hint*
   (not the answer), you may run `node <codebrick>/dist/analyzer/cli.js .` and look
   at which directories are load-bearing — but distill, don't transcribe.

2. **Find the conceptual pieces.** Ask: where does data enter? what stages does it
   pass through? where does it rest (stores)? what are the external boundaries
   (users, 3rd parties, other services)? what are the key decision/branch points?
   which piece is the keystone (break it and everything breaks)?

3. **Emit it** via `arch_emit`, using node kinds to carry meaning:
   - `stage` — a processing step in a flow (Ingest, Parse, Rank, Render)
   - `store` — data at rest (DB, cache, queue, event log)
   - `external` — a boundary (end user, 3rd-party API, another service)
   - `decision` — a routing/branching mechanism (drawn as a diamond)
   - `module` — a code component, when a structural view is more apt than a flow
   - Connect them with `data` edges and put **what flows** on `dataShape`
     (`raw_signal[]`, `JWT`, `Order`). Use `call`/`control` for non-data calls.
   - Mark the keystone in its `note` (e.g. `note: "命门 · 全流程对齐基准"`).

4. **Drill where it earns it.** If one stage hides an important mechanism (a
   scoring algorithm, an auth decision tree), emit child nodes for it (give them
   `parent: "<that stage's id>"`) so the user can drill in — like a sub-diagram.
   Don't drill folders; drill *mechanisms*.

## Example (an ingest service distilled to 6 nodes)

```
arch_emit({ events: [
  { "type":"node.add", "id":"src",   "label":"Sources",    "kind":"external", "status":"done" },
  { "type":"node.add", "id":"ingest","label":"Ingest",     "kind":"stage", "status":"done", "note":"poll + dedupe" },
  { "type":"node.add", "id":"norm",  "label":"Normalize",  "kind":"stage", "status":"done" },
  { "type":"node.add", "id":"valid", "label":"Valid?",     "kind":"decision", "status":"done", "note":"schema gate" },
  { "type":"node.add", "id":"db",    "label":"Event Store","kind":"store", "status":"done", "note":"命门 · 唯一真相" },
  { "type":"node.add", "id":"api",   "label":"Query API",  "kind":"external", "status":"done" },
  { "type":"edge.add", "from":"src",   "to":"ingest", "kind":"data", "dataShape":"raw events" },
  { "type":"edge.add", "from":"ingest","to":"norm",   "kind":"data", "dataShape":"raw[]" },
  { "type":"edge.add", "from":"norm",  "to":"valid",  "kind":"data", "dataShape":"record[]" },
  { "type":"edge.add", "from":"valid", "to":"db",     "kind":"data", "dataShape":"ok records" },
  { "type":"edge.add", "from":"db",    "to":"api",    "kind":"data", "dataShape":"results" }
]})
```

## Rules

- **Whiteboard-sized.** If you're emitting more than ~15 top-level nodes, you're
  transcribing the file tree — step back and aggregate to concepts.
- **Ground every node in real code** — open the files; don't invent a clean
  architecture the code doesn't have. If the code is a mess, the honest sketch
  shows that.
- Put the data structure on `data` edges. Name the keystone.
- Short labels (a box on a diagram); detail in `note`.
- Re-run to refresh after big changes.
