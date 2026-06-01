# CodeBrick

See your codebase's **architecture** — not its folders.

CodeBrick is a macOS menu-bar app + local daemon that renders software
architecture on a live blueprint canvas: a handful of meaningful stages, stores,
boundaries and decisions, with the data flowing between them — the kind of diagram
you'd sketch on a whiteboard, not a dump of the file tree.

> **Architecture ≠ folders.** A `lib/` with 50 files isn't an architecture — it's
> the file system. The architecture is the *intent*: what the system does and how
> data moves through it. CodeBrick gets that intent from a coding agent (which
> reads the code and distills it), and renders it cleanly — so it never degrades
> into a 200-node hairball.

## How it works

```
 Claude Code session                  one local daemon                browser canvas
 ┌──────────────────────┐             ┌──────────────────────┐        ┌──────────────┐
 │ reporter (MCP) OR     │ POST /emit  │ Registry (per project)│  WS    │ events →      │
 │ codebrick-architect   │ ──────────▶ │ + JSONL log + replay  │ ─────▶ │ model → lens  │
 │ distills the repo     │ {project,   │ + HTTP/WS + /projects │ ?proj  │ → elk layout  │
 │ via arch_emit         │  events}    └──────────────────────┘        │ → SVG         │
 └──────────────────────┘                  :4317                       └──────────────┘
```

- **The architecture comes from an agent**, not from parsing folders. Your own
  Claude Code reads the repo and emits a small conceptual diagram via the
  `arch_emit` tool (no API key — it's the session you're already in).
- **The daemon** is one long-lived process (the menu-bar app, or `npm run daemon`).
  It holds every project's events, persists per-project JSONL (restored on
  restart), serves the canvas, and lists projects at `/projects`.
- **The reporter** is a thin per-session MCP server that forwards `arch_emit` to
  the daemon, tagged by working directory — so concurrent sessions never collide.
- **The canvas** folds the event stream into a tagged graph, projects it onto a
  lens, runs elkjs layout, and renders SVG with native-glass styling.

## Two ways to get a diagram

| Skill | Use it to… |
|---|---|
| **`codebrick-architect`** | Map an **existing repo** — the agent reads it and distills the conceptual architecture (stages, stores, decisions, data flow, keystone). |
| **`architecture-narrator`** | Watch a **build happen** — the agent broadcasts the architecture as it writes code, live. |

(There's also a static `codebrick-analyze` CLI that produces a raw directory/import
map — handy as grounding for the agent or a quick "code map", but it's not the
architecture view.)

## Setup

```bash
npm install
npm run build      # bundles the daemon, reporter, analyzer, and the canvas
```

**1. Run the daemon** — open the menu-bar app (see below), or:

```bash
npm run daemon     # serves the canvas + holds every project, on :4317
```

**2. Wire the reporter into Claude Code** (so the agent can draw):

```bash
claude mcp add --scope user codebrick -- node /ABSOLUTE/PATH/TO/codebrick/dist/server/reporter.js
```

**3. Install the skills** so the agent knows how to distill/narrate:

```bash
cp -r skills/codebrick-architect skills/architecture-narrator ~/.claude/skills/
```

**4. Map a repo.** In a Claude Code session inside the repo, ask it to *"map this
repo's architecture with CodeBrick"*. It runs `codebrick-architect`, reads the
code, and the diagram appears on the canvas at **http://localhost:4317** (or in the
menu-bar popover). Every session shows up as a project in the switcher.

## Menu-bar app (macOS)

`mac/` is a native menu-bar app (Swift/AppKit). It launches the daemon, shows a
`▦` status item, and on click drops a glass popover with the canvas. Left-click =
preview, right-click = quit.

```bash
swift build --package-path mac
./mac/.build/debug/CodeBrickMenuBar
```

## The canvas

- **Lenses** — *pipeline* (data flow) and *module* (components), laid out
  top-to-bottom; the one with content is auto-selected.
- **Drill-down** — click a node to enter it and see its inner mechanism; the back
  button steps up a level.
- **Role coloring** — foundations (depended-on) amber, entries blue, middle green,
  isolated gray; status pulses while building.
- **Project switcher** — pick which repo/session to view; the active one is marked.
- **Replay** — the event log is append-only, so a build can be replayed.

## Try it without an agent

```bash
npm run daemon            # one shell
npm run seed              # another shell: feed a demo build sequence
# open http://localhost:4317
```

Or feed events over HTTP:

```bash
curl -X POST http://localhost:4317/emit -H 'content-type: application/json' \
  -d '{"projectId":"demo","events":[{"type":"node.add","id":"a","label":"Parser","kind":"stage"}]}'
```

## Develop

```bash
npm test          # vitest: protocol, hub/registry, http/ws, reporter, analyzer,
                  #          model, lenses, elk layout, svg render
npm run typecheck
```

## Tech

TypeScript · [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol)
· `ws` · `zod` · [elkjs](https://github.com/kieler/elkjs) · esbuild · vitest ·
Swift/AppKit (menu-bar shell). The event contract lives in
`src/protocol/events.ts`.

## License

MIT
