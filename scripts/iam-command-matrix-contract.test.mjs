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

test('birdcoder IAM command matrix governs standard local, private, and cloud scripts', async () => {
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
    matrix.find((entry) => entry.command === 'desktop:env:local'),
    {
      command: 'desktop:env:local',
      iamMode: 'desktop-local',
      lifecycle: 'env',
      mode: 'local',
      surface: 'desktop',
    },
  );
  assert.deepEqual(
    matrix.find((entry) => entry.command === 'server:doctor:cloud'),
    {
      command: 'server:doctor:cloud',
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
    !matrix.some((entry) => entry.command === 'web:env:local'),
    'BirdCoder must not publish unsupported web local command variants.',
  );
  assert.ok(
    !matrix.some((entry) => entry.command === 'server:doctor:local'),
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
  assert.equal(
    workspacePackageJson.scripts?.['desktop:dev:private'],
    'node scripts/run-birdcoder-dev-stack.mjs desktop --iam-mode server-private',
    'Root desktop private dev must start the standardized server+client stack so http://127.0.0.1:10240 is listening before Tauri loads.',
  );
  assert.equal(
    workspacePackageJson.scripts?.['web:dev:private'],
    'node scripts/run-birdcoder-dev-stack.mjs web --iam-mode server-private',
    'Root web private dev must start the standardized server+client stack so appbase IAM QR APIs are reachable.',
  );
  assert.equal(
    workspacePackageJson.scripts?.['tauri:dev:private'],
    'node scripts/run-birdcoder-dev-stack.mjs desktop --iam-mode server-private',
    'Root tauri private dev must not launch only the client while BIRDCODER_API_BASE_URL points at the private local server.',
  );
  assert.equal(
    desktopPackageJson.scripts?.['tauri:dev:private'],
    'node ../../../../scripts/run-birdcoder-dev-stack.mjs desktop --iam-mode server-private',
    'Desktop package private dev must use the same stack entrypoint when launched from the package directory.',
  );
  assert.equal(
    webPackageJson.scripts?.dev,
    'node ../../../../scripts/run-birdcoder-dev-stack.mjs web --iam-mode server-private',
    'Web package default dev is server-private and must start the standardized server+client stack when launched from the package directory.',
  );
  assert.equal(
    webPackageJson.scripts?.['dev:private'],
    'node ../../../../scripts/run-birdcoder-dev-stack.mjs web --iam-mode server-private',
    'Web package private dev must use the same stack entrypoint when launched from the package directory.',
  );
});
