import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-infrastructure/src/platform/tauriFileSystemRuntime.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  runtimeSource,
  /watchProjectTree\(\s*rootSystemPath: string,\s*listener: \(event: BirdCoderTauriFileSystemWatchEvent\) => void,\s*\): Promise<\(\) => Promise<void>>;/s,
  'Tauri file-system runtime must expose a dedicated watcher subscription boundary so desktop mounts do not rely on revision polling alone.',
);

assert.match(
  runtimeSource,
  /invokeTauriFileSystemCommand<BirdCoderTauriFileSystemWatchRegistration>\(\s*'fs_watch_start'/s,
  'Tauri file-system runtime must start host watchers through the explicit fs_watch_start command.',
);

assert.match(
  runtimeSource,
  /await listen<BirdCoderTauriFileSystemWatchEventPayload>\(\s*'birdcoder:file-system-watch'/s,
  'Tauri file-system runtime must subscribe to the dedicated desktop file-system watch event channel.',
);

const serviceSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  serviceSource,
  /private readonly projectTauriFileWatchers = new Map<string, ProjectTauriFileWatcher>\(\);/,
  'RuntimeFileSystemService must keep an explicit Tauri watcher registry so desktop subscriptions are lifecycle-managed independently from polling fallbacks.',
);

assert.match(
  serviceSource,
  /if \(this\.projectTauriMounts\[projectId\]\) \{\s*this\.stopProjectFileTreePoller\(projectId\);\s*void this\.ensureProjectTauriFileWatcher\(projectId\);\s*return;\s*\}/s,
  'RuntimeFileSystemService must route active Tauri-mounted projects through watcher-first realtime orchestration and stop the fixed interval poller on that path.',
);

assert.match(
  serviceSource,
  /const dispose = await this\.tauriRuntime\.watchProjectTree\(\s*mountState\.rootSystemPath,/s,
  'RuntimeFileSystemService must bind desktop realtime sync to the shared Tauri watcher runtime instead of probing mounted directory revisions on a fixed timer.',
);

console.log('file system tauri watch contract passed.');
