import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { prepareProviderRuntimeAssets } from './prepare-provider-runtime-assets.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-provider-runtime-'));

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

try {
  const kernelRoot = path.join(tempRoot, 'sdkwork-kernel');
  const workerRoot = path.join(kernelRoot, 'scripts', 'provider-transport-workers');
  for (const workerFile of [
    'generic-ts-sdk-worker.mjs',
    'engine-sdk-live.mjs',
    'codex-cli-live.mjs',
    'provider-cli-live.mjs',
  ]) {
    writeFile(path.join(workerRoot, workerFile), `export const worker = '${workerFile}';\n`);
  }
  const nodeBinary = path.join(tempRoot, process.platform === 'win32' ? 'node.exe' : 'node');
  writeFile(nodeBinary, 'portable-node-binary\n');

  const result = prepareProviderRuntimeAssets({
    rootDir: tempRoot,
    kernelRoot,
    nodeBinary,
    nodeVersion: '22.17.0-test',
    targetPlatform: process.platform,
    targetArchitecture: process.arch,
  });

  assert.equal(fs.existsSync(result.manifestPath), true);
  assert.equal(result.manifest.kind, 'sdkwork.birdcoder.provider-runtime');
  assert.equal(result.manifest.node.version, '22.17.0-test');
  assert.equal(result.manifest.node.relativePath.includes('node'), true);
  assert.deepEqual(
    result.manifest.workers.map((entry) => entry.relativePath).sort(),
    [
      'workers/codex-cli-live.mjs',
      'workers/engine-sdk-live.mjs',
      'workers/generic-ts-sdk-worker.mjs',
      'workers/provider-cli-live.mjs',
    ],
  );
  assert.deepEqual(
    result.manifest.providers.map((provider) => provider.id),
    ['codex', 'claude-code', 'gemini-cli', 'opencode'],
  );
  assert.equal(result.manifest.providerExecution.bundledProviderExecutables, false);
  assert.equal(result.manifest.providerExecution.missingBehavior, 'fail-closed');
  assert.equal(
    result.manifest.providers.every((provider) => (
      provider.bundled === false
      && provider.executableDelivery === 'external-operator-dependency'
    )),
    true,
    'worker runtime assets must not claim that provider CLI executables are bundled',
  );
  assert.equal(
    JSON.stringify(result.manifest).includes(tempRoot.replaceAll('\\', '/')),
    false,
    'runtime manifest must not leak build-machine absolute paths',
  );
  for (const asset of [result.manifest.node, ...result.manifest.workers]) {
    assert.match(asset.sha256, /^[a-f0-9]{64}$/u);
    assert.ok(asset.size > 0);
    assert.equal(fs.existsSync(path.join(result.outputDir, asset.relativePath)), true);
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('provider runtime assets contract passed.');
