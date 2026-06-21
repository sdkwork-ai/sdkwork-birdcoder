import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const codexSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-codeengine/src/codex.rs'),
  'utf8',
);

assert.match(codexSource, /execute_codex_cli_turn/);
assert.match(codexSource, /jsonl/i);

console.log('codex cli jsonl runtime contract passed.');
