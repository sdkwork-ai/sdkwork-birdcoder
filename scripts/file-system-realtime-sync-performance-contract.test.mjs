import assert from 'node:assert/strict';
import fs from 'node:fs';

const fileSystemSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts', import.meta.url),
  'utf8',
);

assert.match(
  fileSystemSource,
  /const realtimeSyncCycleInFlightRef = useRef\(false\);/,
  'useFileSystem must guard realtime sync cycles so a slow revision probe cannot stack overlapping intervals and compound main-thread and filesystem work.',
);

assert.match(
  fileSystemSource,
  /if \(realtimeSyncCycleInFlightRef\.current\) \{\s*return;\s*\}/s,
  'useFileSystem must skip starting a new realtime sync cycle while the previous cycle is still running.',
);

assert.doesNotMatch(
  fileSystemSource,
  /setInterval\(\(\) => \{\s*void syncSelectedFileFromSource[\s\S]*setInterval\(\(\) => \{\s*void syncInactiveOpenFilesFromSource/s,
  'useFileSystem must not maintain separate realtime intervals for the selected file and inactive tabs because the duplicate timers can overlap and amplify sync work during active editing.',
);

assert.doesNotMatch(
  fileSystemSource,
  /const intervalId = setInterval\(\(\) => \{\s*void runRealtimeSyncCycle\(requestProjectId\);\s*\},/s,
  'useFileSystem should not keep a hook-level realtime interval once tracked-file polling is centralized inside the file-system service boundary.',
);

assert.match(
  fileSystemSource,
  /subscribeToFileChanges\([\s\S]*getTrackedFilePaths:/s,
  'useFileSystem should pass tracked file paths into subscribeToFileChanges so the service owns bounded realtime revision polling.',
);

assert.match(
  fileSystemSource,
  /const MAX_INACTIVE_OPEN_FILE_REVISIONS_PER_CYCLE = \d+;/,
  'useFileSystem should define an explicit per-cycle cap for inactive open-file revision probes so many open tabs do not scale into unbounded periodic filesystem work.',
);

assert.match(
  fileSystemSource,
  /function selectInactiveOpenFileProbePaths\(/,
  'useFileSystem should centralize inactive open-file probe selection behind a dedicated helper so realtime sync can rotate through tabs predictably instead of probing the full set every cycle.',
);

assert.match(
  fileSystemSource,
  /const inactiveOpenFileProbeCursorRef = useRef\(0\);/,
  'useFileSystem should track inactive open-file probe progress so bounded batches still converge across larger tab sets.',
);

assert.match(
  fileSystemSource,
  /const inactiveOpenFileProbeBatch = selectInactiveOpenFileProbePaths\([\s\S]*MAX_INACTIVE_OPEN_FILE_REVISIONS_PER_CYCLE[\s\S]*\);/s,
  'useFileSystem should select a bounded rotating batch of inactive open files for each realtime sync cycle.',
);

assert.match(
  fileSystemSource,
  /await fileSystemService\.getFileRevisions\(\s*normalizedTargetProjectId,\s*inactiveOpenFileProbeBatch\.paths,\s*\);/s,
  'useFileSystem should probe only the bounded inactive-open-file batch each cycle instead of passing the full inactive tab collection into getFileRevisions.',
);

console.log('file system realtime sync performance contract passed.');
