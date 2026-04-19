import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const terminalPagePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-terminal',
  'src',
  'pages',
  'TerminalPage.tsx',
);
const terminalRequestLaunchPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-terminal',
  'src',
  'pages',
  'terminalRequestLaunch.ts',
);
const tsconfigPath = path.join(rootDir, 'tsconfig.json');
const webViteConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-web',
  'vite.config.ts',
);
const desktopViteConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'vite.config.ts',
);
const desktopCargoTomlPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'Cargo.toml',
);
const desktopPermissionsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'permissions',
  'default.toml',
);
const desktopLibRsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'src',
  'lib.rs',
);

const terminalPageSource = readFileSync(terminalPagePath, 'utf8');
const terminalRequestLaunchSource = readFileSync(terminalRequestLaunchPath, 'utf8');
const tsconfigSource = readFileSync(tsconfigPath, 'utf8');
const webViteConfigSource = readFileSync(webViteConfigPath, 'utf8');
const desktopViteConfigSource = readFileSync(desktopViteConfigPath, 'utf8');
const desktopCargoTomlSource = readFileSync(desktopCargoTomlPath, 'utf8');
const desktopPermissionsSource = readFileSync(desktopPermissionsPath, 'utf8');
const desktopLibRsSource = readFileSync(desktopLibRsPath, 'utf8');

assert.match(
  terminalPageSource,
  /ShellApp/,
  'BirdCoder TerminalPage must delegate terminal rendering to sdkwork-terminal ShellApp.',
);

for (const source of [terminalPageSource, terminalRequestLaunchSource]) {
  assert.doesNotMatch(
    source,
    /from ['"]@sdkwork\/birdcoder-commons['"]/u,
    'BirdCoder terminal integration must not depend on the broad @sdkwork/birdcoder-commons barrel entrypoint.',
  );
  assert.match(
    source,
    /from ['"]@sdkwork\/birdcoder-commons\/[^'"]+['"]/u,
    'BirdCoder terminal integration must depend on focused @sdkwork/birdcoder-commons subpath entrypoints.',
  );
}

for (const forbiddenLegacyHelper of [
  'openTerminalHostSession',
  'runTerminalHostSessionCommand',
  'closeTerminalHostSession',
]) {
  assert.doesNotMatch(
    terminalPageSource,
    new RegExp(`\\b${forbiddenLegacyHelper}\\b`, 'u'),
    `BirdCoder TerminalPage must stop depending on legacy helper ${forbiddenLegacyHelper}.`,
  );
}

for (const requiredTerminalAlias of [
  '@sdkwork/terminal-shell',
  '@sdkwork/terminal-infrastructure',
  '@sdkwork/terminal-core',
  '@sdkwork/terminal-contracts',
  '@sdkwork/terminal-types',
]) {
  assert.match(
    tsconfigSource,
    new RegExp(requiredTerminalAlias.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
    `tsconfig.json must expose a sibling-source path alias for ${requiredTerminalAlias}.`,
  );
}

assert.match(
  tsconfigSource,
  /"@sdkwork\/birdcoder-commons\/\*"/u,
  'tsconfig.json must expose focused commons subpath aliases for terminal integration.',
);

assert.match(
  webViteConfigSource,
  /@sdkwork\\\/terminal-/,
  'Web Vite config must alias sibling sdkwork-terminal packages.',
);
assert.ok(
  webViteConfigSource.includes('@sdkwork\\/birdcoder-([^/]+)\\/(.+)$'),
  'Web Vite config must alias BirdCoder package subpaths for focused imports.',
);

assert.match(
  desktopViteConfigSource,
  /@sdkwork\\\/terminal-/,
  'Desktop Vite config must alias sibling sdkwork-terminal packages.',
);
assert.ok(
  desktopViteConfigSource.includes('@sdkwork\\/birdcoder-([^/]+)\\/(.+)$'),
  'Desktop Vite config must alias BirdCoder package subpaths for focused imports.',
);

for (const requiredCargoDependency of [
  'sdkwork-terminal-control-plane',
  'sdkwork-terminal-pty-runtime',
  'sdkwork-terminal-protocol',
  'sdkwork-terminal-replay-store',
  'sdkwork-terminal-session-runtime',
]) {
  assert.match(
    desktopCargoTomlSource,
    new RegExp(requiredCargoDependency.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
    `BirdCoder desktop Cargo.toml must depend on ${requiredCargoDependency} from sdkwork-terminal.`,
  );
}

for (const requiredPermission of [
  'desktop_local_shell_exec',
  'desktop_local_shell_session_create',
  'desktop_local_process_session_create',
  'desktop_session_input',
  'desktop_session_input_bytes',
  'desktop_session_attachment_acknowledge',
  'desktop_session_resize',
  'desktop_session_terminate',
  'desktop_session_replay_slice',
]) {
  assert.match(
    desktopPermissionsSource,
    new RegExp(requiredPermission.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
    `BirdCoder desktop permissions must allow ${requiredPermission}.`,
  );
  assert.match(
    desktopLibRsSource,
    new RegExp(requiredPermission.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
    `BirdCoder desktop host must register ${requiredPermission}.`,
  );
}

assert.match(
  desktopLibRsSource,
  /terminal_bridge/u,
  'BirdCoder desktop host must isolate sdkwork-terminal integration into a dedicated terminal bridge module.',
);

console.log('terminal sdkwork shell integration contract passed.');
