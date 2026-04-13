import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const desktopPackageJsonPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'package.json',
);
const tauriConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'tauri.conf.json',
);
const desktopCargoTomlPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'Cargo.toml',
);
const desktopBuildRsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'build.rs',
);
const desktopLibRsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'src',
  'lib.rs',
);
const desktopCapabilityPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'capabilities',
  'default.json',
);
const desktopAppPermissionsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'permissions',
  'default.toml',
);
const tauriTestConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'tauri.test.conf.json',
);
const desktopViteConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'vite.config.ts',
);
const desktopViteHostPath = path.join(rootDir, 'scripts', 'run-desktop-vite-host.mjs');
const tauriDevBinaryUnlockScriptPath = path.join(rootDir, 'scripts', 'ensure-tauri-dev-binary-unlocked.ps1');
const tauriRustToolchainScriptPath = path.join(rootDir, 'scripts', 'ensure-tauri-rust-toolchain.mjs');
const tauriDevPortGuardScriptPath = path.join(rootDir, 'scripts', 'ensure-tauri-dev-port-free.mjs');
const tauriCliRunnerScriptPath = path.join(rootDir, 'scripts', 'run-tauri-cli.mjs');
const tauriTargetCleanScriptPath = path.join(rootDir, 'scripts', 'ensure-tauri-target-clean.mjs');
const appSourcePath = path.join(rootDir, 'src', 'App.tsx');
const desktopIndexHtmlPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'index.html',
);
const desktopFaviconPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'public',
  'favicon.ico',
);
const desktopTauriIconPaths = [
  'icons/32x32.png',
  'icons/128x128.png',
  'icons/128x128@2x.png',
  'icons/icon.ico',
];

const desktopPackageJson = JSON.parse(fs.readFileSync(desktopPackageJsonPath, 'utf8'));
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
const tauriTestConfig = JSON.parse(fs.readFileSync(tauriTestConfigPath, 'utf8'));
const desktopCargoTomlSource = fs.readFileSync(desktopCargoTomlPath, 'utf8');
const desktopBuildRsSource = fs.readFileSync(desktopBuildRsPath, 'utf8');
const desktopLibRsSource = fs.readFileSync(desktopLibRsPath, 'utf8');
const desktopViteConfigSource = fs.readFileSync(desktopViteConfigPath, 'utf8');
const desktopViteHostSource = fs.readFileSync(desktopViteHostPath, 'utf8');
const appSource = fs.readFileSync(appSourcePath, 'utf8');
const desktopIndexHtmlSource = fs.readFileSync(desktopIndexHtmlPath, 'utf8');

assert.equal(
  tauriConfig.build.beforeDevCommand,
  'pnpm dev:tauri',
  'Desktop Tauri dev must start the desktop-only strict-port Vite host instead of the generic dev server.',
);

assert.equal(
  tauriConfig.build.devUrl,
  'http://127.0.0.1:1520',
  'Desktop Tauri dev must wait on port 1520.',
);
assert.equal(
  tauriConfig.app.windows[0].decorations,
  false,
  'Desktop Tauri config must disable the default native window header when the app renders its own custom header.',
);
assert.equal(
  tauriConfig.app.windows[0].label,
  'main',
  'Desktop Tauri config must assign the main window an explicit "main" label so capability routing is deterministic.',
);
assert.equal(
  tauriTestConfig.app.windows[0].decorations,
  false,
  'Desktop Tauri test config must also disable the default native window header so test mode matches development mode.',
);
assert.equal(
  tauriTestConfig.app.windows[0].label,
  'main',
  'Desktop Tauri test config must assign the test main window the same explicit "main" label used in development mode.',
);
assert.equal(
  tauriConfig.plugins?.shell?.open,
  '((mailto:\\\\w+)|(tel:\\\\w+)|(https?://\\\\w+).+|(file://.+)|([A-Za-z]:\\\\\\\\.+)|(\\\\\\\\\\\\\\\\.+))',
  'Desktop Tauri config must configure the shell open scope so BirdCoder can reveal local desktop paths as well as standard external URLs.',
);
assert.equal(
  tauriTestConfig.plugins?.shell?.open,
  '((mailto:\\\\w+)|(tel:\\\\w+)|(https?://\\\\w+).+|(file://.+)|([A-Za-z]:\\\\\\\\.+)|(\\\\\\\\\\\\\\\\.+))',
  'Desktop Tauri test config must use the same shell open scope as development mode so local-path opener behavior stays aligned.',
);

assert.match(
  desktopPackageJson.scripts['dev:tauri'],
  /run-vite-host\.mjs\s+serve/,
  'Desktop dev:tauri must use the standard workspace Vite host so desktop startup stays aligned with the claw-studio baseline.',
);

assert.match(
  desktopPackageJson.scripts['dev:tauri'],
  /--host 127\.0\.0\.1 --port 1520 --strictPort\b/,
  'Desktop dev:tauri must bind the same strict localhost port that Tauri waits on.',
);
assert.match(
  desktopPackageJson.scripts['dev:tauri:test'],
  /run-vite-host\.mjs\s+serve/,
  'Desktop dev:tauri:test must use the standard workspace Vite host so test-mode desktop startup follows the same path as development mode.',
);
assert.match(
  desktopPackageJson.scripts['dev:tauri:test'],
  /--host 127\.0\.0\.1 --port 1520 --strictPort\b.*--mode test|--mode test.*--host 127\.0\.0\.1 --port 1520 --strictPort\b/,
  'Desktop dev:tauri:test must bind the same strict localhost port as Tauri while running the Vite host in test mode.',
);

assert.match(
  desktopPackageJson.scripts['tauri:dev'],
  /ensure-tauri-rust-toolchain\.mjs/,
  'Desktop tauri:dev must verify cargo and rustc availability before starting the desktop shell so Tauri startup does not diverge from the claw-studio baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev'],
  /ensure-tauri-dev-binary-unlocked\.ps1\s+-SrcTauriDir\s+src-tauri\s+-BinaryName\s+sdkwork-birdcoder-desktop/,
  'Desktop tauri:dev must unlock stale BirdCoder desktop binaries before starting cargo so repeated launches do not fail with locked target executables.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev'],
  /run-tauri-cli\.mjs\s+dev/,
  'Desktop tauri:dev must resolve the local @tauri-apps/cli entrypoint through the shared runner instead of depending on shell PATH lookup.',
);
assert.doesNotMatch(
  desktopPackageJson.scripts['tauri:dev'],
  /pnpm exec tauri dev/,
  'Desktop tauri:dev must not invoke the Tauri CLI directly through pnpm exec because that path diverged from the claw-studio desktop startup baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev'],
  /ensure-tauri-dev-port-free\.mjs\s+127\.0\.0\.1\s+1520/,
  'Desktop tauri:dev must verify that port 1520 is free before Tauri launches the desktop Vite host.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev'],
  /ensure-tauri-target-clean\.mjs\s+src-tauri/,
  'Desktop tauri:dev must clean stale Tauri target caches before launching cargo so repeated runs do not inherit invalid permission manifests.',
);

assert.match(
  desktopPackageJson.scripts['tauri:dev:test'],
  /ensure-tauri-rust-toolchain\.mjs/,
  'Desktop tauri:dev:test must verify cargo and rustc availability before starting the desktop shell in test mode.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test'],
  /ensure-tauri-dev-binary-unlocked\.ps1\s+-SrcTauriDir\s+src-tauri\s+-BinaryName\s+sdkwork-birdcoder-desktop/,
  'Desktop tauri:dev:test must unlock stale BirdCoder desktop binaries before starting cargo so repeated launches do not fail with locked target executables.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test'],
  /run-tauri-cli\.mjs\s+dev/,
  'Desktop tauri:dev:test must resolve the local @tauri-apps/cli entrypoint through the shared runner instead of depending on shell PATH lookup.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test'],
  /--vite-mode\s+test/,
  'Desktop tauri:dev:test must forward test mode through the shared Tauri CLI runner environment.',
);
assert.doesNotMatch(
  desktopPackageJson.scripts['tauri:dev:test'],
  /pnpm exec tauri dev/,
  'Desktop tauri:dev:test must not invoke the Tauri CLI directly through pnpm exec because that path diverged from the claw-studio desktop startup baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test'],
  /ensure-tauri-dev-port-free\.mjs\s+127\.0\.0\.1\s+1520/,
  'Desktop tauri:dev:test must verify that port 1520 is free before Tauri launches the desktop Vite host.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test'],
  /ensure-tauri-target-clean\.mjs\s+src-tauri/,
  'Desktop tauri:dev:test must clean stale Tauri target caches before launching cargo so repeated test runs do not inherit invalid permission manifests.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test'],
  /--config\s+src-tauri\/tauri\.test\.conf\.json/,
  'Desktop tauri:dev:test must use the dedicated Tauri test config so beforeDevCommand and beforeBuildCommand run in test mode.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:test'],
  /run-desktop-release-build\.mjs\s+--phase\s+bundle.*--vite-mode\s+test|--vite-mode\s+test.*run-desktop-release-build\.mjs\s+--phase\s+bundle/,
  'Desktop tauri:build:test must route packaged test builds through the shared desktop release-build wrapper in test mode so the wrapper can resolve the dedicated Tauri test config.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build'],
  /ensure-tauri-rust-toolchain\.mjs/,
  'Desktop tauri:build must verify cargo and rustc availability before running packaged desktop builds.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build'],
  /run-desktop-release-build\.mjs\s+--phase\s+bundle/,
  'Desktop tauri:build must route desktop bundle builds through the shared release-build wrapper so Windows packaging can recover from WiX environment failures.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build'],
  /--vite-mode\s+production/,
  'Desktop tauri:build must forward production mode through the shared desktop release-build wrapper.',
);
assert.doesNotMatch(
  desktopPackageJson.scripts['tauri:build'],
  /pnpm exec tauri build/,
  'Desktop tauri:build must not invoke the Tauri CLI directly through pnpm exec because that path diverged from the claw-studio desktop startup baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build'],
  /ensure-tauri-target-clean\.mjs\s+src-tauri/,
  'Desktop tauri:build must clean stale Tauri target caches before invoking cargo build steps.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:test'],
  /ensure-tauri-rust-toolchain\.mjs/,
  'Desktop tauri:build:test must verify cargo and rustc availability before running packaged desktop test builds.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:test'],
  /run-desktop-release-build\.mjs\s+--phase\s+bundle/,
  'Desktop tauri:build:test must route desktop bundle builds through the shared release-build wrapper so Windows packaging can recover from WiX environment failures.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:test'],
  /--vite-mode\s+test/,
  'Desktop tauri:build:test must forward test mode through the shared desktop release-build wrapper.',
);
assert.doesNotMatch(
  desktopPackageJson.scripts['tauri:build:test'],
  /pnpm exec tauri build/,
  'Desktop tauri:build:test must not invoke the Tauri CLI directly through pnpm exec because that path diverged from the claw-studio desktop startup baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:test'],
  /ensure-tauri-target-clean\.mjs\s+src-tauri/,
  'Desktop tauri:build:test must clean stale Tauri target caches before invoking cargo build steps.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:prod'],
  /ensure-tauri-rust-toolchain\.mjs/,
  'Desktop tauri:build:prod must verify cargo and rustc availability before running production desktop builds.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:prod'],
  /run-desktop-release-build\.mjs\s+--phase\s+bundle/,
  'Desktop tauri:build:prod must route desktop bundle builds through the shared release-build wrapper so Windows packaging can recover from WiX environment failures.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:prod'],
  /--vite-mode\s+production/,
  'Desktop tauri:build:prod must forward production mode through the shared desktop release-build wrapper.',
);
assert.doesNotMatch(
  desktopPackageJson.scripts['tauri:build:prod'],
  /pnpm exec tauri build/,
  'Desktop tauri:build:prod must not invoke the Tauri CLI directly through pnpm exec because that path diverged from the claw-studio desktop startup baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:prod'],
  /ensure-tauri-target-clean\.mjs\s+src-tauri/,
  'Desktop tauri:build:prod must clean stale Tauri target caches before invoking cargo build steps.',
);

assert.equal(
  tauriTestConfig.build.beforeDevCommand,
  'pnpm dev:tauri:test',
  'Desktop Tauri test config must start the strict-port desktop Vite host in test mode.',
);
assert.equal(
  tauriTestConfig.build.beforeBuildCommand,
  'pnpm build:test',
  'Desktop Tauri test config must build desktop assets in test mode.',
);
assert.equal(
  tauriTestConfig.build.devUrl,
  'http://127.0.0.1:1520',
  'Desktop Tauri test config must wait on the same strict localhost dev port as development mode.',
);
assert.deepEqual(
  tauriConfig.bundle.icon,
  desktopTauriIconPaths,
  'Desktop Tauri config must declare the packaged icon set explicitly so bundle builds do not fail to resolve icon assets on Windows.',
);
assert.deepEqual(
  tauriTestConfig.bundle.icon,
  desktopTauriIconPaths,
  'Desktop Tauri test config must declare the packaged icon set explicitly so test bundle builds do not fail to resolve icon assets on Windows.',
);
for (const relativeIconPath of desktopTauriIconPaths) {
  assert.ok(
    fs.existsSync(path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop', 'src-tauri', relativeIconPath)),
    `Desktop Tauri bundle icon asset is missing: ${relativeIconPath}.`,
  );
}

assert.match(
  desktopPackageJson.scripts.dev,
  /run-vite-host\.mjs\s+serve/,
  'Desktop dev should use the standard workspace Vite host so standalone desktop shell development matches tauri dev.',
);

assert.match(
  desktopPackageJson.scripts['dev:test'],
  /run-vite-host\.mjs\s+serve/,
  'Desktop dev:test should use the standard workspace Vite host so standalone desktop shell development matches tauri dev.',
);

assert.doesNotMatch(
  desktopViteConfigSource,
  /preserveSymlinks\s*:\s*true/,
  'Desktop Vite config must follow the claw-studio-style root dependency strategy instead of preserving symlinked package paths.',
);

assert.match(
  desktopViteConfigSource,
  /dedupe\s*:\s*\[\.\.\.desktopDedupePackages\]/,
  'Desktop Vite config must dedupe shared runtime packages so root-managed dependencies resolve consistently.',
);

assert.match(
  desktopViteHostSource,
  /vite-windows-realpath-patch\.mjs/,
  'Desktop Vite host must import the Windows realpath patch so normal Vite realpath resolution does not fail with spawn EPERM.',
);

assert.match(
  desktopViteConfigSource,
  /esbuild\s*:\s*false/,
  'Desktop Vite config must disable the built-in esbuild transform path so desktop dev does not fail with spawn EPERM in this Windows environment.',
);

assert.match(
  desktopViteConfigSource,
  /createDesktopVitePlugins/u,
  'Desktop Vite config must use the shared desktop React compatibility plugin chain so React CommonJS runtime files are served as browser-safe ESM.',
);
assert.match(
  desktopCargoTomlSource,
  /^tauri-plugin-dialog\s*=\s*"2"$/m,
  'Desktop Cargo manifest must include the Tauri dialog plugin crate so folder-open permissions are backed by a registered Rust plugin.',
);
assert.match(
  desktopCargoTomlSource,
  /^tauri-plugin-shell\s*=\s*"2"$/m,
  'Desktop Cargo manifest must include the Tauri shell plugin crate so window reveal and git shell commands are backed by a registered Rust plugin.',
);
assert.match(
  desktopLibRsSource,
  /\.plugin\(tauri_plugin_dialog::init\(\)\)/,
  'Desktop runtime must register the dialog plugin so frontend folder-open calls can cross the Tauri boundary.',
);
assert.match(
  desktopLibRsSource,
  /\.plugin\(tauri_plugin_shell::init\(\)\)/,
  'Desktop runtime must register the shell plugin so frontend open and command execution calls can cross the Tauri boundary.',
);
assert.ok(
  fs.existsSync(desktopCapabilityPath),
  'Desktop Tauri app must declare a capability file for the main BirdCoder window so non-default commands do not fail with runtime "not allowed" errors.',
);
const desktopCapability = JSON.parse(fs.readFileSync(desktopCapabilityPath, 'utf8'));
assert.equal(
  desktopCapability.identifier,
  'default',
  'Desktop main-window capability must expose a stable default identifier.',
);
assert.deepEqual(
  desktopCapability.windows,
  ['main'],
  'Desktop main-window capability must target the explicit "main" Tauri window label.',
);
for (const permission of [
  'core:default',
  'default',
  'dialog:allow-open',
  'shell:allow-open',
  'core:window:allow-start-dragging',
  'core:window:allow-minimize',
  'core:window:allow-toggle-maximize',
  'core:window:allow-close',
]) {
  assert.ok(
    desktopCapability.permissions.includes(permission),
    `Desktop main-window capability must include ${permission}.`,
  );
}
const shellExecutePermissionEntry = desktopCapability.permissions.find(
  (permissionEntry) =>
    typeof permissionEntry === 'object' &&
    permissionEntry !== null &&
    permissionEntry.identifier === 'shell:allow-execute',
);
assert.ok(
  shellExecutePermissionEntry,
  'Desktop main-window capability must include a scoped shell:allow-execute entry for the command-execution surfaces used by the code workbench.',
);
assert.ok(
  Array.isArray(shellExecutePermissionEntry.allow) &&
    shellExecutePermissionEntry.allow.some(
      (scopeEntry) =>
        scopeEntry &&
        typeof scopeEntry === 'object' &&
        scopeEntry.name === 'sh' &&
        scopeEntry.cmd === 'sh',
    ),
  'Desktop shell execute capability must whitelist the scoped sh command used by the BirdCoder git workflow.',
);
assert.ok(
  fs.existsSync(desktopAppPermissionsPath),
  'Desktop Tauri app must declare an application permission manifest for custom Rust commands so capability validation can cover desktop host bridges.',
);
const desktopAppPermissionsSource = fs.readFileSync(desktopAppPermissionsPath, 'utf8');
for (const command of [
  'host_mode',
  'local_store_get',
  'local_store_set',
  'local_store_delete',
  'local_store_list',
  'terminal_session_upsert',
  'terminal_session_delete',
  'terminal_session_list',
  'terminal_host_session_open',
  'terminal_host_session_execute',
  'terminal_host_session_close',
  'terminal_cli_profile_detect',
  'execute_terminal_command',
]) {
  assert.match(
    desktopAppPermissionsSource,
    new RegExp(`"${command}"`),
    `Desktop application permission manifest must allow the ${command} Rust command.`,
  );
}
assert.match(
  appSource,
  /\.startDragging\(\)/,
  'The custom application header must start dragging the frameless Tauri window so removing native decorations does not break window movement.',
);
assert.match(
  appSource,
  /onMouseDown=\{handleTitleBarMouseDown\}/,
  'The custom application header must wire the desktop drag handler at the title-bar container level.',
);
const titleBarMouseDownHandlerMatch = appSource.match(
  /const handleTitleBarMouseDown = async \(event: React\.MouseEvent<HTMLDivElement>\) => \{([\s\S]*?)\n  \};/u,
);
assert.ok(
  titleBarMouseDownHandlerMatch,
  'Desktop app source must define a handleTitleBarMouseDown handler for the custom title bar.',
);
assert.doesNotMatch(
  titleBarMouseDownHandlerMatch[1],
  /window\.__TAURI__/,
  'The custom title-bar drag handler must not depend on window.__TAURI__ because that global is not a reliable desktop runtime detector in the Tauri shell.',
);

const windowControlsHandlerBlockMatch = appSource.match(
  /const handleMinimize = async \(\) => \{[\s\S]*?const handleOpenFolder = async \(\) => \{/u,
);
assert.ok(
  windowControlsHandlerBlockMatch,
  'Desktop app source must define minimize, maximize, and close handlers before the open-folder action.',
);
assert.doesNotMatch(
  windowControlsHandlerBlockMatch[0],
  /Not running in Tauri/u,
  'Desktop window controls must not collapse any runtime failure into a misleading "Not running in Tauri" warning when the app is actually running inside the Tauri shell.',
);

assert.match(
  desktopIndexHtmlSource,
  /rel=["']icon["']/,
  'Desktop shell index.html must declare an icon link so dev startup does not request an undefined default favicon path.',
);

assert.ok(
  fs.existsSync(desktopFaviconPath),
  'Desktop shell must provide public/favicon.ico so dev startup does not 404 on the browser favicon request.',
);

assert.ok(
  fs.existsSync(tauriDevBinaryUnlockScriptPath),
  'Desktop Tauri dev contract requires the shared Tauri dev binary unlock guard script to exist at the workspace root.',
);
assert.ok(
  fs.existsSync(tauriRustToolchainScriptPath),
  'Desktop Tauri dev contract requires the shared Rust toolchain guard script to exist at the workspace root.',
);
assert.ok(
  fs.existsSync(tauriDevPortGuardScriptPath),
  'Desktop Tauri dev contract requires the shared Tauri dev port guard script to exist at the workspace root.',
);
assert.ok(
  fs.existsSync(tauriCliRunnerScriptPath),
  'Desktop Tauri dev contract requires the shared Tauri CLI runner script to exist at the workspace root.',
);
assert.ok(
  fs.existsSync(tauriTargetCleanScriptPath),
  'Desktop Tauri dev contract requires the shared stale-target cleanup script to exist at the workspace root.',
);

console.log('desktop tauri dev contract passed.');
