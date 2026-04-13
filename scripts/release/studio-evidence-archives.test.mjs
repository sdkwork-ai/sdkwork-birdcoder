import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readStudioBuildEvidenceArchive,
  resolveStudioBuildEvidenceArchivePath,
  summarizeStudioBuildEvidenceArchive,
} from './studio-build-evidence-archive.mjs';
import {
  readStudioPreviewEvidenceArchive,
  resolveStudioPreviewEvidenceArchivePath,
  summarizeStudioPreviewEvidenceArchive,
} from './studio-preview-evidence-archive.mjs';
import {
  readStudioSimulatorEvidenceArchive,
  resolveStudioSimulatorEvidenceArchivePath,
  summarizeStudioSimulatorEvidenceArchive,
} from './studio-simulator-evidence-archive.mjs';
import {
  readStudioTestEvidenceArchive,
  resolveStudioTestEvidenceArchivePath,
  summarizeStudioTestEvidenceArchive,
} from './studio-test-evidence-archive.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-studio-evidence-archives-'));

assert.equal(
  resolveStudioPreviewEvidenceArchivePath({ releaseAssetsDir }),
  path.join(releaseAssetsDir, 'studio', 'preview', 'studio-preview-evidence.json'),
);
assert.equal(
  resolveStudioBuildEvidenceArchivePath({ releaseAssetsDir }),
  path.join(releaseAssetsDir, 'studio', 'build', 'studio-build-evidence.json'),
);
assert.equal(
  resolveStudioSimulatorEvidenceArchivePath({ releaseAssetsDir }),
  path.join(releaseAssetsDir, 'studio', 'simulator', 'studio-simulator-evidence.json'),
);
assert.equal(
  resolveStudioTestEvidenceArchivePath({ releaseAssetsDir }),
  path.join(releaseAssetsDir, 'studio', 'test', 'studio-test-evidence.json'),
);

assert.equal(summarizeStudioPreviewEvidenceArchive({ releaseAssetsDir }), undefined);
assert.equal(summarizeStudioBuildEvidenceArchive({ releaseAssetsDir }), undefined);
assert.equal(summarizeStudioSimulatorEvidenceArchive({ releaseAssetsDir }), undefined);
assert.equal(summarizeStudioTestEvidenceArchive({ releaseAssetsDir }), undefined);

fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'preview'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'build'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'simulator'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'test'), { recursive: true });

fs.writeFileSync(
  resolveStudioPreviewEvidenceArchivePath({ releaseAssetsDir }),
  JSON.stringify({
    entries: [
      { evidenceKey: 'preview-2', channel: 'android', projectId: 'alpha', launchedAt: 40 },
      { evidenceKey: 'preview-1', channel: 'ios', projectId: 'alpha', launchedAt: 20 },
      { evidenceKey: '', channel: 'ignored', projectId: 'ignored', launchedAt: 999 },
      { evidenceKey: 'preview-3', channel: 'android', projectId: 'beta', launchedAt: 35 },
    ],
  }, null, 2),
  'utf8',
);
fs.writeFileSync(
  resolveStudioBuildEvidenceArchivePath({ releaseAssetsDir }),
  JSON.stringify({
    entries: [
      { evidenceKey: 'build-1', targetId: 'desktop', outputKind: 'bundle', projectId: 'alpha', launchedAt: 55 },
      { evidenceKey: 'build-2', targetId: 'server', outputKind: 'binary', projectId: 'beta', launchedAt: 70 },
      { evidenceKey: '', targetId: 'ignored', outputKind: 'ignored', projectId: 'ignored', launchedAt: 99 },
    ],
  }, null, 2),
  'utf8',
);
fs.writeFileSync(
  resolveStudioSimulatorEvidenceArchivePath({ releaseAssetsDir }),
  JSON.stringify({
    entries: [
      { evidenceKey: 'sim-1', channel: 'android', runtime: 'emulator', projectId: 'alpha', launchedAt: 15 },
      { evidenceKey: 'sim-2', channel: 'ios', runtime: 'simulator', projectId: 'alpha', launchedAt: 45 },
    ],
  }, null, 2),
  'utf8',
);
fs.writeFileSync(
  resolveStudioTestEvidenceArchivePath({ releaseAssetsDir }),
  JSON.stringify({
    entries: [
      { evidenceKey: 'test-1', command: 'pnpm test', projectId: 'alpha', launchedAt: 22 },
      { evidenceKey: 'test-2', command: 'pnpm lint', projectId: 'beta', launchedAt: 24 },
      { evidenceKey: 'test-3', command: 'pnpm test', projectId: 'beta', launchedAt: 26 },
    ],
  }, null, 2),
  'utf8',
);

assert.equal(readStudioPreviewEvidenceArchive({ releaseAssetsDir })?.archive.entries.length, 4);
assert.equal(readStudioBuildEvidenceArchive({ releaseAssetsDir })?.archive.entries.length, 3);
assert.equal(readStudioSimulatorEvidenceArchive({ releaseAssetsDir })?.archive.entries.length, 2);
assert.equal(readStudioTestEvidenceArchive({ releaseAssetsDir })?.archive.entries.length, 3);

assert.deepEqual(summarizeStudioPreviewEvidenceArchive({ releaseAssetsDir }), {
  archivePath: resolveStudioPreviewEvidenceArchivePath({ releaseAssetsDir }),
  archiveRelativePath: 'studio/preview/studio-preview-evidence.json',
  entryCount: 3,
  channels: ['android', 'ios'],
  projectIds: ['alpha', 'beta'],
  latestLaunchedAt: 40,
});
assert.deepEqual(summarizeStudioBuildEvidenceArchive({ releaseAssetsDir }), {
  archivePath: resolveStudioBuildEvidenceArchivePath({ releaseAssetsDir }),
  archiveRelativePath: 'studio/build/studio-build-evidence.json',
  entryCount: 2,
  targets: ['desktop', 'server'],
  outputKinds: ['binary', 'bundle'],
  projectIds: ['alpha', 'beta'],
  latestLaunchedAt: 70,
});
assert.deepEqual(summarizeStudioSimulatorEvidenceArchive({ releaseAssetsDir }), {
  archivePath: resolveStudioSimulatorEvidenceArchivePath({ releaseAssetsDir }),
  archiveRelativePath: 'studio/simulator/studio-simulator-evidence.json',
  entryCount: 2,
  channels: ['android', 'ios'],
  runtimes: ['emulator', 'simulator'],
  projectIds: ['alpha'],
  latestLaunchedAt: 45,
});
assert.deepEqual(summarizeStudioTestEvidenceArchive({ releaseAssetsDir }), {
  archivePath: resolveStudioTestEvidenceArchivePath({ releaseAssetsDir }),
  archiveRelativePath: 'studio/test/studio-test-evidence.json',
  entryCount: 3,
  commands: ['pnpm lint', 'pnpm test'],
  projectIds: ['alpha', 'beta'],
  latestLaunchedAt: 26,
});

const invalidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-studio-evidence-invalid-'));
fs.mkdirSync(path.join(invalidDir, 'studio', 'preview'), { recursive: true });
fs.writeFileSync(
  resolveStudioPreviewEvidenceArchivePath({ releaseAssetsDir: invalidDir }),
  JSON.stringify({ entries: {} }, null, 2),
  'utf8',
);
assert.throws(
  () => readStudioPreviewEvidenceArchive({ releaseAssetsDir: invalidDir }),
  /entries must be an array/,
);

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
fs.rmSync(invalidDir, { recursive: true, force: true });

console.log('studio evidence archives contract passed.');
