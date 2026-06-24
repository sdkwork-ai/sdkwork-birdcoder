import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const appDir = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app',
);

function lineCount(relativePath) {
  const source = fs.readFileSync(path.join(appDir, relativePath), 'utf8');
  return source.split(/\r?\n/u).length;
}

assert.ok(
  lineCount('BirdcoderApp.tsx') <= 40,
  'BirdcoderApp.tsx must remain a thin orchestrator after shell componentization.',
);
assert.ok(
  fs.existsSync(path.join(appDir, 'birdcoderAppContent.tsx')),
  'Shell workbench orchestration must live in birdcoderAppContent.tsx.',
);
assert.ok(
  fs.existsSync(path.join(appDir, 'birdcoderAppMainBody.tsx')),
  'Shell tab body rendering must live in birdcoderAppMainBody.tsx.',
);

console.log('birdcoder app shell componentization contract passed.');
