# CodeBrick

Watch your architecture get built. While a coding agent (Claude Code) vibecodes,
it self-reports what it's building, and CodeBrick grows the architecture + pipeline
on a live blueprint canvas — node by node, edge by edge — with switchable
2D lenses and a timeline you can scrub to replay the whole construction.

Not a cute avatar tapping a keyboard. Not a static after-the-fact diagram. Not a
dependency graph. The system itself, materializing as it's built.

> See it in 30 seconds: `npm install && npm run build && npm start`, then in another
> shell `npm run seed`, and open http://localhost:4317 — watch the pipeline grow,
> switch lenses, scrub the timeline.

## How it works

```
each Claude Code session                     one long-lived daemon            browser canvas
  ┌───────────────────────┐                  ┌──────────────────────┐         ┌───────────────┐
  │ reporter (MCP stdio)  │ ──POST /emit──▶  │ Registry (per project)│ ──WS──▶ │ model → lens  │
  │  arch_emit, tagged by │  {projectId,     │ + JSONL log + replay  │ ?project│ → elk layout  │
  │  the session's cwd    │   events}        │ + HTTP/WS + /projects │         │ → SVG render  │
  └───────────────────────┘                  └──────────────────────┘         └───────────────┘
       (no port)              many ──▶ one          :4317                    switch projects
```

- **Reporter** (`dist/server/reporter.js`): a thin MCP server Claude Code spawns
  per session. Its `arch_emit` tool forwards events to the daemon, tagged with the
  session's project (its working directory). No port of its own, so any number of
  sessions run side by side.
- **Daemon** (`dist/server/index.js`): one long-lived process (launched by the
  menu-bar app, or `npm run daemon`). Holds every project's events in a `Registry`,
  appends per-project JSONL (restored on restart), serves the canvas, and lists
  active projects at `/projects`.
- **Browser**: holds the truth model — folds one project's event stream into a
  tagged graph, projects it onto the current lens (filter + layout), runs elkjs
  layout, renders SVG. A project switcher (fed by `/projects`) picks which session
  to watch and highlights the active one.

## Setup

```bash
npm install
npm run build      # bundles server -> dist/server, canvas -> dist/web
```

### 1. Start the daemon

Either launch the menu-bar app (`mac/`, see below), or run it directly:

```bash
npm run daemon     # serves the canvas + holds every project, on :4317
```

### 2. Wire the reporter into Claude Code (MCP)

Point the MCP server at the **reporter** — it forwards to the daemon, tagged by the
project you're in. Use `--scope user` so it's active in every project:

```bash
claude mcp add --scope user codebrick -- node /ABSOLUTE/PATH/TO/codebrick/dist/server/reporter.js
```

…or in `.mcp.json`:

```json
{
  "mcpServers": {
    "codebrick": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/codebrick/dist/server/reporter.js"],
      "env": { "CODEBRICK_PORT": "4317" }
    }
  }
}
```

### 3. Install the narrator skill

Copy `skills/architecture-narrator/` into your skills directory so the agent knows
to broadcast as it builds:

```bash
cp -r skills/architecture-narrator ~/.claude/skills/   # global, active everywhere
```

### 4. Open the canvas

Open the menu-bar app (click the icon to preview), or visit **http://localhost:4317**.
Every Claude Code session you run shows up as a project in the switcher — the one
currently working is marked active.

## Try it without an agent

```bash
npm start                # start the server standalone
npm run seed             # in another shell: feed a demo build sequence
# open http://localhost:4317 — watch it grow, switch lenses, scrub the timeline
```

You can also feed events over HTTP directly:

```bash
curl -X POST http://localhost:4317/emit -H 'content-type: application/json' \
  -d '{"events":[{"type":"node.add","id":"a","label":"Parser","kind":"stage"}]}'
```

## Menu-bar app (macOS)

`mac/` is a native menu-bar app (Swift/AppKit). It launches the daemon, shows a
`▦ CodeBrick` status item, and on click drops a popover with the canvas rendered
in a native vibrancy (glass) panel. Left-click = preview, right-click = quit.

```bash
swift build --package-path mac
./mac/.build/debug/CodeBrickMenuBar      # icon appears in the menu bar
```

## Lenses (V1)

- **管线 / 数据流** — pipeline stages, stores, externals, decisions + data edges (with data shapes)
- **构件 / 模块** — modules and stores + call/control edges

(Decision-logic and lifecycle lenses are V2 — pure front-end additions, no protocol change.)

## Config (env)

| var | default | meaning |
|---|---|---|
| `CODEBRICK_PORT` | `4317` | canvas + WS port |
| `CODEBRICK_LOG` | `./codebrick-events.jsonl` | event log (enables replay across restarts) |
| `CODEBRICK_WEBROOT` | `dist/web` next to the server | static files |

## Develop

```bash
npm test         # vitest: protocol, hub, http/ws, model, lenses, elk layout, svg render
npm run dev      # run server from TS (needs `npm run build` once for the canvas assets)
npm run typecheck
```

## Event protocol

See `src/protocol/events.ts` — the single contract both server and browser depend on.
`node.add` / `node.update` / `edge.add`, each carrying tags (`kind`, `status`,
`layer`, `facet`, `dataShape`, `ref`) that let the model be projected onto multiple
lenses.
