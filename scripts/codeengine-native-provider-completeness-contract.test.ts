import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  BIRDCODER_STANDARD_ENGINE_IDS,
  listBirdCoderCodeEngineManifests,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/manifest.ts';
import { listBirdCoderCodeEngineNativeSessionProviders } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/catalog.ts';

import {
  readCanonicalServerRustSource,
  CANONICAL_CODEENGINE_RUST_PATHS,
} from './birdcoder-canonical-server-rust-sources.mjs';

const root = path.resolve(import.meta.dirname, '..');

const authorityBackedStandardEngineIds = listBirdCoderCodeEngineManifests()
  .filter((manifest) => manifest.descriptor.status === 'active')
  .filter((manifest) => manifest.nativeSession.authorityBacked)
  .map((manifest) => manifest.id);
const nativeProviderEngineIds = listBirdCoderCodeEngineNativeSessionProviders().map(
  (provider) => provider.engineId,
);

assert.deepEqual(
  authorityBackedStandardEngineIds,
  [...BIRDCODER_STANDARD_ENGINE_IDS],
  'All standard code engines must declare active authority-backed native session ownership.',
);

assert.deepEqual(
  nativeProviderEngineIds,
  authorityBackedStandardEngineIds,
  'Every authority-backed standard code engine must be exported as a server-ready native session provider.',
);

const adaptersSource = readFileSync(
  path.join(root, 'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/adapters.rs'),
  'utf8',
);
assert.match(adaptersSource, /BirdcoderKernelHost/);
assert.match(adaptersSource, /KernelBridgeCodeEngineProvider/);
assert.doesNotMatch(adaptersSource, /RegistryCodeEngineProvider/);

const kernelBridgeLib = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/src/lib.rs'),
  'utf8',
);
assert.match(kernelBridgeLib, /execute_kernel_turn|BirdcoderKernelHost/s);

for (const providerModule of [
  'codex_provider',
  'claude_code_provider',
  'gemini_provider',
  'opencode_provider',
]) {
  const source = readCanonicalServerRustSource(
    CANONICAL_CODEENGINE_RUST_PATHS[
      providerModule === 'codex_provider'
        ? 'codexProvider'
        : providerModule === 'claude_code_provider'
          ? 'claudeCodeProvider'
          : providerModule === 'gemini_provider'
            ? 'geminiProvider'
            : 'opencodeProvider'
    ],
  );
  assert.doesNotMatch(
    source,
    /fn\s+execute_turn\s*\(/,
    `${providerModule} must remain native-session inventory only.`,
  );
  assert.match(
    source,
    /NativeSessionProviderPlugin/,
    `${providerModule} must implement NativeSessionProviderPlugin.`,
  );
}

const libSource = readCanonicalServerRustSource(CANONICAL_CODEENGINE_RUST_PATHS.lib);
for (const moduleName of [
  'native_session',
  'native_session_catalog',
  'codeengine_dialect',
  'catalog',
]) {
  assert.match(
    libSource,
    new RegExp(`mod\\s+${moduleName};`),
    `Rust codeengine crate must keep ${moduleName} for BirdCoder-owned catalog and dialect surfaces.`,
  );
}

const nativeSessionCatalogSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-codeengine/src/native_session_catalog.rs'),
  'utf8',
);
assert.match(
  nativeSessionCatalogSource,
  /sessions\.sort_by\([\s\S]*?sort_timestamp[\s\S]*?then_with/,
  'Native session catalog must globally sort provider summaries before route pagination.',
);

const kernelRuntimeSource = readFileSync(
  path.join(
    root,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernelRuntime.ts',
  ),
  'utf8',
);
assert.match(kernelRuntimeSource, /birdcoder-kernel-turn/);
assert.match(kernelRuntimeSource, /sendCanonicalEvents/);

for (const removedPackage of [
  'sdkwork-birdcoder-pc-chat',
  'sdkwork-birdcoder-pc-chat-codex',
  'sdkwork-birdcoder-pc-chat-claude',
  'sdkwork-birdcoder-pc-chat-gemini',
  'sdkwork-birdcoder-pc-chat-opencode',
]) {
  assert.equal(
    existsSync(
      path.join(root, 'apps/sdkwork-birdcoder-pc/packages', removedPackage),
    ),
    false,
    `Retired pc-chat package ${removedPackage} must not remain in the workspace.`,
  );
}

console.log('codeengine native provider completeness contract passed.');
