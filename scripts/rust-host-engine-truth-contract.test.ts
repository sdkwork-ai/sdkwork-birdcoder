import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  listBirdCoderCodingServerEngines,
  listBirdCoderCodingServerModels,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

function toJsonComparable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const sharedCatalogPath = new URL(
  '../packages/sdkwork-birdcoder-server/src-host/generated/engine-catalog.json',
  import.meta.url,
);
const rustSourcePath = new URL(
  '../packages/sdkwork-birdcoder-server/src-host/src/lib.rs',
  import.meta.url,
);

assert.equal(
  existsSync(sharedCatalogPath),
  true,
  'Rust host must consume a generated engine-catalog artifact derived from promoted coding-server truth.',
);

const sharedCatalog = JSON.parse(readFileSync(sharedCatalogPath, 'utf8')) as {
  engines: unknown[];
  models: unknown[];
};

assert.deepEqual(
  sharedCatalog.engines,
  toJsonComparable(listBirdCoderCodingServerEngines()),
  'Rust host engine artifact must stay aligned with promoted coding-server engine descriptors.',
);

assert.deepEqual(
  sharedCatalog.models,
  toJsonComparable(listBirdCoderCodingServerModels()),
  'Rust host engine artifact must stay aligned with promoted coding-server model catalog truth.',
);

const rustSource = readFileSync(rustSourcePath, 'utf8');

assert.match(
  rustSource,
  /include_str!\("\.\.\/generated\/engine-catalog\.json"\)/,
  'Rust host must load engine/model route truth from the generated shared engine-catalog artifact.',
);

for (const removedFixture of [
  'fn default_engine_capability_matrix()',
  'fn codex_transport_kinds()',
  'fn claude_code_transport_kinds()',
  'fn gemini_transport_kinds()',
  'fn opencode_transport_kinds()',
  'fn supported_host_modes()',
]) {
  assert.equal(
    rustSource.includes(removedFixture),
    false,
    `Rust host must not keep local manual engine fixture helper ${removedFixture} once shared engine truth is adopted.`,
  );
}

console.log('rust host engine truth contract passed.');
