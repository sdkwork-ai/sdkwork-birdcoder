import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts';

const rootDir = process.cwd();

const expectedSourceTruth = {
  codex: {
    externalPath: 'external/codex',
    sourceStatus: 'mirrored',
    sourceKind: 'repository',
  },
  'claude-code': {
    externalPath: 'external/claude-code',
    sourceStatus: 'mirrored',
    sourceKind: 'repository',
  },
  gemini: {
    externalPath: 'external/gemini',
    sourceStatus: 'mirrored',
    sourceKind: 'repository',
  },
  opencode: {
    externalPath: 'external/opencode',
    sourceStatus: 'mirrored',
    sourceKind: 'repository',
  },
} as const;

for (const engine of listWorkbenchCliEngines()) {
  const expected = expectedSourceTruth[engine.id];

  assert.ok(expected, `${engine.id} must have frozen source mirror truth`);
  assert.equal(
    engine.source.externalPath,
    expected.externalPath,
    `${engine.id} external mirror path must stay frozen`,
  );
  assert.equal(
    engine.source.sourceStatus,
    expected.sourceStatus,
    `${engine.id} source status must match the mirrored repository truth`,
  );
  assert.equal(
    engine.source.sourceKind,
    expected.sourceKind,
    `${engine.id} source kind must match the mirrored repository truth`,
  );
  assert.equal(
    path.isAbsolute(expected.externalPath),
    false,
    `${engine.id} source metadata must stay repository-relative`,
  );
  assert.equal(
    true,
    !!engine.source.externalPath,
    `${engine.id} mirrored engines must declare an externalPath`,
  );
  assert.equal(
    true,
    fs.existsSync(path.join(rootDir, expected.externalPath)),
    `${engine.id} external mirror path must exist in this workspace`,
  );
  assert.equal(
    /no local/i.test(engine.source.notes),
    false,
    `${engine.id} mirrored source notes must not claim the local mirror is missing`,
  );
  assert.equal(
    /fragment/i.test(engine.source.notes),
    false,
    `${engine.id} mirrored repository notes must not describe fragment-only truth`,
  );
}

console.log('engine source mirror contract passed.');
