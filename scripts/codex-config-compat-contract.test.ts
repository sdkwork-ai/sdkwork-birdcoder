import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const codexSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-codeengine/src/codex.rs'),
  'utf8',
);
const kernelRegistrySource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/src/engine_registry.rs'),
  'utf8',
);

assert.match(codexSource, /CodexCliTurnRequest/);
assert.match(kernelRegistrySource, /codex/);

console.log('codex config compat contract passed.');
