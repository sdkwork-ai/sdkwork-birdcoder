import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const appPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-shell',
  'src',
  'application',
  'app',
  'BirdcoderApp.tsx',
);
const bridgePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-shell',
  'src',
  'application',
  'app',
  'nativeWindowControlsBridge.ts',
);
const desktopLibRsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'src',
  'lib.rs',
);
const desktopBridgePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'src',
  'window_controls_bridge.rs',
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

const appSource = fs.readFileSync(appPath, 'utf8');
const bridgeSource = fs.readFileSync(bridgePath, 'utf8');
const desktopLibRsSource = fs.readFileSync(desktopLibRsPath, 'utf8');
const desktopBridgeSource = fs.readFileSync(desktopBridgePath, 'utf8');
const desktopCargoTomlSource = fs.readFileSync(desktopCargoTomlPath, 'utf8');
const desktopPermissionsSource = fs.readFileSync(desktopPermissionsPath, 'utf8');

assert.match(
  appSource,
  /import\s*\{\s*performNativeWindowControlAction,\s*useNativeWindowControlsBridge\s*\}\s*from '\.\/nativeWindowControlsBridge\.ts';/,
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
  /mod window_controls_bridge;/,
  'The desktop host must compile a dedicated window-controls bridge module.',
);

assert.match(
  desktopLibRsSource,
  /window_controls_bridge::desktop_configure_window_controls_bridge/,
  'The desktop host must register the native window-controls bridge configuration command.',
);

assert.match(
  desktopLibRsSource,
  /window_controls_bridge::desktop_window_controls_bridge_capabilities/,
  'The desktop host must register the native window-controls bridge capabilities command.',
);

assert.match(
  desktopLibRsSource,
  /window_controls_bridge::desktop_perform_window_control_action/,
  'The desktop host must register the native window-controls action command.',
);

assert.match(
  desktopBridgeSource,
  /WM_NCHITTEST/,
  'The desktop bridge must intercept WM_NCHITTEST on Windows so maximize\/restore behaves like a native caption button.',
);

assert.match(
  desktopBridgeSource,
  /HTMINBUTTON/,
  'The desktop bridge must return HTMINBUTTON for the mirrored minimize region.',
);

assert.match(
  desktopBridgeSource,
  /HTMAXBUTTON/,
  'The desktop bridge must return HTMAXBUTTON for the mirrored maximize region.',
);

assert.match(
  desktopBridgeSource,
  /HTCLOSE/,
  'The desktop bridge must return HTCLOSE for the mirrored close region.',
);

assert.match(
  desktopBridgeSource,
  /SetWindowSubclass/,
  'The desktop bridge must install a Win32 subclass so the host can participate in native non-client hit-testing.',
);

assert.match(
  desktopBridgeSource,
  /cfg\(target_os = "windows"\)/,
  'Windows-specific native hit-testing must stay isolated behind target gates so the bridge remains explicit and portable across desktop platforms.',
);

assert.match(
  desktopCargoTomlSource,
  /\[target\.'cfg\(windows\)'\.dependencies\][\s\S]*windows-sys/s,
  'Desktop Rust host must scope windows-sys to Windows-only target dependencies so native caption logic does not leak into non-Windows builds.',
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
