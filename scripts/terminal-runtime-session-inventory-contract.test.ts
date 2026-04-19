import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const terminalSessionsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'terminal',
  'sessions.ts',
);
const terminalBridgePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'src',
  'terminal_bridge.rs',
);
const desktopLibRsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'src',
  'lib.rs',
);
const desktopPermissionsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'permissions',
  'default.toml',
);
const terminalRuntimePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'terminal',
  'runtime.ts',
);
const dataTypesPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-types',
  'src',
  'data.ts',
);

const terminalSessionsSource = readFileSync(terminalSessionsPath, 'utf8');
const terminalBridgeSource = readFileSync(terminalBridgePath, 'utf8');
const desktopLibRsSource = readFileSync(desktopLibRsPath, 'utf8');
const desktopPermissionsSource = readFileSync(desktopPermissionsPath, 'utf8');
const terminalRuntimeSource = readFileSync(terminalRuntimePath, 'utf8');
const dataTypesSource = readFileSync(dataTypesPath, 'utf8');

assert.match(
  terminalSessionsSource,
  /\bdesktop_terminal_session_inventory_list\b/u,
  'Terminal session inventory must read from the sdkwork-terminal runtime bridge.',
);

for (const forbiddenLegacyCommand of [
  'terminal_session_list',
  'terminal_session_upsert',
  'terminal_session_delete',
]) {
  assert.doesNotMatch(
    terminalSessionsSource,
    new RegExp(`\\b${forbiddenLegacyCommand}\\b`, 'u'),
    `Terminal session inventory must stop depending on legacy command ${forbiddenLegacyCommand}.`,
  );
}

for (const source of [terminalBridgeSource, desktopLibRsSource, desktopPermissionsSource]) {
  assert.match(
    source,
    /\bdesktop_terminal_session_inventory_list\b/u,
    'Desktop bridge must expose terminal runtime inventory as a first-class command.',
  );
}

for (const forbiddenLegacyBridgeCommand of [
  'terminal_session_upsert',
  'terminal_session_delete',
  'terminal_session_list',
  'terminal_host_session_open',
  'terminal_host_session_execute',
  'terminal_host_session_close',
  'execute_terminal_command',
]) {
  assert.doesNotMatch(
    desktopLibRsSource,
    new RegExp(`\\b${forbiddenLegacyBridgeCommand}\\b`, 'u'),
    `Desktop host must not retain deprecated terminal bridge command ${forbiddenLegacyBridgeCommand}.`,
  );
  assert.doesNotMatch(
    desktopPermissionsSource,
    new RegExp(`\\b${forbiddenLegacyBridgeCommand}\\b`, 'u'),
    `Desktop permission manifest must not expose deprecated terminal bridge command ${forbiddenLegacyBridgeCommand}.`,
  );
}

assert.doesNotMatch(
  desktopLibRsSource,
  /\bterminal_sessions\b/u,
  'Desktop host database schema must not keep the deprecated terminal_sessions table after sdkwork-terminal unification.',
);
assert.doesNotMatch(
  dataTypesSource,
  /\bterminal_sessions\b/u,
  'Shared BirdCoder data contracts must not expose the deprecated terminal_sessions entity after sdkwork-terminal unification.',
);

for (const forbiddenLegacyRuntimeApi of [
  'openTerminalHostSession',
  'runTerminalHostSessionCommand',
  'closeTerminalHostSession',
  'executeTerminalCommand',
]) {
  assert.doesNotMatch(
    terminalRuntimeSource,
    new RegExp(`\\b${forbiddenLegacyRuntimeApi}\\b`, 'u'),
    `Frontend commons terminal runtime must not keep deprecated API ${forbiddenLegacyRuntimeApi}.`,
  );
}

console.log('terminal runtime session inventory contract passed.');
