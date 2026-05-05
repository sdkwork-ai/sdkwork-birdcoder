import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url);
const appSource = fs.readFileSync(appPath, 'utf8');

assert.match(
  appSource,
  /const scheduleDesktopWindowFrameStateReconciliation = \(/,
  'Desktop window frame state synchronization must be debounced behind a dedicated reconciliation scheduler so resize bursts do not flood the window IPC channel.',
);

assert.match(
  appSource,
  /clearTimeout\(desktopWindowFrameStateReconciliationTimeoutRef\.current\);/,
  'Desktop window frame state reconciliation must cancel stale scheduled sync work before issuing a new isMaximized IPC call.',
);

assert.match(
  appSource,
  /const DESKTOP_WINDOW_FRAME_STATE_CACHE_TTL_MS = \d+;/,
  'Desktop window frame state synchronization must keep a short verified-state cache so accidental repeated calls do not keep polling isMaximized over IPC.',
);

assert.match(
  appSource,
  /const desktopWindowFrameStateSyncPromiseRef =\s*useRef<Promise<void> \| null>\(null\);/,
  'Desktop window frame state synchronization must coalesce in-flight IPC reads behind a promise ref.',
);

assert.match(
  appSource,
  /if \(!force && desktopWindowFrameStateSyncPromiseRef\.current\) \{[\s\S]*return desktopWindowFrameStateSyncPromiseRef\.current;[\s\S]*\}/,
  'Desktop window frame state synchronization must reuse an in-flight IPC read when callers accidentally request the state repeatedly.',
);

assert.match(
  appSource,
  /DESKTOP_WINDOW_FRAME_STATE_CACHE_TTL_MS[\s\S]*return Promise\.resolve\(\);/,
  'Desktop window frame state synchronization must return cached verified state for fresh non-forced reads instead of polling isMaximized again.',
);

assert.match(
  appSource,
  /syncDesktopWindowFrameState\(desktopWindow, \{ force: true \}\)/,
  'Explicit window-control actions must force a post-action native-state reconciliation so cached state never hides maximize or restore completion.',
);

assert.doesNotMatch(
  appSource,
  /desktopWindow\.onResized\(\(\) => \{[\s\S]*scheduleDesktopWindowFrameSync\(desktopWindow\);[\s\S]*\}\)/,
  'Desktop window resize events must not perform per-frame isMaximized IPC synchronization, because maximize and restore emit resize bursts that stall the window plugin channel.',
);

assert.doesNotMatch(
  appSource,
  /desktopWindow\.onFocusChanged\(/,
  'Desktop window focus changes must not poll isMaximized over IPC; resize, scale, and explicit window-control actions are the authoritative maximize-state triggers.',
);

assert.doesNotMatch(
  appSource,
  /applyDesktopWindowFrameState\(\{[\s\S]*\}\);\s*scheduleViewportResizeFlush\(\);\s*void desktopWindow[\s\S]*toggleMaximize\(\)/,
  'Maximize handling must not dispatch a synthetic resize before the native window state changes, because that front-loads extra layout work onto the same interaction.',
);

console.log('desktop window ipc throttle contract passed.');
