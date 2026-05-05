import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const rootPackageJsonPath = path.join(rootDir, 'package.json');
const npmrcPath = path.join(rootDir, '.npmrc');
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
const workspacePackageScriptRunnerPath = path.join(rootDir, 'scripts', 'run-workspace-package-script.mjs');
const appSourcePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-shell',
  'src',
  'application',
  'app',
  'BirdcoderApp.tsx',
);
const appWorkspaceMenuSourcePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-shell',
  'src',
  'application',
  'app',
  'AppWorkspaceMenu.tsx',
);
const codeTopBarPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'components',
  'TopBar.tsx',
);
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

const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const npmrcSource = fs.readFileSync(npmrcPath, 'utf8');
const desktopPackageJson = JSON.parse(fs.readFileSync(desktopPackageJsonPath, 'utf8'));
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
const tauriTestConfig = JSON.parse(fs.readFileSync(tauriTestConfigPath, 'utf8'));
const desktopCargoTomlSource = fs.readFileSync(desktopCargoTomlPath, 'utf8');
const desktopBuildRsSource = fs.readFileSync(desktopBuildRsPath, 'utf8');
const desktopLibRsSource = fs.readFileSync(desktopLibRsPath, 'utf8');
const desktopViteConfigSource = fs.readFileSync(desktopViteConfigPath, 'utf8');
const desktopViteHostSource = fs.readFileSync(desktopViteHostPath, 'utf8');
const appSource = fs.readFileSync(appSourcePath, 'utf8');
const appWorkspaceMenuSource = fs.readFileSync(appWorkspaceMenuSourcePath, 'utf8');
const codeTopBarSource = fs.readFileSync(codeTopBarPath, 'utf8');
const desktopIndexHtmlSource = fs.readFileSync(desktopIndexHtmlPath, 'utf8');
const workspacePackageScriptRunnerSource = fs.existsSync(workspacePackageScriptRunnerPath)
  ? fs.readFileSync(workspacePackageScriptRunnerPath, 'utf8')
  : '';

assert.match(
  npmrcSource,
  /shell-emulator\s*=\s*true/,
  'Workspace pnpm config must enable shell-emulator so Windows pnpm scripts can resolve node-backed entrypoints without depending on cmd.exe PATH forwarding.',
);

assert.equal(
  rootPackageJson.scripts['tauri:dev'],
  'node scripts/run-workspace-package-script.mjs packages/sdkwork-birdcoder-desktop tauri:dev',
  'Root tauri:dev must enter the desktop package through the bounded workspace package-script runner instead of reopening pnpm --dir on Windows.',
);
assert.equal(
  rootPackageJson.scripts['tauri:dev:test'],
  'node scripts/run-workspace-package-script.mjs packages/sdkwork-birdcoder-desktop tauri:dev:test',
  'Root tauri:dev:test must enter the desktop package through the bounded workspace package-script runner instead of reopening pnpm --dir on Windows.',
);
assert.equal(
  rootPackageJson.scripts['tauri:build'],
  'node scripts/run-workspace-package-script.mjs packages/sdkwork-birdcoder-desktop tauri:build',
  'Root tauri:build must enter the desktop package through the bounded workspace package-script runner instead of reopening pnpm --dir on Windows.',
);
assert.equal(
  rootPackageJson.scripts['tauri:build:test'],
  'node scripts/run-workspace-package-script.mjs packages/sdkwork-birdcoder-desktop tauri:build:test',
  'Root tauri:build:test must enter the desktop package through the bounded workspace package-script runner instead of reopening pnpm --dir on Windows.',
);
assert.equal(
  rootPackageJson.scripts['tauri:build:prod'],
  'node scripts/run-workspace-package-script.mjs packages/sdkwork-birdcoder-desktop tauri:build:prod',
  'Root tauri:build:prod must enter the desktop package through the bounded workspace package-script runner instead of reopening pnpm --dir on Windows.',
);
assert.equal(
  rootPackageJson.scripts['tauri:info'],
  'node scripts/run-workspace-package-script.mjs packages/sdkwork-birdcoder-desktop tauri:info',
  'Root tauri:info must enter the desktop package through the bounded workspace package-script runner instead of reopening pnpm --dir on Windows.',
);
assert.ok(
  fs.existsSync(workspacePackageScriptRunnerPath),
  'Desktop tauri dev contract requires the shared workspace package-script runner to exist at the workspace root.',
);
assert.match(
  workspacePackageScriptRunnerSource,
  /export function createWorkspacePackageScriptPlan\(/,
  'Workspace package-script runner must expose an explicit plan builder so root desktop entrypoints stay verifiable.',
);
assert.match(
  workspacePackageScriptRunnerSource,
  /runWorkspacePackageScriptCli/u,
  'Workspace package-script runner must expose a direct CLI path for the root tauri:* scripts.',
);

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
  desktopPackageJson.scripts['tauri:dev:base'],
  /ensure-tauri-rust-toolchain\.mjs/,
  'Desktop tauri:dev:base must verify cargo and rustc availability before starting the desktop shell so Tauri startup does not diverge from the claw-studio baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:base'],
  /run-tauri-dev-binary-unlock\.mjs\s+--src-tauri-dir\s+src-tauri\s+--binary-name\s+sdkwork-birdcoder-desktop/,
  'Desktop tauri:dev:base must unlock stale BirdCoder desktop binaries before starting cargo so repeated launches do not fail with locked target executables.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:base'],
  /run-tauri-cli\.mjs\s+dev/,
  'Desktop tauri:dev:base must resolve the local @tauri-apps/cli entrypoint through the shared runner instead of depending on shell PATH lookup.',
);
assert.doesNotMatch(
  desktopPackageJson.scripts['tauri:dev:base'],
  /pnpm exec tauri dev/,
  'Desktop tauri:dev:base must not invoke the Tauri CLI directly through pnpm exec because that path diverged from the claw-studio desktop startup baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:base'],
  /ensure-tauri-dev-port-free\.mjs\s+127\.0\.0\.1\s+1520/,
  'Desktop tauri:dev:base must verify that port 1520 is free before Tauri launches the desktop Vite host.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:base'],
  /ensure-tauri-target-clean\.mjs\s+src-tauri/,
  'Desktop tauri:dev:base must clean stale Tauri target caches before launching cargo so repeated runs do not inherit invalid permission manifests.',
);

assert.match(
  desktopPackageJson.scripts['tauri:dev:test:base'],
  /ensure-tauri-rust-toolchain\.mjs/,
  'Desktop tauri:dev:test:base must verify cargo and rustc availability before starting the desktop shell in test mode.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test:base'],
  /run-tauri-dev-binary-unlock\.mjs\s+--src-tauri-dir\s+src-tauri\s+--binary-name\s+sdkwork-birdcoder-desktop/,
  'Desktop tauri:dev:test:base must unlock stale BirdCoder desktop binaries before starting cargo so repeated launches do not fail with locked target executables.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test:base'],
  /run-tauri-cli\.mjs\s+dev/,
  'Desktop tauri:dev:test:base must resolve the local @tauri-apps/cli entrypoint through the shared runner instead of depending on shell PATH lookup.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test:base'],
  /--vite-mode\s+test/,
  'Desktop tauri:dev:test:base must forward test mode through the shared Tauri CLI runner environment.',
);
assert.doesNotMatch(
  desktopPackageJson.scripts['tauri:dev:test:base'],
  /pnpm exec tauri dev/,
  'Desktop tauri:dev:test:base must not invoke the Tauri CLI directly through pnpm exec because that path diverged from the claw-studio desktop startup baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test:base'],
  /ensure-tauri-dev-port-free\.mjs\s+127\.0\.0\.1\s+1520/,
  'Desktop tauri:dev:test:base must verify that port 1520 is free before Tauri launches the desktop Vite host.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test:base'],
  /ensure-tauri-target-clean\.mjs\s+src-tauri/,
  'Desktop tauri:dev:test:base must clean stale Tauri target caches before launching cargo so repeated test runs do not inherit invalid permission manifests.',
);
assert.match(
  desktopPackageJson.scripts['tauri:dev:test:base'],
  /--config\s+src-tauri\/tauri\.test\.conf\.json/,
  'Desktop tauri:dev:test:base must use the dedicated Tauri test config so beforeDevCommand and beforeBuildCommand run in test mode.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:test:base'],
  /run-desktop-release-build\.mjs\s+--phase\s+bundle.*--vite-mode\s+test|--vite-mode\s+test.*run-desktop-release-build\.mjs\s+--phase\s+bundle/,
  'Desktop tauri:build:test:base must route packaged test builds through the shared desktop release-build wrapper in test mode so the wrapper can resolve the dedicated Tauri test config.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:base'],
  /ensure-tauri-rust-toolchain\.mjs/,
  'Desktop tauri:build:base must verify cargo and rustc availability before running packaged desktop builds.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:base'],
  /run-desktop-release-build\.mjs\s+--phase\s+bundle/,
  'Desktop tauri:build:base must route desktop bundle builds through the shared release-build wrapper so Windows packaging can recover from WiX environment failures.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:base'],
  /--vite-mode\s+production/,
  'Desktop tauri:build:base must forward production mode through the shared desktop release-build wrapper.',
);
assert.doesNotMatch(
  desktopPackageJson.scripts['tauri:build:base'],
  /pnpm exec tauri build/,
  'Desktop tauri:build:base must not invoke the Tauri CLI directly through pnpm exec because that path diverged from the claw-studio desktop startup baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:base'],
  /ensure-tauri-target-clean\.mjs\s+src-tauri/,
  'Desktop tauri:build:base must clean stale Tauri target caches before invoking cargo build steps.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:test:base'],
  /ensure-tauri-rust-toolchain\.mjs/,
  'Desktop tauri:build:test:base must verify cargo and rustc availability before running packaged desktop test builds.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:test:base'],
  /run-desktop-release-build\.mjs\s+--phase\s+bundle/,
  'Desktop tauri:build:test:base must route desktop bundle builds through the shared release-build wrapper so Windows packaging can recover from WiX environment failures.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:test:base'],
  /--vite-mode\s+test/,
  'Desktop tauri:build:test:base must forward test mode through the shared desktop release-build wrapper.',
);
assert.doesNotMatch(
  desktopPackageJson.scripts['tauri:build:test:base'],
  /pnpm exec tauri build/,
  'Desktop tauri:build:test:base must not invoke the Tauri CLI directly through pnpm exec because that path diverged from the claw-studio desktop startup baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:test:base'],
  /ensure-tauri-target-clean\.mjs\s+src-tauri/,
  'Desktop tauri:build:test:base must clean stale Tauri target caches before invoking cargo build steps.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:prod:base'],
  /ensure-tauri-rust-toolchain\.mjs/,
  'Desktop tauri:build:prod:base must verify cargo and rustc availability before running production desktop builds.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:prod:base'],
  /run-desktop-release-build\.mjs\s+--phase\s+bundle/,
  'Desktop tauri:build:prod:base must route desktop bundle builds through the shared release-build wrapper so Windows packaging can recover from WiX environment failures.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:prod:base'],
  /--vite-mode\s+production/,
  'Desktop tauri:build:prod:base must forward production mode through the shared desktop release-build wrapper.',
);
assert.doesNotMatch(
  desktopPackageJson.scripts['tauri:build:prod:base'],
  /pnpm exec tauri build/,
  'Desktop tauri:build:prod:base must not invoke the Tauri CLI directly through pnpm exec because that path diverged from the claw-studio desktop startup baseline.',
);
assert.match(
  desktopPackageJson.scripts['tauri:build:prod:base'],
  /ensure-tauri-target-clean\.mjs\s+src-tauri/,
  'Desktop tauri:build:prod:base must clean stale Tauri target caches before invoking cargo build steps.',
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
  /dedupe\s*:\s*\[\.\.\.(?:desktopDedupePackages|BIRDCODER_VITE_DEDUPE_PACKAGES)\]/,
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
  desktopCargoTomlSource,
  /^sdkwork-birdcoder-server\s*=\s*\{\s*path\s*=\s*"\.\.\/\.\.\/sdkwork-birdcoder-server\/src-host"\s*\}$/m,
  'Desktop Cargo manifest must depend on the local sdkwork-birdcoder-server crate so the desktop shell can bootstrap the embedded localhost API without requiring a separately managed sidecar process.',
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
assert.match(
  desktopLibRsSource,
  /\.setup\(/,
  'Desktop runtime must attach a setup hook so the local BirdCoder server can start before the window bootstraps API-backed workbench data.',
);
assert.match(
  desktopLibRsSource,
  /start_embedded_coding_server\(/,
  'Desktop runtime setup must call an embedded server bootstrap helper so localhost API requests do not race against an unstarted Rust server.',
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
assert.equal(
  shellExecutePermissionEntry,
  undefined,
  'Desktop main-window capability must not expose Tauri shell execution because workbench Git and terminal actions use typed application bridges instead of plugin-shell Command.create.',
);
assert.doesNotMatch(
  codeTopBarSource,
  /Command\.create\('sh'/,
  'Desktop code workbench Git actions must execute git directly instead of shelling through sh -c.',
);
assert.doesNotMatch(
  codeTopBarSource,
  /Command\.create\(/,
  'Desktop code workbench Git actions must not use the browser-facing Tauri shell execute API; command execution must stay behind typed service bridges.',
);
assert.doesNotMatch(
  codeTopBarSource,
  /changesCommittedMock|pushedToRemoteMock|createdAndSwitchedBranchMock|switchedToBranchMock/,
  'Desktop code workbench Git actions must not fall back to mock-success toasts when the runtime cannot execute a real Git command.',
);
assert.ok(
  fs.existsSync(desktopAppPermissionsPath),
  'Desktop Tauri app must declare an application permission manifest for custom Rust commands so capability validation can cover desktop host bridges.',
);
const desktopAppPermissionsSource = fs.readFileSync(desktopAppPermissionsPath, 'utf8');
for (const command of [
  'host_mode',
  'desktop_runtime_config',
  'local_store_get',
  'local_store_set',
  'local_store_delete',
  'local_store_list',
  'local_sql_execute_plan',
  'terminal_cli_profile_detect',
  'desktop_session_index',
  'desktop_session_replay_slice',
  'desktop_session_attach',
  'desktop_session_detach',
  'desktop_session_reattach',
  'desktop_terminal_session_inventory_list',
  'desktop_local_shell_exec',
  'desktop_local_shell_session_create',
  'desktop_local_process_session_create',
  'desktop_session_input',
  'desktop_session_input_bytes',
  'desktop_session_attachment_acknowledge',
  'desktop_session_resize',
  'desktop_session_terminate',
]) {
  assert.match(
    desktopAppPermissionsSource,
    new RegExp(`"${command}"`),
    `Desktop application permission manifest must allow the ${command} Rust command.`,
  );
}
assert.match(
  desktopLibRsSource,
  /const USER_HOME_CONFIG_RELATIVE_ROOT:\s*&str\s*=\s*"\.sdkwork\/birdcoder";/,
  'Desktop user_home_config bridge must define ~/.sdkwork/birdcoder as the only writable home config root.',
);
assert.match(
  desktopLibRsSource,
  /normalized_relative_path\.starts_with\(USER_HOME_CONFIG_RELATIVE_ROOT\)/,
  'Desktop user_home_config bridge must reject relative paths outside ~/.sdkwork/birdcoder before reading or writing.',
);
assert.match(
  desktopLibRsSource,
  /resolve_user_home_config_path\("\.sdkwork\/birdcoder\/code-engine-models\.json"\)/,
  'Desktop Rust tests must cover the canonical code-engine model config path under ~/.sdkwork/birdcoder.',
);
assert.match(
  desktopLibRsSource,
  /resolve_user_home_config_path\("\.ssh\/config"\)\.is_err\(\)/,
  'Desktop Rust tests must prove user_home_config cannot read or write arbitrary home files such as ~/.ssh/config.',
);
for (const forbiddenLegacyCommand of [
  'terminal_session_upsert',
  'terminal_session_delete',
  'terminal_session_list',
  'terminal_host_session_open',
  'terminal_host_session_execute',
  'terminal_host_session_close',
  'execute_terminal_command',
]) {
  assert.doesNotMatch(
    desktopAppPermissionsSource,
    new RegExp(`"${forbiddenLegacyCommand}"`),
    `Desktop application permission manifest must remove deprecated terminal command ${forbiddenLegacyCommand}.`,
  );
}
assert.match(
  appSource,
  /\.startDragging\(\)/,
  'The custom application header must start dragging the frameless Tauri window so removing native decorations does not break window movement.',
);
assert.match(
  appSource,
  /onPointerDown=\{handleTitleBarPointerDown\}/,
  'The custom application header must wire the pointer-based desktop drag handler at the title-bar container level.',
);
assert.match(
  appSource,
  /const \[isDesktopWindowMaximized, setIsDesktopWindowMaximized\] = useState\(false\);/,
  'Desktop app source must track the native maximized state so the custom header can react immediately to maximize and restore transitions.',
);
assert.match(
  appSource,
  /const \[isDesktopWindowMinimized, setIsDesktopWindowMinimized\] = useState\(false\);/,
  'Desktop app source must track the native minimized state so the custom shell can resynchronize window state after minimize and restore transitions.',
);
assert.match(
  appSource,
  /\.onResized\(/,
  'Desktop app source must subscribe to native window resize events so maximize and restore transitions update React state without waiting for unrelated renders.',
);
assert.match(
  appSource,
  /\.isMaximized\(\)/,
  'Desktop app source must read the native maximized state from Tauri instead of inferring it from delayed browser layout behavior.',
);
assert.match(
  appSource,
  /\.isMinimized\(\)/,
  'Desktop app source must read the native minimized state from Tauri instead of inferring it from delayed browser layout behavior.',
);
assert.match(
  appSource,
  /title=\{isDesktopWindowMaximized \? t\('common\.restore'\) : t\('app\.menu\.maximize'\)\}/,
  'The custom maximize button must switch to restore semantics immediately when the native window is maximized.',
);
assert.match(
  appSource,
  /onContextMenu=\{handleTitleBarContextMenu\}/,
  'The custom application header must wire the title-bar context-menu suppression handler so long-press dragging does not compete with desktop context menus.',
);
assert.match(
  appSource,
  /onDragStart=\{handleTitleBarDragStart\}/,
  'The custom application header must suppress native dragstart on the custom title bar so the long-press window drag interaction stays authoritative.',
);
assert.match(
  appSource,
  /onDoubleClick=\{handleTitleBarDoubleClick\}/,
  'The custom application header must keep a dedicated double-click handler so desktop maximize behavior stays attached to the custom title bar.',
);
assert.match(
  appSource,
  /touch-none/,
  'The custom application header must disable browser touch actions at the title-bar root so long-press dragging is not pre-empted by default pointer gestures.',
);
assert.match(
  appSource,
  /const titleBarDragEnabled = isDesktopWindowAvailable && !isDocumentFullscreen;/,
  'The custom application header must only expose drag affordances when the desktop shell is active and the document is not fullscreen.',
);
assert.ok(
  (
    (appSource.match(/data-no-drag="true"/g) ?? []).length
    + (appWorkspaceMenuSource.match(/data-no-drag="true"/g) ?? []).length
  ) >= 4,
  'The custom application header must mark interactive title-bar regions as data-no-drag so menus and window controls do not accidentally start a pending window drag.',
);
assert.match(
  appWorkspaceMenuSource,
  /<button\r?\n\s+type="button"\r?\n\s+data-no-drag="true"[\s\S]*?aria-haspopup="menu"/u,
  'The workspace menu trigger must stay data-no-drag so clicking the active workspace/project selector never starts window movement.',
);
assert.match(
  appWorkspaceMenuSource,
  /<div\r?\n\s+data-no-drag="true"\r?\n\s+className="absolute top-full/u,
  'The workspace menu popover must stay data-no-drag so project and workspace controls inside the menu remain fully interactive.',
);
assert.doesNotMatch(
  appSource,
  /<div\r?\n\s+data-no-drag="true"\r?\n\s+className="flex min-w-0 items-center justify-center"\r?\n\s+>\r?\n\s+\{centerContent\}/u,
  'The custom application header must not mark the whole center title-bar slot as data-no-drag because empty title-bar space must remain draggable when the restored desktop window is moved.',
);
assert.match(
  appSource,
  /<div\r?\n\s+className="flex min-w-0 items-center justify-center"\r?\n\s+>\r?\n\s+\{centerContent\}/u,
  'The custom application header must keep the center title-bar slot as draggable surface while the nested workspace menu button and popover own their data-no-drag exclusions.',
);
const titleBarPointerDownHandlerMatch = appSource.match(
  /const handleTitleBarPointerDown = \(event: React\.PointerEvent<HTMLDivElement>\) => \{([\s\S]*?)\n  \};/u,
);
assert.ok(
  titleBarPointerDownHandlerMatch,
  'Desktop app source must define a handleTitleBarPointerDown handler for the custom title bar.',
);
assert.doesNotMatch(
  titleBarPointerDownHandlerMatch[1],
  /window\.__TAURI__/,
  'The custom title-bar pointer drag handler must not depend on window.__TAURI__ because that global is not a reliable desktop runtime detector in the Tauri shell.',
);
assert.match(
  titleBarPointerDownHandlerMatch[1],
  /titleBarWindowDragControllerRef\.current\?\.handlePointerDown/,
  'The custom title-bar pointer handler must delegate long-press behavior through the shared drag controller instead of inlining ad-hoc timer logic.',
);
assert.match(
  titleBarPointerDownHandlerMatch[1],
  /event\.preventDefault\(\)/,
  'The custom title-bar pointer handler must prevent the default browser action when it arms a pending long-press window drag.',
);

const titleBarControllerFactoryMatch = appSource.match(
  /createAppHeaderWindowDragController\(\{\s*[\s\S]*?canStartDragging: \(\) =>\s*([\s\S]*?),\s*startDragging:/u,
);
assert.ok(
  titleBarControllerFactoryMatch,
  'Desktop app source must configure the shared app-header drag controller with an explicit canStartDragging guard.',
);
assert.match(
  titleBarControllerFactoryMatch[1],
  /isDesktopWindowAvailableRef\.current && !isDocumentFullscreenRef\.current/,
  'The shared app-header drag controller must only arm window dragging when the desktop runtime is available and the document is not fullscreen.',
);
assert.match(
  appSource,
  /const desktopWindowHandleRef = useRef<DesktopWindowHandle \| null>\(null\);/,
  'Desktop app source must cache the resolved Tauri window handle so title-bar mouse dragging can call startDragging during the original pointer gesture.',
);
const titleBarStartDraggingHandlerMatch = appSource.match(
  /startDragging: \(\) => \{([\s\S]*?)\r?\n      \},\r?\n    \}\);/u,
);
assert.ok(
  titleBarStartDraggingHandlerMatch,
  'Desktop app source must provide a synchronous title-bar startDragging callback for the shared drag controller.',
);
assert.match(
  titleBarStartDraggingHandlerMatch[1],
  /desktopWindowHandleRef\.current/,
  'The title-bar startDragging callback must use the cached Tauri window handle before falling back to async resolution.',
);
assert.doesNotMatch(
  titleBarStartDraggingHandlerMatch[1],
  /await getDesktopWindow\(\)[\s\S]*?\.startDragging\(\)/,
  'The title-bar startDragging callback must not await getDesktopWindow before calling startDragging because that loses the native pointer gesture needed for restored-window dragging.',
);

const titleBarContextMenuHandlerMatch = appSource.match(
  /const handleTitleBarContextMenu = \(event: React\.MouseEvent<HTMLDivElement>\) => \{([\s\S]*?)\n  \};/u,
);
assert.ok(
  titleBarContextMenuHandlerMatch,
  'Desktop app source must define a dedicated title-bar context-menu handler for the custom header.',
);
assert.match(
  titleBarContextMenuHandlerMatch[1],
  /!titleBarDragEnabled \|\| isAppHeaderNoDragTarget\(event\.target\)/,
  'The custom title-bar context-menu handler must skip suppression when dragging is disabled or the pointer is inside a data-no-drag region.',
);
assert.match(
  titleBarContextMenuHandlerMatch[1],
  /event\.preventDefault\(\)/,
  'The custom title-bar context-menu handler must suppress the native menu on draggable title-bar space so long-press dragging remains predictable.',
);

const titleBarDragStartHandlerMatch = appSource.match(
  /const handleTitleBarDragStart = \(event: React\.DragEvent<HTMLDivElement>\) => \{([\s\S]*?)\n  \};/u,
);
assert.ok(
  titleBarDragStartHandlerMatch,
  'Desktop app source must define a dragstart suppression handler for the custom title bar.',
);
assert.match(
  titleBarDragStartHandlerMatch[1],
  /!titleBarDragEnabled \|\| isAppHeaderNoDragTarget\(event\.target\)/,
  'The custom title-bar dragstart handler must only suppress native dragging on active draggable title-bar regions.',
);
assert.match(
  titleBarDragStartHandlerMatch[1],
  /event\.preventDefault\(\)/,
  'The custom title-bar dragstart handler must prevent native browser dragging so the Tauri window drag interaction remains authoritative.',
);

const titleBarDoubleClickHandlerMatch = appSource.match(
  /const handleTitleBarDoubleClick = async \(event: React\.MouseEvent<HTMLDivElement>\) => \{([\s\S]*?)\n  \};/u,
);
assert.ok(
  titleBarDoubleClickHandlerMatch,
  'Desktop app source must define a title-bar double-click handler for maximize toggling.',
);
assert.match(
  titleBarDoubleClickHandlerMatch[1],
  /isDocumentFullscreenRef\.current/,
  'The custom title-bar double-click handler must not toggle desktop maximize while the document is fullscreen.',
);
assert.match(
  titleBarDoubleClickHandlerMatch[1],
  /isAppHeaderNoDragTarget\(event\.target\)/,
  'The custom title-bar double-click handler must ignore no-drag regions so menus and controls do not trigger maximize toggling.',
);

const windowControlsHandlerBlockMatch = appSource.match(
  /const handleMinimize = (?:async \(\) => \{|useCallback\(async \(\) => \{)[\s\S]*?const handleOpenFolder = (?:async \(\) => \{|useCallback\(async \(\) => \{)/u,
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
