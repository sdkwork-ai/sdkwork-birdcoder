import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const bridgePath = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-shell',
  'src',
  'application',
  'app',
  'nativeWindowControlsBridge.ts',
);
const desktopLibRsPath = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-desktop',
  'src-tauri',
  'src',
  'lib.rs',
);
const desktopBridgePath = path.join(
  rootDir,
  'crates',
  'sdkwork-birdcoder-tauri-host',
  'src',
  'commands',
  'window_commands.rs',
);
const desktopCargoTomlPath = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-desktop',
  'src-tauri',
  'Cargo.toml',
);
const desktopPermissionsPath = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-desktop',
  'src-tauri',
  'permissions',
  'default.toml',
);

const appSource = readBirdcoderAppShellSource();
const bridgeSource = fs.readFileSync(bridgePath, 'utf8');
const desktopLibRsSource = fs.readFileSync(desktopLibRsPath, 'utf8');
const desktopBridgeSource = fs.readFileSync(desktopBridgePath, 'utf8');
const desktopCargoTomlSource = fs.readFileSync(desktopCargoTomlPath, 'utf8');
const desktopPermissionsSource = fs.readFileSync(desktopPermissionsPath, 'utf8');

assert.match(
  appSource,
  /performNativeWindowControlAction[\s\S]*useNativeWindowControlsBridge[\s\S]*from '\.\/nativeWindowControlsBridge\.ts'/,
  'BirdcoderApp must consume the dedicated native window-controls bridge module instead of hard-wiring the window control buttons directly to browser-side Tauri APIs.',
);

assert.match(
  appSource,
  /const minimizeWindowControlButtonRef = useRef<HTMLButtonElement \| null>\(null\);/,
  'BirdcoderApp must keep a ref for the minimize button so the native bridge can mirror the real button bounds.',
);

assert.match(
  appSource,
  /const maximizeWindowControlButtonRef = useRef<HTMLButtonElement \| null>\(null\);/,
  'BirdcoderApp must keep a ref for the maximize\/restore button so the native bridge can mirror the real button bounds.',
);

assert.match(
  appSource,
  /const closeWindowControlButtonRef = useRef<HTMLButtonElement \| null>\(null\);/,
  'BirdcoderApp must keep a ref for the close button so the native bridge can mirror the real button bounds.',
);

assert.match(
  appSource,
  /useNativeWindowControlsBridge\(\{\s*enabled:\s*isDesktopWindowAvailable,\s*isFullscreen:\s*isDocumentFullscreen,\s*minimizeButtonRef:\s*minimizeWindowControlButtonRef,\s*maximizeButtonRef:\s*maximizeWindowControlButtonRef,\s*closeButtonRef:\s*closeWindowControlButtonRef,/s,
  'BirdcoderApp must configure the native bridge from the real rendered window-control buttons.',
);

assert.match(
  appSource,
  /minimizeButtonRef=\{minimizeWindowControlButtonRef\}/,
  'BirdcoderApp must pass the minimize button ref into BirdcoderAppHeader so the native bridge can measure the real minimize button bounds.',
);

assert.match(
  appSource,
  /maximizeButtonRef=\{maximizeWindowControlButtonRef\}/,
  'BirdcoderApp must pass the maximize\/restore button ref into BirdcoderAppHeader so the native bridge can measure the real maximize button bounds.',
);

assert.match(
  appSource,
  /closeButtonRef=\{closeWindowControlButtonRef\}/,
  'BirdcoderApp must pass the close button ref into BirdcoderAppHeader so the native bridge can measure the real close button bounds.',
);

assert.match(
  appSource,
  /ref=\{minimizeButtonRef\}/,
  'BirdcoderAppHeader must bind the forwarded minimize button ref to the rendered minimize button DOM node.',
);

assert.match(
  appSource,
  /ref=\{maximizeButtonRef\}/,
  'BirdcoderAppHeader must bind the forwarded maximize\/restore button ref to the rendered maximize button DOM node.',
);

assert.match(
  appSource,
  /ref=\{closeButtonRef\}/,
  'BirdcoderAppHeader must bind the forwarded close button ref to the rendered close button DOM node.',
);

assert.match(
  appSource,
  /performNativeWindowControlAction\('minimize'\)/,
  'BirdcoderApp window control clicks must go through the native bridge action path for minimize.',
);

assert.match(
  appSource,
  /performNativeWindowControlAction\('toggleMaximize'\)/,
  'BirdcoderApp window control clicks must go through the native bridge action path for maximize\/restore.',
);

assert.match(
  appSource,
  /performNativeWindowControlAction\('close'\)/,
  'BirdcoderApp window control clicks must go through the native bridge action path for close.',
);

assert.match(
  bridgeSource,
  /desktop_configure_window_controls_bridge/,
  'The bridge module must invoke the desktop bridge command that syncs window-control bounds into the native host.',
);

assert.match(
  bridgeSource,
  /desktop_window_controls_bridge_capabilities/,
  'The bridge module must query native bridge capabilities so platform-specific behavior can stay explicit.',
);

assert.match(
  bridgeSource,
  /desktop_perform_window_control_action/,
  'The bridge module must route window-control actions through the desktop host.',
);

assert.match(
  bridgeSource,
  /usesHostControlActions/,
  'The bridge module must honor native bridge capabilities before invoking host-side window control actions.',
);

assert.match(
  desktopLibRsSource,
  /host::desktop_configure_window_controls_bridge/,
  'The desktop host must register the native window-controls bridge configuration command.',
);

assert.match(
  desktopLibRsSource,
  /host::desktop_window_controls_bridge_capabilities/,
  'The desktop host must register the native window-controls bridge capabilities command.',
);

assert.match(
  desktopLibRsSource,
  /host::desktop_perform_window_control_action/,
  'The desktop host must register the native window-controls action command.',
);

assert.match(
  desktopBridgeSource,
  /uses_host_control_actions/,
  'The shared tauri host bridge must expose host-side window control action capability.',
);

assert.match(
  desktopBridgeSource,
  /desktop_perform_window_control_action/,
  'The shared tauri host bridge must route window-control actions through the desktop host.',
);

assert.match(
  desktopBridgeSource,
  /NativeWindowControlAction::Minimize/,
  'The shared tauri host bridge must support minimize actions.',
);

assert.match(
  desktopBridgeSource,
  /NativeWindowControlAction::ToggleMaximize/,
  'The shared tauri host bridge must support maximize and restore actions.',
);

assert.match(
  desktopBridgeSource,
  /NativeWindowControlAction::Close/,
  'The shared tauri host bridge must support close actions.',
);

assert.match(
  desktopPermissionsSource,
  /allow-desktop-window-controls-bridge/,
  'Desktop permissions must define a permission set for the native window-controls bridge commands.',
);

assert.match(
  desktopPermissionsSource,
  /allow-desktop-configure-window-controls-bridge/,
  'Desktop permissions must allow the configure bridge command.',
);

assert.match(
  desktopPermissionsSource,
  /allow-desktop-window-controls-bridge-capabilities/,
  'Desktop permissions must allow querying bridge capabilities.',
);

assert.match(
  desktopPermissionsSource,
  /allow-desktop-perform-window-control-action/,
  'Desktop permissions must allow invoking native window-control actions.',
);

console.log('desktop native window controls contract passed.');
