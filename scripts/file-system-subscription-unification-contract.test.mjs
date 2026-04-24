import assert from 'node:assert/strict';
import fs from 'node:fs';

const commonsInterfaceSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-commons/src/services/interfaces/IFileSystemService.ts',
    import.meta.url,
  ),
  'utf8',
);

const infrastructureInterfaceSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IFileSystemService.ts',
    import.meta.url,
  ),
  'utf8',
);

const runtimeServiceSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
    import.meta.url,
  ),
  'utf8',
);

const fileSystemHookSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts', import.meta.url),
  'utf8',
);

for (const [label, source] of [
  ['commons', commonsInterfaceSource],
  ['infrastructure', infrastructureInterfaceSource],
]) {
  assert.match(
    source,
    /export interface FileSystemChangeSubscriptionOptions \{[\s\S]*getTrackedFilePaths\?: \(\) => readonly string\[];[\s\S]*\}/s,
    `${label} file-system interface should expose tracked-file subscription options so realtime file probes are owned by the service boundary.`,
  );

  assert.match(
    source,
    /subscribeToFileChanges\([\s\S]*listener: \(event: ProjectFileSystemChangeEvent\) => void,[\s\S]*options\?: FileSystemChangeSubscriptionOptions,[\s\S]*\): \(\) => void;/s,
    `${label} file-system interface should accept subscription options on subscribeToFileChanges.`,
  );
}

assert.match(
  fileSystemHookSource,
  /subscribeToFileChanges\(\s*requestProjectId,\s*\(event\) => \{[\s\S]*\},\s*\{\s*getTrackedFilePaths:/s,
  'useFileSystem should pass tracked open-file paths into the file-change subscription so the service can centralize realtime revision polling.',
);

assert.doesNotMatch(
  fileSystemHookSource,
  /const intervalId = setInterval\(\(\) => \{\s*void runRealtimeSyncCycle\(requestProjectId\);\s*\},\s*REALTIME_SYNC_INTERVAL_MS\s*\);/s,
  'useFileSystem should not maintain its own realtime interval once tracked-file polling is centralized inside subscribeToFileChanges.',
);

assert.match(
  runtimeServiceSource,
  /const MAX_TRACKED_FILE_REVISIONS_PER_POLL = \d+;/,
  'RuntimeFileSystemService should cap tracked-file revision probes per cycle to keep centralized polling bounded.',
);

assert.match(
  runtimeServiceSource,
  /subscribeToFileChanges\([\s\S]*options: FileSystemChangeSubscriptionOptions = \{\}/s,
  'RuntimeFileSystemService should accept subscription options with a stable default object.',
);

assert.match(
  runtimeServiceSource,
  /const trackedFileChangePaths = await this\.pollTrackedProjectFiles\(projectId\);/s,
  'RuntimeFileSystemService should poll tracked file revisions in the same project poller that already handles directory changes.',
);

assert.match(
  runtimeServiceSource,
  /const changedPaths = \[\.\.\.directoryChangePaths, \.\.\.trackedFileChangePaths\];/s,
  'RuntimeFileSystemService should merge directory and tracked-file changes into one notification payload.',
);

console.log('file system subscription unification contract passed.');
