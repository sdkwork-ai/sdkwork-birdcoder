import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const releaseRegistryPath = path.join(rootDir, 'docs', 'release', 'releases.json');
const releaseRegistry = JSON.parse(fs.readFileSync(releaseRegistryPath, 'utf8'));
const releaseEntry = releaseRegistry.releases.find(
  (entry) => entry.tag === 'release-2026-04-28-01',
);

assert.ok(
  releaseEntry,
  'Multi-window programming standardization must be backwritten as release-2026-04-28-01.',
);
assert.equal(
  releaseEntry.notesFile,
  'release-2026-04-28-01.md',
  'Multi-window release registry entry must point at its release note.',
);
assert.match(
  releaseEntry.summary,
  /multi-window programming/i,
  'Multi-window release summary must name the product capability.',
);
assert.deepEqual(
  releaseEntry.carryForward,
  ['release-2026-04-15-14'],
  'Multi-window release must carry forward the latest registry-backed release truth.',
);

const releaseNotePath = path.join(rootDir, 'docs', 'release', releaseEntry.notesFile);
assert.ok(
  fs.existsSync(releaseNotePath),
  'Multi-window release note must exist.',
);
const releaseNote = fs.readFileSync(releaseNotePath, 'utf8');

for (const requiredSection of [
  '## Highlights',
  '## Scope',
  '## Verification',
  '## Notes',
  '## Post-release operations',
]) {
  assert.match(
    releaseNote,
    new RegExp(requiredSection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Multi-window release note must include ${requiredSection}.`,
  );
}

for (const requiredTruth of [
  '@sdkwork/birdcoder-multiwindow',
  'check:multiwindow-standard',
  'multiwindow-release-writeback-contract.test.mjs',
  'codeengine-turn-options-provider',
  '101',
  'BirdCoderCodingSessionTurnOptions',
  'MultiWindowDispatchBatchSummary',
  'maxObservedConcurrency',
  'retry failed panes',
  'cancelled multi-window batches',
  'manual cancel current batch',
  'manual window add and close',
  'quota-safe workspace persistence',
]) {
  assert.match(
    releaseNote,
    new RegExp(requiredTruth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Multi-window release note must preserve ${requiredTruth}.`,
  );
}

for (const requiredOperation of [
  'Observation window:',
  'Stop-ship signals:',
  'Rollback entry:',
  'Re-issue path:',
  'Writeback targets:',
  'Machine stop-ship signals:',
]) {
  assert.match(
    releaseNote,
    new RegExp(requiredOperation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Multi-window release note must include ${requiredOperation}.`,
  );
}

console.log('multi-window release writeback contract passed.');
