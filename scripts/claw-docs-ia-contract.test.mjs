import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

for (const relativePath of [
  'docs/.vitepress/searchIndexPolicy.ts',
  'docs/core/architecture.md',
  'docs/core/packages.md',
  'docs/core/desktop.md',
  'docs/core/release-and-deployment.md',
  'docs/guide/getting-started.md',
  'docs/guide/application-modes.md',
  'docs/guide/install-and-deploy.md',
  'docs/guide/development.md',
  'docs/reference/api-reference.md',
  'docs/reference/commands.md',
  'docs/reference/environment.md',
  'docs/contributing/index.md',
]) {
  assert.ok(
    fs.existsSync(path.join(rootDir, relativePath)),
    `expected claw-style docs entry to exist: ${relativePath}`,
  );
}

const vitepressConfig = read('docs/.vitepress/config.mts');

assert.match(vitepressConfig, /text:\s*'Guide'/, 'docs nav must expose the Guide section');
assert.match(vitepressConfig, /text:\s*'Architecture'/, 'docs nav must expose the Architecture section');
assert.match(vitepressConfig, /text:\s*'API Reference'/, 'docs nav must expose the API Reference section');
assert.match(vitepressConfig, /text:\s*'Reference'/, 'docs nav must expose the Reference section');
assert.match(vitepressConfig, /text:\s*'Contributing'/, 'docs nav must expose the Contributing section');
assert.match(vitepressConfig, /localSearchOptions/, 'docs config must wire the local search policy');
assert.match(vitepressConfig, /publicDocsSrcExclude/, 'docs config must exclude internal-only docs from the public search index');
assert.match(vitepressConfig, /provider:\s*'local'/, 'docs config must use local search');
assert.match(vitepressConfig, /'\/guide\/'/, 'docs sidebar must expose the guide section');
assert.match(vitepressConfig, /'\/core\/'/, 'docs sidebar must expose the core section');
assert.match(vitepressConfig, /'\/reference\/'/, 'docs sidebar must expose the reference section');
assert.match(vitepressConfig, /'\/contributing\/'/, 'docs sidebar must expose the contributing section');
assert.match(vitepressConfig, /link:\s*'\/core\/architecture'/, 'docs config must use core/architecture as the canonical architecture page');
assert.match(vitepressConfig, /link:\s*'\/core\/packages'/, 'docs config must expose the canonical packages page');
assert.match(vitepressConfig, /link:\s*'\/core\/desktop'/, 'docs config must expose the canonical desktop page');
assert.match(vitepressConfig, /link:\s*'\/core\/release-and-deployment'/, 'docs config must expose the canonical release page');

console.log('claw docs information architecture contract passed.');
