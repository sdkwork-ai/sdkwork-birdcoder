import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const workspaceYaml = fs.readFileSync(path.join(rootDir, 'pnpm-workspace.yaml'), 'utf8');
const runnerSource = fs.readFileSync(path.join(rootDir, 'scripts/run-h5-app-command.mjs'), 'utf8');

assert.match(
  workspaceYaml,
  /apps\/sdkwork-birdcoder-h5['"]/u,
  'pnpm workspace must include the H5 application root for CI typecheck/build filters.',
);
assert.equal(packageJson.scripts['h5:typecheck'], 'node scripts/run-h5-app-command.mjs typecheck');
assert.equal(packageJson.scripts['h5:build'], 'node scripts/run-h5-app-command.mjs build');
assert.match(
  runnerSource,
  /apps\/sdkwork-birdcoder-h5/u,
  'H5 app command runner must target the BirdCoder H5 application root.',
);

console.log('h5 app command runner contract passed.');
