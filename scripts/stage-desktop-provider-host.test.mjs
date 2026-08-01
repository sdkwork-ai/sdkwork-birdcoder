import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  parseArgs,
  PROVIDER_WORKER_FILE_NAMES,
  resolveDesktopProviderTarget,
  stageDesktopProviderHost,
  validateProviderWorkerDependencyClosure,
} from './stage-desktop-provider-host.mjs';

const tempRootDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'birdcoder-desktop-provider-host-'),
);

function writeFixtureFile(filePath, contents = 'fixture\n') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function createFixture() {
  const kernelRootDir = path.join(tempRootDir, 'sdkwork-kernel');
  const workerDir = path.join(kernelRootDir, 'scripts', 'provider-transport-workers');
  for (const worker of PROVIDER_WORKER_FILE_NAMES) {
    writeFixtureFile(path.join(workerDir, worker), `// ${worker}\n`);
  }
  writeFixtureFile(
    path.join(workerDir, 'codex-app-server-runtime.mjs'),
    [
      "import './codex-app-server-live.mjs';",
      "import './codex-app-server-interactions.mjs';",
      "import './codex-app-server-host-requests.mjs';",
      '',
    ].join('\n'),
  );

  const desktopPackageDir = path.join(tempRootDir, 'desktop-package');
  writeFixtureFile(
    path.join(desktopPackageDir, 'package.json'),
    JSON.stringify({ name: '@fixture/birdcoder-desktop', private: true }),
  );
  const codexPackageDir = path.join(
    desktopPackageDir,
    'node_modules',
    '@openai',
    'codex',
  );
  writeFixtureFile(
    path.join(codexPackageDir, 'package.json'),
    JSON.stringify({
      name: '@openai/codex',
      version: '0.146.0',
      optionalDependencies: {
        '@openai/codex-win32-x64': 'npm:@openai/codex@0.146.0-win32-x64',
      },
    }),
  );
  const nativePackageDir = path.join(
    codexPackageDir,
    'node_modules',
    '@openai',
    'codex-win32-x64',
  );
  writeFixtureFile(
    path.join(nativePackageDir, 'package.json'),
    JSON.stringify({ name: '@openai/codex', version: '0.146.0-win32-x64' }),
  );
  const nativeRuntimeDir = path.join(
    nativePackageDir,
    'vendor',
    'x86_64-pc-windows-msvc',
  );
  writeFixtureFile(
    path.join(nativeRuntimeDir, 'codex-package.json'),
    JSON.stringify({
      entrypoint: 'bin/codex.exe',
      layoutVersion: 1,
      pathDir: 'codex-path',
      resourcesDir: 'codex-resources',
      target: 'x86_64-pc-windows-msvc',
      variant: 'codex',
      version: '0.146.0',
    }),
  );
  for (const relativePath of [
    'bin/codex.exe',
    'bin/codex-code-mode-host.exe',
    'codex-path/rg.exe',
    'codex-resources/codex-command-runner.exe',
    'codex-resources/codex-windows-sandbox-setup.exe',
  ]) {
    writeFixtureFile(path.join(nativeRuntimeDir, ...relativePath.split('/')), relativePath);
  }

  const nodeBinaryPath = path.join(tempRootDir, 'node-runtime', 'node.exe');
  const nodeLicensePath = path.join(tempRootDir, 'node-runtime', 'LICENSE');
  writeFixtureFile(nodeBinaryPath, 'fixture node binary');
  writeFixtureFile(nodeLicensePath, 'fixture Node.js license');

  return {
    desktopPackageDir,
    kernelRootDir,
    nodeBinaryPath,
    nodeLicensePath,
    outputRootDir: path.join(tempRootDir, 'artifacts', 'desktop-provider-host'),
    workerDir,
  };
}

try {
  assert.deepEqual(resolveDesktopProviderTarget({ platform: 'windows', arch: 'amd64' }), {
    arch: 'x64',
    codexExecutableRelativePath: 'bin/codex.exe',
    codexPackageName: '@openai/codex-win32-x64',
    nodeRelativePath: 'node/node.exe',
    platform: 'win32',
    targetTriple: 'x86_64-pc-windows-msvc',
  });
  assert.equal(
    resolveDesktopProviderTarget({ targetTriple: 'aarch64-apple-darwin' }).arch,
    'arm64',
  );
  assert.throws(
    () => resolveDesktopProviderTarget({ targetTriple: 'wasm32-unknown-unknown' }),
    /Unsupported desktop provider host target/u,
  );
  assert.deepEqual(
    parseArgs([
      '--target', 'x86_64-pc-windows-msvc',
      '--platform', 'win32',
      '--host-arch', 'x64',
      '--output-root', 'artifacts/provider',
    ]),
    {
      arch: 'x64',
      desktopPackageDir: '',
      kernelRootDir: '',
      nodeBinaryPath: '',
      nodeLicensePath: '',
      outputRootDir: 'artifacts/provider',
      platform: 'win32',
      targetTriple: 'x86_64-pc-windows-msvc',
    },
  );
  assert.throws(() => parseArgs(['--target']), /Missing value for --target/u);
  assert.throws(() => parseArgs(['--unknown']), /Unknown argument/u);

  const fixture = createFixture();
  const stageOptions = {
    arch: 'x64',
    desktopPackageDir: fixture.desktopPackageDir,
    kernelRootDir: fixture.kernelRootDir,
    nodeBinaryPath: fixture.nodeBinaryPath,
    nodeLicensePath: fixture.nodeLicensePath,
    nodeVersion: '22.20.0',
    outputRootDir: fixture.outputRootDir,
    platform: 'win32',
    targetTriple: 'x86_64-pc-windows-msvc',
  };
  const firstResult = stageDesktopProviderHost(stageOptions);
  assert.equal(firstResult.targetTriple, 'x86_64-pc-windows-msvc');
  assert.equal(path.basename(firstResult.hostDir), 'provider-host');
  const manifestText = fs.readFileSync(firstResult.manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.runtime, 'sdkwork-birdcoder-desktop-provider-host');
  assert.equal(manifest.node.version, '22.20.0');
  assert.equal(manifest.codex.version, '0.146.0');
  assert.equal(manifest.codex.nativePackage, '@openai/codex-win32-x64');
  assert.deepEqual(manifest.scope, {
    pythonRuntimeBundled: false,
    providerInstallerRuntimes: [],
    verifiedProviderHosts: ['codex'],
    verifiedProviderTransports: ['codex', 'hermes-agent'],
  });
  assert.deepEqual(
    manifest.workers,
    PROVIDER_WORKER_FILE_NAMES.map((worker) => `workers/${worker}`),
  );
  assert.deepEqual(
    manifest.files.map((entry) => entry.path),
    [...manifest.files.map((entry) => entry.path)].sort((left, right) => left.localeCompare(right)),
  );
  assert.ok(manifest.files.every((entry) => /^[a-f0-9]{64}$/u.test(entry.sha256)));
  assert.ok(manifest.files.every((entry) => !path.isAbsolute(entry.path)));
  assert.equal(manifestText.includes(tempRootDir), false);
  assert.equal(
    fs.readFileSync(
      path.join(firstResult.hostDir, 'node_modules', '.bin', 'codex.cmd'),
      'utf8',
    ),
    '@echo off\r\n"%~dp0..\\..\\codex\\x86_64-pc-windows-msvc\\bin\\codex.exe" %*\r\n',
  );

  writeFixtureFile(
    path.join(fixture.workerDir, 'engine-sdk-live.mjs'),
    '// updated engine-sdk-live.mjs\n',
  );
  const secondResult = stageDesktopProviderHost(stageOptions);
  assert.match(
    fs.readFileSync(path.join(secondResult.hostDir, 'workers', 'engine-sdk-live.mjs'), 'utf8'),
    /updated engine-sdk-live/u,
  );
  assert.deepEqual(
    fs.readdirSync(fixture.outputRootDir).filter((name) => name.startsWith('.provider-host-')),
    [],
  );

  const preservedManifest = fs.readFileSync(secondResult.manifestPath, 'utf8');
  fs.rmSync(path.join(fixture.workerDir, 'provider-cli-live.mjs'));
  assert.throws(
    () => stageDesktopProviderHost(stageOptions),
    /SDKWork Kernel provider worker provider-cli-live\.mjs is missing/u,
  );
  assert.equal(fs.readFileSync(secondResult.manifestPath, 'utf8'), preservedManifest);
  writeFixtureFile(
    path.join(fixture.workerDir, 'provider-cli-live.mjs'),
    '// restored provider-cli-live.mjs\n',
  );
  fs.rmSync(fixture.nodeLicensePath);
  assert.throws(
    () => stageDesktopProviderHost(stageOptions),
    /Node\.js license is missing/u,
  );
  assert.equal(fs.readFileSync(secondResult.manifestPath, 'utf8'), preservedManifest);
  writeFixtureFile(fixture.nodeLicensePath, 'fixture Node.js license');
  writeFixtureFile(
    path.join(fixture.workerDir, 'engine-sdk-live.mjs'),
    "import './unstaged-worker.mjs';\n",
  );
  assert.throws(
    () => validateProviderWorkerDependencyClosure(fixture.workerDir),
    /worker dependency is not staged: engine-sdk-live\.mjs -> \.\/unstaged-worker\.mjs/u,
  );

  const desktopPackage = JSON.parse(fs.readFileSync(
    path.resolve(
      'apps',
      'sdkwork-birdcoder-pc',
      'packages',
      'sdkwork-birdcoder-pc-desktop',
      'package.json',
    ),
    'utf8',
  ));
  for (const scriptName of ['start:desktop', 'start:desktop:check']) {
    assert.match(
      desktopPackage.scripts?.[scriptName] ?? '',
      /^node \.\.\/\.\.\/\.\.\/\.\.\/scripts\/stage-desktop-provider-host\.mjs && /u,
      `${scriptName} must self-heal the generated provider host before Tauri resolves resources`,
    );
  }

  console.log('desktop provider host staging contract passed.');
} finally {
  fs.rmSync(tempRootDir, { force: true, recursive: true });
}
