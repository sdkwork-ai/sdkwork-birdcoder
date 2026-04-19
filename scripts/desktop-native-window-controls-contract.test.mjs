import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = new URL('../src/App.tsx', import.meta.url);
const tauriConfigPath = new URL(
  '../packages/sdkwork-birdcoder-desktop/src-tauri/tauri.conf.json',
  import.meta.url,
);
const tauriTestConfigPath = new URL(
  '../packages/sdkwork-birdcoder-desktop/src-tauri/tauri.test.conf.json',
  import.meta.url,
);

const appSource = fs.readFileSync(appPath, 'utf8');
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
const tauriTestConfig = JSON.parse(fs.readFileSync(tauriTestConfigPath, 'utf8'));

assert.equal(
  tauriConfig.app?.windows?.[0]?.decorations,
  true,
  'Desktop host must enable native window decorations so maximize/restore uses the operating system title-bar controls instead of a slow front-end IPC round-trip.',
);

assert.equal(
  tauriTestConfig.app?.windows?.[0]?.decorations,
  true,
  'Desktop test host must mirror native window decorations so development and test builds exercise the same maximize/restore path.',
);

assert.match(
  appSource,
  /const \[usesNativeWindowControls, setUsesNativeWindowControls\] = useState\(false\);/,
  'App must track whether the desktop host exposes native window controls so the title bar can switch off redundant custom controls.',
);

assert.match(
  appSource,
  /desktopWindow\.isDecorated\(\)/,
  'Desktop window setup must inspect the native decoration mode from Tauri before deciding whether custom window controls should render.',
);

assert.match(
  appSource,
  /const titleBarDragEnabled =[\s\S]*isDesktopWindowAvailable[\s\S]*!usesNativeWindowControls[\s\S]*!isDocumentFullscreen;/,
  'Custom app-header dragging must be disabled when the operating system already owns the title bar drag surface.',
);

assert.match(
  appSource,
  /\{isDesktopWindowAvailable && !usesNativeWindowControls \? \(/,
  'Custom minimize/maximize/close buttons must not render when native window controls are active.',
);

console.log('desktop native window controls contract passed.');
