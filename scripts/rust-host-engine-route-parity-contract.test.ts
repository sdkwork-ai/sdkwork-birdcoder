import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineNativeSessionProviders,
  listBirdCoderCodeEngineModels,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/catalog.ts';

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function toJsonComparable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const serverHostSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/src/lib.rs');
const generatedCatalog = JSON.parse(
  read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src-host/generated/engine-catalog.json'),
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
  serverHostSource,
  /use sdkwork_birdcoder_codeengine::\{[\s\S]*list_codeengine_descriptors,\s*list_codeengine_model_catalog_entries,[\s\S]*\};/u,
  'Rust server host must consume engine and model catalog truth from the shared codeengine crate.',
);

assert.match(
  serverHostSource,
  /fn build_engine_catalog\(\) -> Vec<EngineDescriptorPayload> \{\s*list_codeengine_descriptors\(\)\s*\}/u,
  'Rust server engine catalog responses must delegate directly to the shared codeengine descriptor catalog.',
);

assert.match(
  serverHostSource,
  /fn build_ai_model_catalog\(\) -> Vec<ModelCatalogEntryPayload> \{\s*list_codeengine_model_catalog_entries\(\)\s*\}/u,
  'Rust server model catalog responses must delegate directly to the shared codeengine model catalog.',
);

assert.match(
  serverHostSource,
  /\.route\("\/app\/v3\/api\/engines", get\(core_engines\)\)/u,
  'Rust server must expose the standard app engine catalog route.',
);

assert.match(
  serverHostSource,
  /\.route\("\/app\/v3\/api\/models", get\(core_models\)\)/u,
  'Rust server must expose the standard app model catalog route.',
);

assert.match(
  serverHostSource,
  /\.route\(\s*"\/app\/v3\/api\/engines\/\{engineKey\}\/capabilities",\s*get\(core_engine_capabilities\),\s*\)/u,
  'Rust server must expose the standard per-engine capability route.',
);

assert.match(
  serverHostSource,
  /async fn core_engines\(\) -> Json<ApiListEnvelope<EngineDescriptorPayload>> \{\s*Json\(create_list_envelope\("core-engines", build_engine_catalog\(\)\)\)\s*\}/u,
  'Rust engine route handler must return the shared engine catalog through the standard list envelope.',
);

assert.match(
  serverHostSource,
  /async fn core_models\(\) -> Json<ApiListEnvelope<ModelCatalogEntryPayload>> \{\s*Json\(create_list_envelope\(\s*"core-models",\s*build_ai_model_catalog\(\),\s*\)\)\s*\}/u,
  'Rust model route handler must return the shared model catalog through the standard list envelope.',
);

assert.match(
  serverHostSource,
  /let engine = find_engine_descriptor\(&engine_key\)[\s\S]*engine\.capability_matrix/u,
  'Rust capability route handler must resolve capabilities from the same shared engine descriptor catalog.',
);

assert.match(
  serverHostSource,
  /async fn core_engine_catalog_routes_match_generated_shared_engine_catalog\(\)/u,
  'The Rust crate must retain its compile-backed route parity test for standard and release environments with Cargo caches.',
);

console.log('rust host engine route parity contract passed.');
