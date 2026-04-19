import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const terminalPackageIndexPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-terminal',
  'src',
  'index.ts',
);
const terminalFacadePagePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-terminal',
  'src',
  'TerminalPage.tsx',
);
const legacyTerminalPagePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-terminal',
  'src',
  'pages',
  'TerminalPage.tsx',
);
const legacyTerminalLaunchPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-terminal',
  'src',
  'pages',
  'terminalRequestLaunch.ts',
);
const legacyTypeBridgesPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-terminal',
  'src',
  'type-bridges',
);
const terminalPackageTsconfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-terminal',
  'tsconfig.json',
);
const terminalPackageManifestPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-terminal',
  'package.json',
);
const commonsPackageManifestPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'package.json',
);
const externalTerminalPackagesRootDir = path.join(
  rootDir,
  '..',
  'sdkwork-terminal',
  'packages',
);
const sharedLaunchAdapterPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'terminal',
  'sdkworkTerminalLaunch.ts',
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
const terminalInfrastructureSourcePath = path.join(
  rootDir,
  '..',
  'sdkwork-terminal',
  'packages',
  'sdkwork-terminal-infrastructure',
  'src',
  'index.ts',
);
const terminalShellSourcePath = path.join(
  rootDir,
  '..',
  'sdkwork-terminal',
  'packages',
  'sdkwork-terminal-shell',
  'src',
  'index.tsx',
);
const terminalPackageIndexSource = readFileSync(terminalPackageIndexPath, 'utf8');
const terminalPackageTsconfigSource = readFileSync(terminalPackageTsconfigPath, 'utf8');
const terminalPackageManifest = JSON.parse(readFileSync(terminalPackageManifestPath, 'utf8'));
const commonsPackageManifest = JSON.parse(readFileSync(commonsPackageManifestPath, 'utf8'));
const tsconfigSource = readFileSync(tsconfigPath, 'utf8');
const webViteConfigSource = readFileSync(webViteConfigPath, 'utf8');
const desktopViteConfigSource = readFileSync(desktopViteConfigPath, 'utf8');
const desktopCargoTomlSource = readFileSync(desktopCargoTomlPath, 'utf8');
const desktopPermissionsSource = readFileSync(desktopPermissionsPath, 'utf8');
const desktopLibRsSource = readFileSync(desktopLibRsPath, 'utf8');
const terminalInfrastructureSource = readFileSync(terminalInfrastructureSourcePath, 'utf8');
const terminalShellSource = readFileSync(terminalShellSourcePath, 'utf8');

function normalizeManifestDependencyPath(rawPath: string) {
  return rawPath.replace(/\\/gu, '/');
}

function buildExpectedExternalTerminalLinkVersion(
  manifestPath: string,
  dependencyName: string,
) {
  const manifestDir = path.dirname(manifestPath);
  const externalPackageDirName = dependencyName.replace(/^@sdkwork\//u, 'sdkwork-');
  const externalPackageDir = path.join(externalTerminalPackagesRootDir, externalPackageDirName);
  const relativeExternalPackageDir = path.relative(manifestDir, externalPackageDir);
  return `link:${normalizeManifestDependencyPath(relativeExternalPackageDir)}`;
}

assert.equal(
  existsSync(legacyTerminalPagePath),
  false,
  'BirdCoder terminal package must delete the legacy pages/TerminalPage.tsx implementation.',
);
assert.equal(
  existsSync(legacyTerminalLaunchPath),
  false,
  'BirdCoder terminal package must delete the legacy pages/terminalRequestLaunch.ts implementation.',
);
assert.equal(
  existsSync(legacyTypeBridgesPath),
  false,
  'BirdCoder terminal package must delete local type-bridge shims once sdkwork-terminal is adopted directly.',
);
assert.equal(
  existsSync(terminalFacadePagePath),
  true,
  'BirdCoder terminal package must expose a thin TerminalPage facade at src/TerminalPage.tsx.',
);
assert.equal(
  existsSync(sharedLaunchAdapterPath),
  true,
  'BirdCoder commons must expose a shared sdkwork-terminal launch adapter.',
);
assert.equal(
  existsSync(terminalShellSourcePath),
  true,
  'sdkwork-terminal-shell must exist and expose a reusable desktop terminal host surface component.',
);

const terminalFacadePageSource = readFileSync(terminalFacadePagePath, 'utf8');
const sharedLaunchAdapterSource = readFileSync(sharedLaunchAdapterPath, 'utf8');

assert.match(
  terminalPackageIndexSource,
  /export \* from ['"]\.\/TerminalPage['"]/u,
  'BirdCoder terminal package index must only re-export the thin facade page entry.',
);
assert.doesNotMatch(
  terminalPackageIndexSource,
  /pages\/TerminalPage/u,
  'BirdCoder terminal package index must not re-export the deleted pages/TerminalPage entry.',
);
assert.doesNotMatch(
  terminalPackageTsconfigSource,
  /type-bridges/u,
  'BirdCoder terminal package tsconfig must stop routing @sdkwork/terminal-* through local type bridges.',
);
assert.equal(
  terminalPackageManifest.dependencies?.['@sdkwork/terminal-shell'],
  buildExpectedExternalTerminalLinkVersion(terminalPackageManifestPath, '@sdkwork/terminal-shell'),
  'BirdCoder terminal package must declare @sdkwork/terminal-shell through the governed sibling sdkwork-terminal link protocol.',
);
assert.equal(
  terminalPackageManifest.dependencies?.['@sdkwork/terminal-infrastructure'],
  buildExpectedExternalTerminalLinkVersion(
    terminalPackageManifestPath,
    '@sdkwork/terminal-infrastructure',
  ),
  'BirdCoder terminal package must declare @sdkwork/terminal-infrastructure through the governed sibling sdkwork-terminal link protocol.',
);
assert.equal(
  commonsPackageManifest.dependencies?.['@sdkwork/terminal-shell'],
  buildExpectedExternalTerminalLinkVersion(commonsPackageManifestPath, '@sdkwork/terminal-shell'),
  'BirdCoder commons must declare @sdkwork/terminal-shell through the governed sibling sdkwork-terminal link protocol when shared adapters consume its launch-plan types.',
);
assert.equal(
  commonsPackageManifest.dependencies?.['@sdkwork/terminal-infrastructure'],
  buildExpectedExternalTerminalLinkVersion(
    commonsPackageManifestPath,
    '@sdkwork/terminal-infrastructure',
  ),
  'BirdCoder commons must declare @sdkwork/terminal-infrastructure through the governed sibling sdkwork-terminal link protocol when shared adapters consume its runtime request types.',
);

assert.match(
  terminalFacadePageSource,
  /DesktopTerminalSurface/u,
  'BirdCoder TerminalPage facade must delegate rendering and session orchestration to sdkwork-terminal-shell DesktopTerminalSurface.',
);
assert.match(
  terminalFacadePageSource,
  /createDesktopRuntimeBridgeClient/u,
  'BirdCoder TerminalPage facade must reuse sdkwork-terminal infrastructure for the Tauri runtime client.',
);
assert.match(
  terminalFacadePageSource,
  /resolveBirdcoderTerminalLaunchRequest/u,
  'BirdCoder TerminalPage facade must use the shared BirdCoder launch adapter instead of a page-local launch planner.',
);
for (const forbiddenLocalImplementation of [
  'createLocalProcessSession',
  'createLocalShellSession',
  'DesktopSessionReattachIntent',
  'buildTerminalRequestLaunchPlan',
  'processedRequestTimestampRef',
  'requestSequenceRef',
  'setDesktopSessionReattachIntent',
]) {
  assert.doesNotMatch(
    terminalFacadePageSource,
    new RegExp(`\\b${forbiddenLocalImplementation}\\b`, 'u'),
    `BirdCoder TerminalPage facade must not keep local terminal orchestration state or launch implementation (${forbiddenLocalImplementation}).`,
  );
}

assert.match(
  sharedLaunchAdapterSource,
  /buildTerminalExecutionPlan/u,
  'Shared BirdCoder terminal adapter must normalize shell commands from the focused terminal profile module.',
);
assert.match(
  sharedLaunchAdapterSource,
  /resolveTerminalLaunchProfileOption/u,
  'Shared BirdCoder terminal adapter must normalize CLI startup profiles from the focused terminal profile module.',
);
assert.match(
  sharedLaunchAdapterSource,
  /listTerminalCliProfileAvailability/u,
  'Shared BirdCoder terminal adapter must resolve CLI availability before launching sdkwork-terminal sessions.',
);
assert.match(
  sharedLaunchAdapterSource,
  /buildTerminalProfileBlockedMessage/u,
  'Shared BirdCoder terminal adapter must surface blocked CLI guidance from the focused governance runtime.',
);
assert.match(
  sharedLaunchAdapterSource,
  /DesktopLocalProcessSessionCreateRequest/u,
  'Shared BirdCoder terminal adapter must return sdkwork-terminal desktop local-process session requests.',
);
assert.match(
  sharedLaunchAdapterSource,
  /DesktopLocalShellSessionCreateRequest/u,
  'Shared BirdCoder terminal adapter must return sdkwork-terminal desktop local-shell session requests.',
);
assert.doesNotMatch(
  sharedLaunchAdapterSource,
  /\buse(State|Effect|Memo|Ref)\b/u,
  'Shared BirdCoder terminal adapter must stay outside React page orchestration and only normalize launch data.',
);

assert.match(
  terminalShellSource,
  /export function DesktopTerminalSurface/u,
  'sdkwork-terminal-shell index must export a reusable DesktopTerminalSurface component.',
);
assert.match(
  terminalShellSource,
  /ShellApp/u,
  'DesktopTerminalSurface must render ShellApp as the authoritative terminal UI.',
);
assert.match(
  terminalShellSource,
  /DesktopSessionReattachIntent/u,
  'DesktopTerminalSurface must own the reattach intent state handed to ShellApp.',
);
assert.match(
  terminalShellSource,
  /createLocalProcessSession/u,
  'DesktopTerminalSurface must be able to create local-process runtime sessions.',
);
assert.match(
  terminalShellSource,
  /createLocalShellSession/u,
  'DesktopTerminalSurface must be able to create local-shell runtime sessions.',
);

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
  webViteConfigSource,
  /optimizeDeps:\s*\{[\s\S]*include:\s*\[[\s\S]*['"]@xterm\/addon-unicode11['"]/u,
  'Web Vite config must prebundle @xterm/addon-unicode11 so terminal runtime does not execute its broken raw UMD entry in the browser.',
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
assert.match(
  desktopViteConfigSource,
  /optimizeDeps:\s*\{[\s\S]*include:\s*\[[\s\S]*['"]@xterm\/addon-unicode11['"]/u,
  'Desktop Vite config must prebundle @xterm/addon-unicode11 so terminal runtime does not execute its broken raw UMD entry in the browser.',
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

assert.doesNotMatch(
  terminalInfrastructureSource,
  /new xtermModule\.Terminal\(/u,
  'sdkwork-terminal infrastructure must not instantiate xterm via xtermModule.Terminal directly, because the current @xterm/xterm dynamic import shape only exposes default.Terminal in BirdCoder runtime bundles.',
);

assert.match(
  terminalInfrastructureSource,
  /resolveInteropConstructor/u,
  'sdkwork-terminal infrastructure must normalize CommonJS and ESM constructor exports through a dedicated interop resolver before instantiating xterm runtime addons.',
);

for (const requiredInteropExport of [
  'Terminal',
  'FitAddon',
  'SearchAddon',
  'Unicode11Addon',
  'CanvasAddon',
]) {
  assert.match(
    terminalInfrastructureSource,
    new RegExp(`resolveInteropConstructor[\\s\\S]*?['"]${requiredInteropExport}['"]`, 'u'),
    `sdkwork-terminal infrastructure must resolve ${requiredInteropExport} through the interop constructor resolver so browser runtime bundles stay compatible with default-exported xterm modules.`,
  );
}

console.log('terminal sdkwork shell integration contract passed.');
