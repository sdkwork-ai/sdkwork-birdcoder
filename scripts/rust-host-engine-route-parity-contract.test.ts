import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineNativeSessionProviders,
  listBirdCoderCodeEngineModels,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/catalog.ts';
import { readCanonicalEngineCatalogBundle, CANONICAL_CODEENGINE_ARTIFACT_PATHS } from './birdcoder-canonical-server-rust-sources.mjs';

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function toJsonComparable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const engineCatalogSource = readCanonicalEngineCatalogBundle();
const generatedCatalog = JSON.parse(
  read(CANONICAL_CODEENGINE_ARTIFACT_PATHS.engineCatalogJson),
) as {
  engines: unknown[];
  models: unknown[];
  nativeProviders: unknown[];
};

assert.deepEqual(
  generatedCatalog.engines,
  toJsonComparable(listBirdCoderCodeEngineDescriptors()),
  'Generated Rust host engine catalog must stay aligned with the promoted TypeScript codeengine descriptor truth.',
);

assert.deepEqual(
  generatedCatalog.models,
  toJsonComparable(listBirdCoderCodeEngineModels()),
  'Generated Rust host model catalog must stay aligned with the promoted TypeScript codeengine model truth.',
);

assert.deepEqual(
  generatedCatalog.nativeProviders,
  toJsonComparable(listBirdCoderCodeEngineNativeSessionProviders()),
  'Generated Rust host native-session providers must stay aligned with the promoted TypeScript codeengine provider truth.',
);

assert.match(
  engineCatalogSource,
  /sdkwork_birdcoder_codeengine::/u,
  'Canonical engine catalog router must consume the shared codeengine crate.',
);

assert.match(
  engineCatalogSource,
  /ENGINES_PATH/u,
  'Canonical engine catalog router must expose the standard app engine catalog route.',
);

assert.match(
  engineCatalogSource,
  /MODELS_PATH/u,
  'Canonical engine catalog router must expose the standard app model catalog route.',
);

assert.match(
  engineCatalogSource,
  /ENGINE_CAPABILITIES_PATH/u,
  'Canonical engine catalog router must expose the standard per-engine capability route.',
);

assert.match(
  engineCatalogSource,
  /list_engines/u,
  'Canonical engine catalog handler must list engines through the engine catalog service.',
);

assert.match(
  engineCatalogSource,
  /list_models/u,
  'Canonical engine catalog handler must list models through the engine catalog service.',
);

console.log('rust host engine route parity contract passed.');
