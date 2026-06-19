import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

function mustNotExist(relativePath, message) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.equal(fs.existsSync(absolutePath), false, message);
}

function mustExist(relativePath, message) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.equal(fs.existsSync(absolutePath), true, message);
}

mustNotExist(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src-host/src/lib.rs',
  'PC codeengine src-host compile tree must be retired; use crates/sdkwork-birdcoder-codeengine.',
);
mustNotExist(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src-host/generated/engine-catalog.json',
  'PC codeengine src-host generated catalog must not duplicate crates/sdkwork-birdcoder-codeengine/generated.',
);
mustExist(
  'crates/sdkwork-birdcoder-codeengine/src/lib.rs',
  'Canonical codeengine crate must remain the runtime Rust authority.',
);
mustExist(
  'crates/sdkwork-birdcoder-codeengine/generated/engine-catalog.json',
  'Canonical codeengine engine-catalog artifact must exist.',
);

console.log('legacy codeengine src-host retirement contract passed.');
