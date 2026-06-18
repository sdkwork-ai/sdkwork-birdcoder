import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const hostCommandSources = [
  'crates/sdkwork-birdcoder-tauri-host/src/commands/filesystem_commands.rs',
  'crates/sdkwork-birdcoder-tauri-host/src/commands/terminal_commands.rs',
].map((relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8')).join('\n');

function readCommandSource(commandName) {
  const signatureIndex = hostCommandSources.indexOf(`fn ${commandName}(`);
  assert.notEqual(
    signatureIndex,
    -1,
    `Desktop command ${commandName} must exist in the shared tauri host.`,
  );

  const commandStart = hostCommandSources.lastIndexOf('#[tauri::command]', signatureIndex);
  const nextCommandIndex = hostCommandSources.indexOf(
    '#[tauri::command]',
    signatureIndex + commandName.length,
  );
  return hostCommandSources.slice(
    commandStart === -1 ? signatureIndex : commandStart,
    nextCommandIndex === -1 ? hostCommandSources.length : nextCommandIndex,
  );
}

function assertBlockingCommandOffloaded(commandName) {
  assert.match(
    hostCommandSources,
    new RegExp(`#\\[tauri::command\\][\\s\\S]*?\\basync\\s+fn\\s+${commandName}\\(`),
    `Desktop command ${commandName} must be async so blocking work does not run on the IPC command thread.`,
  );

  const commandSource = readCommandSource(commandName);
  assert.match(
    commandSource,
    /tauri::async_runtime::spawn_blocking\(move \|\| \{/,
    `Desktop command ${commandName} must run filesystem/process work through spawn_blocking.`,
  );
  assert.match(
    commandSource,
    /\.await\s*[\r\n]+\s*\.map_err\(/,
    `Desktop command ${commandName} must await and surface spawn_blocking join failures explicitly.`,
  );
}

[
  'user_home_config_read',
  'user_home_config_write',
  'fs_get_file_revision',
  'fs_get_file_revisions',
  'fs_get_directory_revisions',
  'fs_write_file',
  'fs_create_file',
  'fs_create_directory',
  'fs_delete_entry',
  'fs_rename_entry',
  'terminal_cli_profile_detect',
].forEach(assertBlockingCommandOffloaded);

console.log('desktop blocking IPC performance contract passed.');
