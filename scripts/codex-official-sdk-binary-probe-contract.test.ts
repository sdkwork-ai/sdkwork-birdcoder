import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const kernelRuntimeSource = readFileSync(
  path.join(root, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernelRuntime.ts'),
  'utf8',
);

assert.match(kernelRuntimeSource, /resolveKernelTurnBinary/);
assert.match(kernelRuntimeSource, /BIRDCODER_KERNEL_TURN_BIN/);

console.log('codex official sdk binary probe contract passed.');
