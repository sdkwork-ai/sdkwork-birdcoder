import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const hostFilesystemSource = fs.readFileSync(
  path.join(
    rootDir,
    'crates/sdkwork-birdcoder-tauri-host/src/commands/filesystem_commands.rs',
  ),
  'utf8',
);
const desktopLibSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/src/lib.rs',
  ),
  'utf8',
);
const tauriRuntimeSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriFileSystemRuntime.ts',
  ),
  'utf8',
);
const runtimeFileSystemServiceSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
  ),
  'utf8',
);

assert.match(
  hostFilesystemSource,
  /async\s+fn\s+fs_read_file\(\s*root_path:\s*String,\s*relative_path:\s*String,\s*max_bytes:\s*Option<usize>,?\s*\)\s*->\s*Result<String,\s*String>/s,
  'Desktop fs_read_file must be an async Tauri command that accepts an optional max_bytes budget so search can avoid full-file reads.',
);

assert.match(
  hostFilesystemSource,
  /fn\s+read_mounted_file_to_string\(\s*file_path:\s*&Path,\s*max_bytes:\s*Option<usize>,?\s*\)\s*->\s*Result<String,\s*String>/s,
  'Desktop file reads must centralize full and bounded mounted-file reads behind a helper.',
);

assert.match(
  hostFilesystemSource,
  /tauri::async_runtime::spawn_blocking\(move \|\| \{\s*let file_path = resolve_scoped_path\(&root_path,\s*&relative_path\)\?;[\s\S]*read_mounted_file_to_string\(&file_path,\s*max_bytes\)/s,
  'Desktop fs_read_file must offload filesystem reads through spawn_blocking instead of reading on the IPC command thread.',
);

assert.match(
  hostFilesystemSource,
  /\.take\(max_bytes as u64\)[\s\S]*read_to_end\(&mut buffer\)/s,
  'Desktop bounded file reads must use a max-byte reader instead of reading the whole file before truncating.',
);

assert.match(
  hostFilesystemSource,
  /if let Some\(max_bytes\) = max_bytes[\s\S]*\.take\(max_bytes as u64\)[\s\S]*let metadata = fs::metadata\(file_path\)/s,
  'Prefix reads must be reserved for callers that explicitly provide a search budget.',
);

assert.match(
  hostFilesystemSource,
  /metadata\.len\(\) > DEFAULT_FS_READ_FILE_MAX_BYTES as u64[\s\S]*exceeds the \{\} byte text editor limit/s,
  'Normal editor reads must reject oversized files instead of returning a silently truncated buffer.',
);

assert.match(
  hostFilesystemSource,
  /String::from_utf8\(bytes\)[\s\S]*not valid UTF-8 text and cannot be opened in the text editor/s,
  'Normal editor reads must reject binary or invalid UTF-8 files instead of replacing bytes lossily.',
);

assert.match(
  desktopLibSource,
  /fs_read_file,/,
  'Desktop shell must register the shared tauri-host fs_read_file command.',
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
