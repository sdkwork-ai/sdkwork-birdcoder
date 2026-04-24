import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  runtimeSource,
  /const MAX_LOADED_DIRECTORY_REVISIONS_PER_POLL = \d+;/,
  'RuntimeFileSystemService should define an explicit per-cycle cap for loaded-directory revision probes so expanding many folders does not create unbounded polling work.',
);

assert.match(
  runtimeSource,
  /function selectLoadedDirectoryPollPaths\(/,
  'RuntimeFileSystemService should centralize loaded-directory poll selection behind a helper so root-directory freshness and rotation policy stay coherent.',
);

assert.match(
  runtimeSource,
  /directoryPollCursor: number;/,
  'RuntimeFileSystemService should track directory poll cursor per project so batched polling still converges across larger sets of loaded folders.',
);

assert.match(
  runtimeSource,
  /const selectedDirectoryPollBatch = selectLoadedDirectoryPollPaths\(\s*loadedDirectoryPaths,\s*MAX_LOADED_DIRECTORY_REVISIONS_PER_POLL,\s*poller\?\.directoryPollCursor \?\? 0,\s*\);/s,
  'RuntimeFileSystemService should derive a bounded rotating poll batch from the loaded-directory set before probing revisions.',
);

assert.match(
  runtimeSource,
  /getDirectoryRevisions\(\s*mountState\.rootSystemPath,\s*mountState\.rootVirtualPath,\s*selectedDirectoryPollBatch\.paths,\s*\)/s,
  'RuntimeFileSystemService should probe only the selected loaded-directory poll batch each cycle instead of probing every loaded directory.',
);

assert.doesNotMatch(
  runtimeSource,
  /getDirectoryRevisions\(\s*mountState\.rootSystemPath,\s*mountState\.rootVirtualPath,\s*loadedDirectoryPaths,\s*\)/s,
  'RuntimeFileSystemService must not pass the full loaded-directory set into getDirectoryRevisions during each poll cycle.',
);

console.log('file system directory poll performance contract passed.');
