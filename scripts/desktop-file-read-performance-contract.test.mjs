import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const desktopLibSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs'),
  'utf8',
);
const tauriRuntimeSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages/sdkwork-birdcoder-infrastructure/src/platform/tauriFileSystemRuntime.ts',
  ),
  'utf8',
);
const runtimeFileSystemServiceSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
  ),
  'utf8',
);

assert.match(
  desktopLibSource,
  /async\s+fn\s+fs_read_file\(\s*root_path:\s*String,\s*relative_path:\s*String,\s*max_bytes:\s*Option<usize>,?\s*\)\s*->\s*Result<String,\s*String>/s,
  'Desktop fs_read_file must be an async Tauri command that accepts an optional max_bytes budget so search can avoid full-file reads.',
);

assert.match(
  desktopLibSource,
  /fn\s+read_mounted_file_to_string\(\s*file_path:\s*&Path,\s*max_bytes:\s*Option<usize>,?\s*\)\s*->\s*Result<String,\s*String>/s,
  'Desktop file reads must centralize full and bounded mounted-file reads behind a helper.',
);

assert.match(
  desktopLibSource,
  /tauri::async_runtime::spawn_blocking\(move \|\| \{\s*let file_path = resolve_scoped_path\(&root_path,\s*&relative_path\)\?;[\s\S]*read_mounted_file_to_string\(&file_path,\s*max_bytes\)/s,
  'Desktop fs_read_file must offload filesystem reads through spawn_blocking instead of reading on the IPC command thread.',
);

assert.match(
  desktopLibSource,
  /\.take\(max_bytes as u64\)[\s\S]*read_to_end\(&mut buffer\)/s,
  'Desktop bounded file reads must use a max-byte reader instead of reading the whole file before truncating.',
);

assert.match(
  tauriRuntimeSource,
  /readFile\(\s*rootSystemPath: string,\s*rootVirtualPath: string,\s*mountedPath: string,\s*options\?: \{ maxBytes\?: number \},?\s*\): Promise<string>;/s,
  'Tauri file-system runtime readFile must expose an optional maxBytes budget.',
);

assert.match(
  tauriRuntimeSource,
  /maxBytes:\s*normalizeTauriReadFileMaxBytes\(options\?\.maxBytes\)/s,
  'Tauri file-system runtime must forward the bounded read budget to the Rust fs_read_file command.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /const searchMaxFileContentCharacters = normalizeRuntimeFileSearchContentBudget\(\s*options\.maxFileContentCharacters,?\s*\);/s,
  'RuntimeFileSystemService.searchFiles must compute one search content budget before dispatching file reads.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /readFileContent:\s*async \(path: string\) => \{[\s\S]*this\.readSearchFileContent\(\s*projectId,\s*path,\s*searchMaxFileContentCharacters/s,
  'RuntimeFileSystemService.searchFiles must route file reads through a bounded search reader.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /this\.tauriRuntime\.readFile\([\s\S]*\{\s*maxBytes:\s*options\.maxBytes\s*\}/s,
  'RuntimeFileSystemService must pass the search read budget into desktop-mounted file reads.',
);

console.log('desktop file read performance contract passed.');
