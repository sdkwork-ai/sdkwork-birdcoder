import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  BIRDCODER_STANDARD_ENGINE_IDS,
  listBirdCoderCodeEngineManifests,
  listBirdCoderCodeEngineNativeSessionProviders,
} from '../packages/sdkwork-birdcoder-codeengine/src/manifest.ts';

const codeengineHostSourceDirectory = fileURLToPath(
  new URL('../packages/sdkwork-birdcoder-codeengine/src-host/src/', import.meta.url),
);
const providerSourcePath = new URL(
  '../packages/sdkwork-birdcoder-codeengine/src-host/src/provider.rs',
  import.meta.url,
);
const libSourcePath = new URL(
  '../packages/sdkwork-birdcoder-codeengine/src-host/src/lib.rs',
  import.meta.url,
);
const productionAdapterSourcePaths = [
  new URL('../packages/sdkwork-birdcoder-chat-claude/src/index.ts', import.meta.url),
  new URL('../packages/sdkwork-birdcoder-chat-gemini/src/index.ts', import.meta.url),
  new URL('../packages/sdkwork-birdcoder-chat-opencode/src/index.ts', import.meta.url),
];

const authorityBackedStandardEngineIds = listBirdCoderCodeEngineManifests()
  .filter((manifest) => manifest.descriptor.status === 'active')
  .filter((manifest) => manifest.nativeSession.authorityBacked)
  .map((manifest) => manifest.id);
const nativeProviderEngineIds = listBirdCoderCodeEngineNativeSessionProviders().map(
  (provider) => provider.engineId,
);
const nativeProvidersByEngineId = new Map(
  listBirdCoderCodeEngineNativeSessionProviders().map((provider) => [
    provider.engineId,
    provider,
  ]),
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

assert.equal(
  nativeProvidersByEngineId.get('claude-code')?.discoveryMode,
  'passive-global',
  'Claude Code SDK bridge sessions are locally persisted and must be visible in unfiltered native-session inventory refreshes.',
);

assert.equal(
  nativeProvidersByEngineId.get('gemini')?.discoveryMode,
  'passive-global',
  'Gemini SDK bridge sessions are locally persisted and must be visible in unfiltered native-session inventory refreshes.',
);

const providerSource = readFileSync(providerSourcePath, 'utf8');
const libSource = readFileSync(libSourcePath, 'utf8');

const rustProviderModulesByEngineId = new Map([
  ['codex', 'codex_provider'],
  ['claude-code', 'claude_code_provider'],
  ['gemini', 'gemini_provider'],
  ['opencode', 'opencode_provider'],
] as const);
const rustProviderTypesByEngineId = new Map([
  ['codex', 'CodexCodeEngineProvider'],
  ['claude-code', 'ClaudeCodeEngineProvider'],
  ['gemini', 'GeminiCodeEngineProvider'],
  ['opencode', 'OpencodeCodeEngineProvider'],
] as const);

for (const engineId of authorityBackedStandardEngineIds) {
  const providerModuleName = rustProviderModulesByEngineId.get(engineId);
  const providerTypeName = rustProviderTypesByEngineId.get(engineId);
  assert.ok(providerModuleName, `Missing provider module mapping for standard engine ${engineId}.`);
  assert.ok(providerTypeName, `Missing provider type mapping for standard engine ${engineId}.`);

  assert.equal(
    existsSync(`${codeengineHostSourceDirectory}${providerModuleName}.rs`),
    true,
    `Rust host must implement ${engineId} in src-host/src/${providerModuleName}.rs.`,
  );
  assert.match(
    libSource,
    new RegExp(`mod\\s+${providerModuleName};`),
    `Rust host lib.rs must register module ${providerModuleName} for ${engineId}.`,
  );
  assert.match(
    libSource,
    new RegExp(`pub\\s+use\\s+${providerModuleName}::${providerTypeName};`),
    `Rust host lib.rs must export ${providerTypeName} for ${engineId}.`,
  );
  assert.match(
    providerSource,
    new RegExp(`Box::new\\(crate::${providerModuleName}::${providerTypeName}\\)`),
    `Standard provider registry must explicitly insert ${providerTypeName} for ${engineId}.`,
  );
}

assert.equal(
  /UnsupportedCodeEngineProvider::new\(\s*registration\.engine_id\.as_str\(\)\s*\)/.test(providerSource),
  false,
  'Standard provider registry must not silently backfill authority-backed standard engines with UnsupportedCodeEngineProvider.',
);

assert.equal(
  /not implemented yet\. TODO: add/.test(libSource),
  false,
  'Rust host native provider errors must describe registration problems instead of carrying stale implementation TODO text.',
);

for (const adapterSourcePath of productionAdapterSourcePaths) {
  const adapterSource = readFileSync(adapterSourcePath, 'utf8');
  assert.equal(
    adapterSource.includes('developmentOfficialSdkCandidate'),
    false,
    `${fileURLToPath(adapterSourcePath)} must not include development SDK candidates in the production default bridge loader.`,
  );
}

console.log('codeengine native provider completeness contract passed.');
