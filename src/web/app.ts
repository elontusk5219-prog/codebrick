import { buildModel, type Model } from './model';
import { applyLens, focusModel, hasChildren, LENSES, type LensId, type LensGraph } from './lenses';
import { layout } from './layout';
import { renderSvg } from './render';
import type { ArchEvent } from '../protocol/events';

const params = new URLSearchParams(location.search);
const initialProject = params.get('project') || '';
let project = initialProject;
let focus: string | null = params.get('focus') || null; // null = overview; id = inside that module
let lens: LensId = 'pipeline';
let lastModel: Model = { nodes: [], edges: [] };
let events: ArchEvent[] = [];
let ws: WebSocket | null = null;
let autoLensPicked = false;

const $ = (id: string) => document.getElementById(id)!;
const canvas = $('canvas');
const lensBar = $('lensbar');
const counter = $('counter');
const status = $('status');
const projectSel = $('project') as HTMLSelectElement;
const back = $('back') as HTMLButtonElement;

function syncLensButtons() {
  for (const b of Array.from(lensBar.querySelectorAll('.lens-btn'))) {
    b.classList.toggle('active', (b as HTMLElement).dataset.lens === lens);
  }
}

function fitToView() {
  const svg = canvas.querySelector('svg') as SVGSVGElement | null;
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  if (!vb || !vb.width || !vb.height) return;
  const cw = canvas.clientWidth - 24;
  const ch = canvas.clientHeight - 24;
  const scale = Math.max(0.72, Math.min(cw / vb.width, ch / vb.height, 2.6));
  const w = vb.width * scale;
  const h = vb.height * scale;
  svg.style.width = Math.round(w) + 'px';
  svg.style.height = Math.round(h) + 'px';
  // Center vertically when it fits; otherwise top-align so you scroll from the top.
  svg.style.marginTop = h < ch ? Math.round((ch - h) / 2) + 'px' : '0px';
}

// Tag each node with a structural role (drives color): core = depended-on
// foundation, entry = top consumer, mid = in between, iso = isolated.
function annotateRoles(g: LensGraph) {
  const indeg = new Map<string, number>();
  const outdeg = new Map<string, number>();
  for (const n of g.nodes) { indeg.set(n.id, 0); outdeg.set(n.id, 0); }
  for (const e of g.edges) {
    if (outdeg.has(e.from)) outdeg.set(e.from, outdeg.get(e.from)! + 1);
    if (indeg.has(e.to)) indeg.set(e.to, indeg.get(e.to)! + 1);
  }
  for (const n of g.nodes) {
    const i = indeg.get(n.id)!;
    const o = outdeg.get(n.id)!;
    n.role = i > 0 && o === 0 ? 'core' : o > 0 && i === 0 ? 'entry' : i > 0 || o > 0 ? 'mid' : 'iso';
  }
}

let rendering = false;
let dirty = false;
async function rerender() {
  if (rendering) { dirty = true; return; }
  rendering = true;
  const model = buildModel(events);
  lastModel = model;
  const focused = focusModel(model, focus);
  if (!autoLensPicked && focused.nodes.length) {
    autoLensPicked = true;
    const pipeN = applyLens(focused, 'pipeline').nodes.length;
    const modN = applyLens(focused, 'module').nodes.length;
    const best: LensId = modN > pipeN ? 'module' : 'pipeline';
    if (best !== lens) { lens = best; syncLensButtons(); }
  }
  const lg = applyLens(focused, lens);
  annotateRoles(lg);
  const positioned = await layout(lg);
  canvas.innerHTML = positioned.nodes.length
    ? renderSvg(positioned)
    : '<div class="cb-empty">等待架构…</div>';
  if (positioned.nodes.length) fitToView();
  counter.textContent = `${lg.nodes.length} 节点 · ${lg.edges.length} 连线`;
  rendering = false;
  if (dirty) { dirty = false; void rerender(); }
}

// Lens switcher
for (const l of LENSES) {
  const btn = document.createElement('button');
  btn.textContent = l.label;
  btn.dataset.lens = l.id;
  btn.className = 'lens-btn' + (l.id === lens ? ' active' : '');
  btn.onclick = () => { lens = l.id; autoLensPicked = true; syncLensButtons(); void rerender(); };
  lensBar.appendChild(btn);
}

// Drill-down
function updateBack() {
  if (focus) { back.textContent = `← ${focus.split('/').pop()}`; back.style.display = ''; }
  else back.style.display = 'none';
}
back.onclick = () => {
  // Go up one level in the tree (to the parent of the current focus).
  focus = lastModel.nodes.find((n) => n.id === focus)?.parent ?? null;
  autoLensPicked = false;
  updateBack();
  void rerender();
};
canvas.addEventListener('click', (e) => {
  const hit = (e.target as Element).closest?.('[data-node]');
  if (!hit) return;
  const id = hit.getAttribute('data-node');
  if (id && hasChildren(lastModel, id)) {
    focus = id; autoLensPicked = false; updateBack(); void rerender();
  }
});

// Projects (repos)
async function refreshProjects() {
  try {
    const res = await fetch('/projects');
    const { projects } = (await res.json()) as { projects: { id: string; label: string; events: number; lastTs: number }[] };
    const activeId = projects.length && projects[0].events > 0 ? projects[0].id : '';
    projectSel.innerHTML = '';
    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = (p.id === activeId ? '🟢 ' : '') + (p.label || p.id);
      projectSel.appendChild(opt);
    }
    projectSel.style.display = projects.length ? '' : 'none';
    if (!project && projects.length) { project = activeId || projects[0].id; connect(project); }
    if (project) projectSel.value = project;
  } catch { /* server not ready */ }
}
projectSel.onchange = () => switchProject(projectSel.value);
function switchProject(p: string) {
  if (!p || p === project) return;
  project = p;
  events = [];
  focus = null;
  autoLensPicked = false;
  updateBack();
  connect(p);
  void rerender();
}

function connect(p: string) {
  if (ws) { try { ws.close(); } catch { /* ignore */ } ws = null; }
  if (!p) return;
  const sock = new WebSocket(`ws://${location.host}/ws?project=${encodeURIComponent(p)}`);
  ws = sock;
  sock.onopen = () => (status.textContent = '● 已连接');
  sock.onclose = () => {
    if (ws === sock) {
      status.textContent = '● 断开';
      setTimeout(() => { if (ws === sock || ws === null) connect(p); }, 3000);
    }
  };
  sock.onmessage = (msg) => {
    const data = JSON.parse(msg.data as string);
    if (data.type === 'init') events = data.events as ArchEvent[];
    else if (data.type === 'event') events.push(data.event as ArchEvent);
    void rerender();
  };
}

updateBack();
void refreshProjects();
setInterval(refreshProjects, 3000);
if (initialProject) connect(initialProject);
void rerender();
