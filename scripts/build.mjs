import * as esbuild from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/web', { recursive: true });

// Node bundles (daemon + reporter + analyzer CLI): ESM, node_modules external.
await esbuild.build({
  entryPoints: ['src/server/index.ts', 'src/server/reporter.ts', 'src/analyzer/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outdir: 'dist',
  outbase: 'src',
  packages: 'external',
  banner: { js: '#!/usr/bin/env node' },
});

// Web bundle: browser, everything (incl. elkjs) bundled into one file.
await esbuild.build({
  entryPoints: ['src/web/app.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  outfile: 'dist/web/app.js',
});

await cp('src/web/index.html', 'dist/web/index.html');
await cp('src/web/styles.css', 'dist/web/styles.css');

console.log('build complete -> dist/');
