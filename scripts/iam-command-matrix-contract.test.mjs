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
      path.join(workspaceRoot, 'scripts', 'birdcoder-iam-command-matrix.mjs'),
    ).href,
  );
}

test('birdcoder IAM command matrix governs canonical scripts and alias passthroughs', async () => {
  const module = await loadModule();

  assert.equal(typeof module.createBirdcoderIamCommandMatrix, 'function');
  assert.equal(typeof module.createBirdcoderIamScriptCatalog, 'function');

  const matrix = module.createBirdcoderIamCommandMatrix();
  const commands = matrix.map((entry) => entry.command);

  assert.equal(matrix.length, 50);
  assert.equal(new Set(commands).size, matrix.length);
  assert.ok(
    matrix.every((entry) => !Object.hasOwn(entry, 'identityMode')),
    'BirdCoder IAM command matrix must not preserve legacy identityMode fields.',
  );
  assert.deepEqual(
    matrix.find((entry) => entry.command === 'desktop:env:local'),
    {
      command: 'desktop:env:local',
      iamMode: 'desktop-local',
      lifecycle: 'env',
      mode: 'local',
      providerKind: 'builtin-local',
      surface: 'desktop',
    },
  );

  const matrixSource = fs.readFileSync(
    path.join(workspaceRoot, 'scripts', 'birdcoder-iam-command-matrix.mjs'),
    'utf8',
  );
  assert.doesNotMatch(
    matrixSource,
    /\bidentityMode\b/u,
    'BirdCoder must consume appbase iamMode directly instead of carrying an identityMode adapter.',
  );
  assert.doesNotMatch(
    matrixSource,
    /\bidentity passthrough alias\b/iu,
    'BirdCoder IAM command matrix comments must not preserve retired identity-mode wording.',
  );
  assert.match(
    matrixSource,
    /from ['"]@sdkwork\/user-center-core-pc-react['"]/u,
    'BirdCoder IAM command matrix must consume appbase user-center command metadata through the canonical package root.',
  );
  assert.equal(
    workspacePackageJson.devDependencies?.['@sdkwork/user-center-core-pc-react']
      ?? workspacePackageJson.dependencies?.['@sdkwork/user-center-core-pc-react'],
    'workspace:*',
    'BirdCoder root workspace must declare @sdkwork/user-center-core-pc-react so Node scripts consume the appbase package root.',
  );
  assert.doesNotMatch(
    matrixSource,
    /sdkwork-appbase[\\/]/u,
    'BirdCoder IAM command matrix must not import sdkwork-appbase scripts through relative filesystem paths.',
  );
  assert.deepEqual(
    matrix.find((entry) => entry.command === 'server:doctor:cloud'),
    {
      command: 'server:doctor:cloud',
      iamMode: 'cloud-saas',
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

  const scriptCatalog = module.createBirdcoderIamScriptCatalog();
  for (const [scriptName, command] of Object.entries(scriptCatalog)) {
    assert.equal(
      workspacePackageJson.scripts?.[scriptName],
      command,
      `package.json must keep ${scriptName} aligned with the canonical command matrix projection.`,
    );
  }

  assert.equal(
    workspacePackageJson.scripts?.dev,
    'node scripts/run-birdcoder-dev-stack.mjs web --iam-mode server-private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['dev:private'],
    'node scripts/run-birdcoder-dev-stack.mjs web --iam-mode server-private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['iam:show:web:private'],
    'node scripts/run-workspace-package-script.mjs . web:env:private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['iam:show:server:cloud'],
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
    'node scripts/run-birdcoder-dev-stack.mjs web --iam-mode server-private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['stack:desktop:local'],
    'node scripts/run-birdcoder-dev-stack.mjs desktop --iam-mode desktop-local',
  );
});
