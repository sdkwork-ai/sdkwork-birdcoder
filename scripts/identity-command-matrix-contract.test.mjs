import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const workspacePackageJson = JSON.parse(
  fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'),
);

async function loadModule() {
  return import(
    pathToFileURL(
      path.join(workspaceRoot, 'scripts', 'birdcoder-identity-command-matrix.mjs'),
    ).href,
  );
}

test('birdcoder identity command matrix governs canonical scripts and alias passthroughs', async () => {
  const module = await loadModule();

  assert.equal(typeof module.createBirdcoderIdentityCommandMatrix, 'function');
  assert.equal(typeof module.createBirdcoderIdentityScriptCatalog, 'function');

  const matrix = module.createBirdcoderIdentityCommandMatrix();
  const commands = matrix.map((entry) => entry.command);

  assert.equal(matrix.length, 50);
  assert.equal(new Set(commands).size, matrix.length);
  assert.deepEqual(
    matrix.find((entry) => entry.command === 'desktop:env:local'),
    {
      command: 'desktop:env:local',
      identityMode: 'desktop-local',
      lifecycle: 'env',
      mode: 'local',
      providerKind: 'builtin-local',
      surface: 'desktop',
    },
  );
  assert.deepEqual(
    matrix.find((entry) => entry.command === 'server:doctor:cloud'),
    {
      command: 'server:doctor:cloud',
      identityMode: 'cloud-saas',
      lifecycle: 'doctor',
      mode: 'cloud',
      providerKind: 'sdkwork-cloud-app-api',
      surface: 'server',
    },
  );
  assert.ok(
    !matrix.some((entry) => entry.command === 'web:env:local'),
    'BirdCoder must not publish unsupported web local command variants.',
  );
  assert.ok(
    !matrix.some((entry) => entry.command === 'server:doctor:local'),
    'BirdCoder must not publish unsupported server local command variants.',
  );

  const scriptCatalog = module.createBirdcoderIdentityScriptCatalog();
  for (const [scriptName, command] of Object.entries(scriptCatalog)) {
    assert.equal(
      workspacePackageJson.scripts?.[scriptName],
      command,
      `package.json must keep ${scriptName} aligned with the canonical command matrix projection.`,
    );
  }

  assert.equal(
    workspacePackageJson.scripts?.dev,
    'node scripts/run-birdcoder-dev-stack.mjs web --identity-mode server-private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['dev:private'],
    'node scripts/run-birdcoder-dev-stack.mjs web --identity-mode server-private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['identity:show:web:private'],
    'node scripts/run-workspace-package-script.mjs . web:env:private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['identity:show:server:cloud'],
    'node scripts/run-workspace-package-script.mjs . server:env:cloud',
  );
  assert.equal(
    workspacePackageJson.scripts?.['package:web:cloud'],
    'node scripts/run-workspace-package-script.mjs . web:package:cloud',
  );
  assert.equal(
    workspacePackageJson.scripts?.['package:server:private'],
    'node scripts/run-workspace-package-script.mjs . server:package:private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['stack:web:private'],
    'node scripts/run-birdcoder-dev-stack.mjs web --identity-mode server-private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['stack:desktop:local'],
    'node scripts/run-birdcoder-dev-stack.mjs desktop --identity-mode desktop-local',
  );
});
