import { basename, resolve } from 'node:path';
import { analyzeRepo, findGitRepos } from './analyze';

// Analyze a git repo's structure and push it to the CodeBrick daemon as a project.
//   node dist/analyzer/cli.js /path/to/repo        # one repo
//   node dist/analyzer/cli.js --scan /path/to/dir  # every local git repo under dir

const port = process.env.CODEBRICK_PORT || '4317';
const daemonUrl = process.env.CODEBRICK_DAEMON || `http://localhost:${port}`;

async function push(repo: string): Promise<void> {
  const events = analyzeRepo(repo);
  const projectId = process.env.CODEBRICK_PROJECT || basename(repo);
  const modules = events.filter((e) => e.type === 'node.add' && !('parent' in e && (e as { parent?: string }).parent)).length;
  const res = await fetch(`${daemonUrl}/emit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId, projectLabel: projectId, events }),
  });
  console.error(`  + ${projectId}: ${modules} modules (${res.status})`);
}

if (process.argv[2] === '--scan') {
  const root = resolve(process.argv[3] || process.cwd());
  const repos = findGitRepos(root);
  console.error(`[codebrick analyze] scanning ${root} …`);
  for (const repo of repos) await push(repo);
  console.error(`[codebrick analyze] done: ${repos.length} repo(s) -> ${daemonUrl}`);
} else {
  const repo = resolve(process.argv[2] || process.cwd());
  await push(repo);
}
