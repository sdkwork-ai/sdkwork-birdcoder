import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const workspacePackageJson = JSON.parse(
  fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'),
);
const desktopPackageJson = JSON.parse(
  fs.readFileSync(
    path.join(workspaceRoot, 'apps', 'sdkwork-birdcoder-pc', 'packages', 'sdkwork-birdcoder-pc-desktop', 'package.json'),
    'utf8',
  ),
);
const webPackageJson = JSON.parse(
  fs.readFileSync(
    path.join(workspaceRoot, 'apps', 'sdkwork-birdcoder-pc', 'packages', 'sdkwork-birdcoder-pc-web', 'package.json'),
    'utf8',
  ),
);

async function loadModule() {
  return import(
    pathToFileURL(
      path.join(workspaceRoot, 'scripts', 'birdcoder-iam-command-matrix.mjs'),
    ).href,
  );
}

test('birdcoder IAM command matrix governs standard local, standalone, and cloud scripts', async () => {
  const module = await loadModule();

  assert.equal(typeof module.createBirdcoderIamCommandMatrix, 'function');
  assert.equal(typeof module.createBirdcoderIamScriptCatalog, 'function');

  const matrix = module.createBirdcoderIamCommandMatrix();
  const commands = matrix.map((entry) => entry.command);

  assert.equal(matrix.length, 35);
  assert.equal(new Set(commands).size, matrix.length);
  assert.ok(
    matrix.every((entry) => !Object.hasOwn(entry, 'identityMode')),
    'BirdCoder IAM command matrix must not preserve legacy identityMode fields.',
  );
  assert.ok(
    matrix.every((entry) => !Object.hasOwn(entry, 'providerKind')),
    'BirdCoder IAM command matrix must not preserve providerKind fields after removing application-level provider switching.',
  );
  assert.deepEqual(
    matrix.find((entry) => entry.command === 'check:env:desktop:local'),
    {
      command: 'check:env:desktop:local',
      iamMode: 'desktop-local',
      lifecycle: 'env',
      mode: 'local',
      surface: 'desktop',
    },
  );
  assert.deepEqual(
    matrix.find((entry) => entry.command === 'check:iam:server:cloud'),
    {
      command: 'check:iam:server:cloud',
      iamMode: 'cloud-saas',
      lifecycle: 'doctor',
      mode: 'cloud',
      surface: 'server',
    },
  );

  const matrixSource = fs.readFileSync(
    path.join(workspaceRoot, 'scripts', 'birdcoder-iam-command-matrix.mjs'),
    'utf8',
  );
  assert.doesNotMatch(
    matrixSource,
    /\bidentityMode\b|@sdkwork\/user-center-|sdkwork-appbase[\\/]|user-center-provider|external-user-center/u,
    'BirdCoder IAM command matrix must be local and must not import retired appbase user-center command metadata.',
  );
  assert.equal(
    workspacePackageJson.devDependencies?.['@sdkwork/user-center-core-pc-react']
      ?? workspacePackageJson.dependencies?.['@sdkwork/user-center-core-pc-react'],
    undefined,
    'BirdCoder root workspace must not declare @sdkwork/user-center-core-pc-react for command matrix generation.',
  );
  assert.ok(
    !matrix.some((entry) => entry.command === 'check:env:browser:local'),
    'BirdCoder must not publish unsupported web local command variants.',
  );
  assert.ok(
    !matrix.some((entry) => entry.command === 'check:iam:server:local'),
    'BirdCoder must not publish unsupported server local command variants.',
  );
  assert.ok(
    !matrix.some((entry) => entry.command.includes(':external')),
    'BirdCoder must not publish retired external-provider command variants.',
  );

  const scriptCatalog = module.createBirdcoderIamScriptCatalog();
  for (const [scriptName, command] of Object.entries(scriptCatalog)) {
    assert.equal(
      workspacePackageJson.scripts?.[scriptName],
      command,
      `package.json must keep ${scriptName} aligned with the canonical command matrix projection.`,
    );
  }

  for (const [scriptName, command] of Object.entries(workspacePackageJson.scripts ?? {})) {
    assert.equal(
      scriptName.includes(':external') || String(command).includes('external-user-center') || String(command).includes('--user-center-provider'),
      false,
      `package.json must not keep retired external IAM script ${scriptName}.`,
    );
  }

  assert.equal(
    workspacePackageJson.scripts?.dev,
    'pnpm dev:standalone',
  );
  assert.equal(
    workspacePackageJson.scripts?.['dev:browser:postgres:standalone'],
    'pnpm exec sdkwork-app dev --runtime-target browser --deployment-profile standalone',
  );
  assert.equal(
    workspacePackageJson.scripts?.['dev:browser:cloud'],
    'pnpm exec sdkwork-app dev --runtime-target browser --deployment-profile cloud',
  );
  assert.equal(
    workspacePackageJson.scripts?.['check:env:browser:standalone'],
    'node scripts/show-birdcoder-iam-env.mjs web-dev --iam-mode server-private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['check:env:server:cloud'],
    'node scripts/show-birdcoder-iam-env.mjs server-dev --iam-mode cloud-saas',
  );
  assert.equal(
    workspacePackageJson.scripts?.['release:package:browser:cloud'],
    'node scripts/run-birdcoder-web-command.mjs build --iam-mode cloud-saas && node scripts/web-bundle-budget.test.mjs',
  );
  assert.equal(
    workspacePackageJson.scripts?.['release:package:server:standalone'],
    'node scripts/run-birdcoder-server-command.mjs build --iam-mode server-private',
  );
  assert.equal(
    workspacePackageJson.scripts?.['dev:browser:standalone'],
    'pnpm exec sdkwork-app dev --runtime-target browser --deployment-profile standalone',
  );
  assert.equal(
    workspacePackageJson.scripts?.['dev:desktop:standalone'],
    'pnpm exec sdkwork-app dev --runtime-target desktop --deployment-profile standalone',
    'Root standalone desktop dev must delegate through the shared lifecycle facade.',
  );
  assert.equal(
    desktopPackageJson.scripts?.['dev:desktop:standalone'],
    'node ../../../../scripts/run-birdcoder-dev-stack.mjs desktop --iam-mode server-private',
    'Desktop package standalone dev must use the same stack entrypoint.',
  );
  assert.equal(
    webPackageJson.scripts?.['dev:browser:standalone'],
    'node ../../../../scripts/run-birdcoder-dev-stack.mjs web --iam-mode server-private',
    'Web package standalone dev must use the same stack entrypoint.',
  );
  assert.ok(matrix.every((entry) => entry.mode !== 'private' && !entry.command.includes(':private')));
});
