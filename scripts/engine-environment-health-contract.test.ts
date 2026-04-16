import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createDetectedHealthReport,
  createStaticIntegrationDescriptor,
  resolveExecutablePresence,
  resolveFallbackRuntimeMode,
  resolvePackagePresence,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

const codexPackage = resolvePackagePresence({
  packageName: '@openai/codex-sdk',
  mirrorPackageJsonPath: 'external/codex/sdk/typescript/package.json',
});

assert.equal(codexPackage.installed, false);
assert.equal(codexPackage.mirrorVersion, '0.0.0-dev');

const opencodePackage = resolvePackagePresence({
  packageName: '@opencode-ai/sdk',
  mirrorPackageJsonPath: 'external/opencode/packages/sdk/js/package.json',
});

assert.equal(opencodePackage.installed, false);
assert.equal(opencodePackage.mirrorVersion, '1.4.1');

assert.equal(resolveFallbackRuntimeMode(['sdk-stream', 'cli-jsonl', 'json-rpc-v2']), 'headless');
assert.equal(resolveFallbackRuntimeMode(['sdk-stream', 'remote-control-http']), 'remote-control');
assert.equal(resolveFallbackRuntimeMode(['sdk-stream', 'openapi-http']), 'protocol-fallback');

const fakeBinDir = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-engine-path-'));
try {
  await writeFile(path.join(fakeBinDir, 'codex.cmd'), '@echo off\r\necho codex\r\n', 'utf8');

  assert.equal(
    resolveExecutablePresence('codex', {
      PATH: fakeBinDir,
      PATHEXT: '.CMD;.EXE',
    }),
    true,
  );
  assert.equal(
    resolveExecutablePresence('claude', {
      PATH: fakeBinDir,
      PATHEXT: '.CMD;.EXE',
    }),
    false,
  );
} finally {
  await rm(fakeBinDir, { recursive: true, force: true });
}

const codexIntegration = createStaticIntegrationDescriptor({
  engineId: 'codex',
  runtimeMode: 'sdk',
  transportKinds: ['sdk-stream', 'cli-jsonl', 'json-rpc-v2'],
  officialEntry: {
    packageName: '@openai/codex-sdk',
  },
});

const degradedHealth = createDetectedHealthReport({
  descriptor: codexIntegration,
  executable: 'codex',
  authEnvKeys: ['OPENAI_API_KEY'],
  packagePresence: codexPackage,
  cliAvailable: true,
  authConfigured: false,
});

assert.equal(degradedHealth.sdkAvailable, false);
assert.equal(degradedHealth.fallbackActive, true);
assert.equal(degradedHealth.runtimeMode, 'headless');
assert.equal(degradedHealth.status, 'degraded');
assert.equal(
  degradedHealth.diagnostics.some((line) => line.includes('@openai/codex-sdk')),
  true,
);

console.log('engine environment health contract passed.');
