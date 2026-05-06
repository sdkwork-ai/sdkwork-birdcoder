import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildStaticDocs,
  markdownToHtml,
  resolvePnpmCommand,
  runVitepress,
  writePublicDocsSearchIndex,
} from './run-vitepress.mjs';

assert.match(markdownToHtml('# Docs Home\n\n- Guide\n- API'), /<h1>Docs Home<\/h1>/);
assert.match(markdownToHtml('# Docs Home\n\n- Guide\n- API'), /<ul>/);
assert.match(markdownToHtml('## Section'), /<h2>Section<\/h2>/);
assert.match(resolvePnpmCommand(), /pnpm(?:\.cmd)?$/);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-vitepress-'));
const docsDir = path.join(tempRoot, 'docs');
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'index.md'), '# Home\n\n- Intro\n', 'utf8');
fs.writeFileSync(path.join(docsDir, 'guide.md'), '## Guide\n\nGuide body.\n', 'utf8');
fs.mkdirSync(path.join(docsDir, 'release'), { recursive: true });
fs.writeFileSync(path.join(docsDir, 'release', 'release-2026-05-06-01.md'), '# Internal Release\n\nDo not index.\n', 'utf8');
fs.mkdirSync(path.join(docsDir, 'superpowers'), { recursive: true });
fs.writeFileSync(path.join(docsDir, 'superpowers', 'plan.md'), '# Internal Plan\n\nDo not index.\n', 'utf8');
fs.mkdirSync(path.join(docsDir, 'step'), { recursive: true });
fs.writeFileSync(path.join(docsDir, 'step', '13-release.md'), '# Internal Step\n\nDo not index.\n', 'utf8');

buildStaticDocs(docsDir);

const builtIndexHtml = fs.readFileSync(
  path.join(docsDir, '.vitepress', 'dist', 'index.html'),
  'utf8',
);
const builtGuideHtml = fs.readFileSync(
  path.join(docsDir, '.vitepress', 'dist', 'guide.html'),
  'utf8',
);
const builtNotFoundHtml = fs.readFileSync(
  path.join(docsDir, '.vitepress', 'dist', '404.html'),
  'utf8',
);

assert.match(builtIndexHtml, /<h1>Home<\/h1>/);
assert.match(builtGuideHtml, /<h2>Guide<\/h2>/);
assert.match(builtNotFoundHtml, /<title>SDKWork BirdCoder Docs<\/title>/);
assert.match(builtNotFoundHtml, /<h1>Page not found<\/h1>/);
const searchIndexPath = path.join(docsDir, '.vitepress', 'dist', 'search-index.json');
const searchIndex = JSON.parse(fs.readFileSync(searchIndexPath, 'utf8'));
assert.ok(Array.isArray(searchIndex));
assert.deepEqual(
  searchIndex.map((entry) => entry.url).sort((left, right) => left.localeCompare(right)),
  ['/', '/guide'].sort((left, right) => left.localeCompare(right)),
);
assert.equal(
  searchIndex.some((entry) => String(entry.url ?? '').includes('/release/')),
  false,
  'public docs search index must not include internal release changelog pages',
);
assert.equal(
  searchIndex.some((entry) => String(entry.url ?? '').includes('/superpowers/')),
  false,
  'public docs search index must not include internal superpowers planning pages',
);
assert.equal(
  searchIndex.some((entry) => String(entry.url ?? '').includes('/step/')),
  false,
  'public docs search index must not include internal step runbooks',
);

const rewrittenSearchIndex = writePublicDocsSearchIndex(docsDir);
assert.equal(rewrittenSearchIndex.outputPath, searchIndexPath);
assert.equal(rewrittenSearchIndex.entries.length, 2);

const runnerInvocations = [];
const fallbackResult = runVitepress({
  command: 'build',
  docsDirArg: 'docs',
  cwd: tempRoot,
  runner(command, args) {
    runnerInvocations.push({
      command,
      args,
    });
    return {
      status: 1,
      error: null,
    };
  },
});

assert.equal(fallbackResult.mode, 'fallback-static');
assert.equal(fallbackResult.status, 0);
assert.equal(runnerInvocations[0]?.command, resolvePnpmCommand());
assert.deepEqual(
  runnerInvocations[0]?.args,
  ['exec', 'vitepress', 'build', 'docs'],
);

fs.rmSync(path.join(docsDir, '.vitepress', 'dist'), { recursive: true, force: true });
fs.mkdirSync(path.join(docsDir, '.vitepress', 'dist'), { recursive: true });
fs.writeFileSync(
  path.join(docsDir, '.vitepress', 'dist', 'index.html'),
  '<!doctype html><title>VitePress Docs</title>\n',
  'utf8',
);

const vitepressResult = runVitepress({
  command: 'build',
  docsDirArg: 'docs',
  cwd: tempRoot,
  runner() {
    return {
      status: 0,
      error: null,
    };
  },
});

assert.equal(vitepressResult.mode, 'vitepress');
assert.equal(vitepressResult.status, 0);
assert.equal(
  fs.existsSync(path.join(docsDir, '.vitepress', 'dist', '404.html')),
  true,
  'successful VitePress builds must be normalized with docs 404.html for release packaging',
);
assert.equal(
  fs.existsSync(path.join(docsDir, '.vitepress', 'dist', 'search-index.json')),
  true,
  'successful VitePress builds must be normalized with public search-index.json for release packaging',
);

console.log('run vitepress contract passed.');
