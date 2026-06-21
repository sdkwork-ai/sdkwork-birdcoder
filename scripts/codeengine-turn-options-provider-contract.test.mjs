import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  readCanonicalServerRustSource,
  CANONICAL_CODEENGINE_RUST_PATHS,
} from './birdcoder-canonical-server-rust-sources.mjs';

const root = path.resolve(import.meta.dirname, '..');
const kernelRuntimeSource = fs.readFileSync(
  path.join(root, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernelRuntime.ts'),
  'utf8',
);
const turnsSource = readCanonicalServerRustSource(CANONICAL_CODEENGINE_RUST_PATHS.turns);

assert.match(
  turnsSource,
  /pub struct CodeEngineTurnConfigRecord[\s\S]*pub temperature: Option<f64>[\s\S]*pub top_p: Option<f64>[\s\S]*pub max_tokens: Option<i64>/,
  'CodeEngineTurnConfigRecord must serialize standard sampling options.',
);

assert.match(
  kernelRuntimeSource,
  /config:\s*\{/,
  'Kernel runtime turn payload must include turn config for kernel bridge execution.',
);

console.log('codeengine turn options provider contract passed.');
