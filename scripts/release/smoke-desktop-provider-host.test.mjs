import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { sha256File } from '../sdkwork-utils-digest.mjs';

import {
  parseArgs,
  smokeDesktopProviderHost,
  validateDesktopProviderHost,
} from './smoke-desktop-provider-host.mjs';

const tempRootDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'birdcoder-provider-host-smoke-contract-'),
);
const hostRoot = path.join(tempRootDir, 'provider-host');
const workers = [
  'workers/generic-ts-sdk-worker.mjs',
  'workers/engine-sdk-live.mjs',
  'workers/codex-app-server-runtime.mjs',
  'workers/codex-app-server-live.mjs',
  'workers/codex-app-server-interactions.mjs',
  'workers/codex-app-server-host-requests.mjs',
  'workers/codex-cli-live.mjs',
  'workers/provider-cli-live.mjs',
  'workers/generic_python_sdk_worker.py',
];

function writeFixtureFile(relativePath, contents = `${relativePath}\n`) {
  const filePath = path.join(hostRoot, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
  return filePath;
}

function writeManifest() {
  const files = [
    'codex/x86_64-pc-windows-msvc/bin/codex.exe',
    'node/LICENSE',
    'node/node.exe',
    'node_modules/.bin/codex.cmd',
    ...workers,
  ].sort((left, right) => left.localeCompare(right));
  const manifest = {
    schemaVersion: 1,
    runtime: 'sdkwork-birdcoder-desktop-provider-host',
    targetTriple: 'x86_64-pc-windows-msvc',
    platform: 'win32',
    arch: 'x64',
    scope: {
      pythonRuntimeBundled: false,
      providerInstallerRuntimes: [],
      verifiedProviderHosts: ['codex'],
      verifiedProviderTransports: ['codex', 'hermes-agent'],
    },
    node: {
      binary: 'node/node.exe',
      license: 'node/LICENSE',
      version: '22.20.0',
    },
    codex: {
      executable: 'codex/x86_64-pc-windows-msvc/bin/codex.exe',
      launcher: 'node_modules/.bin/codex.cmd',
      nativePackage: '@openai/codex-win32-x64',
      nativePackageVersion: '0.146.0-win32-x64',
      package: '@openai/codex',
      version: '0.146.0',
    },
    workers,
    files: files.map((relativePath) => {
      const filePath = path.join(hostRoot, ...relativePath.split('/'));
      return {
        path: relativePath,
        sha256: sha256File(filePath),
        size: fs.statSync(filePath).size,
      };
    }),
  };
  fs.writeFileSync(
    path.join(hostRoot, 'runtime-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return manifest;
}

try {
  assert.deepEqual(parseArgs([]), {
    pythonBinary: '',
    hostRoot: '',
    timeoutMs: 30_000,
  });
  assert.deepEqual(
    parseArgs(['--host-root', 'fixture/provider-host', '--timeout-ms', '1200']),
    { hostRoot: 'fixture/provider-host', pythonBinary: '', timeoutMs: 1200 },
  );
  assert.throws(() => parseArgs(['--timeout-ms', '0']), /positive integer/u);
  assert.throws(() => parseArgs(['--unknown']), /Unknown argument/u);

  for (const worker of workers) {
    writeFixtureFile(worker);
  }
  writeFixtureFile('node/LICENSE', 'fixture Node.js license');
  writeFixtureFile('node/node.exe', 'fixture node');
  writeFixtureFile(
    'codex/x86_64-pc-windows-msvc/bin/codex.exe',
    'fixture codex',
  );
  writeFixtureFile(
    'node_modules/.bin/codex.cmd',
    '@echo off\r\nfixture codex %*\r\n',
  );
  writeManifest();

  const validated = validateDesktopProviderHost({
    hostRoot,
    sourceRoots: [path.join(tempRootDir, 'source-workspace')],
  });
  assert.equal(validated.manifest.files.length, workers.length + 4);
  assert.equal(validated.hostRoot, hostRoot);

  let observedWorkDir = null;
  let observedEnvironment = null;
  const result = await smokeDesktopProviderHost({
    hostRoot,
    sourceRoots: [path.join(tempRootDir, 'source-workspace')],
    timeoutMs: 2_000,
    workerPingRunner: async ({ cwd, env }) => {
      observedWorkDir = cwd;
      observedEnvironment = env;
      return {
        jsonrpc: '2.0',
        id: 1,
        result: {
          app_server_available: true,
          cli_available: true,
          ok: true,
          runtime_available: true,
          runtime_mode: 'app_server',
        },
      };
    },
    codexVersionRunner: async () => 'codex-cli 0.146.0',
    appServerRunner: async () => ({ initialized: true }),
    pythonWorkerPingRunner: async () => ({
      jsonrpc: '2.0',
      id: 1,
      result: {
        backend: 'python_process',
        ok: true,
        package: 'run_agent',
        package_resolved: false,
      },
    }),
  });
  assert.equal(result.appServerInitialized, true);
  assert.equal(result.codexVersion, 'codex-cli 0.146.0');
  assert.equal(result.ping.runtimeMode, 'app_server');
  assert.deepEqual(result.providerInstallerRuntimes, []);
  assert.deepEqual(result.verifiedProviderTransports, ['codex', 'hermes-agent']);
  assert.deepEqual(result.hermesTransport, {
    packageResolved: false,
    pythonRuntimeBundled: false,
    workerAvailable: true,
  });
  assert.equal(result.workDirectoryOutsideWorkspace, true);
  assert.ok(observedWorkDir);
  assert.equal(fs.existsSync(observedWorkDir), false);
  assert.equal(observedEnvironment.SDKWORK_AGENT_PROVIDER_HOST_ROOT, hostRoot);
  assert.equal(
    observedEnvironment.SDKWORK_AGENT_PYTHON_WORKER_SCRIPT,
    path.join(hostRoot, 'workers', 'generic_python_sdk_worker.py'),
  );
  assert.equal(
    observedEnvironment.PATH.split(path.delimiter)[0],
    path.join(hostRoot, 'node_modules', '.bin'),
  );

  await assert.rejects(
    smokeDesktopProviderHost({
      hostRoot,
      sourceRoots: [path.join(tempRootDir, 'source-workspace')],
      workerPingRunner: async () => ({
        result: {
          app_server_available: false,
          cli_available: true,
          ok: true,
          runtime_available: true,
          runtime_mode: 'sdk_cli',
        },
      }),
      codexVersionRunner: async () => 'codex-cli 0.146.0',
      appServerRunner: async () => ({ initialized: true }),
    }),
    /ping mismatch for app_server_available/u,
  );

  fs.appendFileSync(path.join(hostRoot, 'workers', 'engine-sdk-live.mjs'), 'tampered\n');
  assert.throws(
    () => validateDesktopProviderHost({ hostRoot }),
    /size mismatch/u,
  );

  console.log('desktop provider host smoke contract passed.');
} finally {
  fs.rmSync(tempRootDir, { force: true, recursive: true });
}
