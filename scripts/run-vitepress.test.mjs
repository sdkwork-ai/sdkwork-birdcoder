import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildStaticDocs,
  markdownToHtml,
  resolvePnpmCommand,
  runVitepress,
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

buildStaticDocs(docsDir);

const builtIndexHtml = fs.readFileSync(
  path.join(docsDir, '.vitepress', 'dist', 'index.html'),
  'utf8',
);
const builtGuideHtml = fs.readFileSync(
  path.join(docsDir, '.vitepress', 'dist', 'guide.html'),
  'utf8',
);

assert.match(builtIndexHtml, /<h1>Home<\/h1>/);
assert.match(builtGuideHtml, /<h2>Guide<\/h2>/);

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

console.log('run vitepress contract passed.');
