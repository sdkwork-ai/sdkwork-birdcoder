import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = new URL('../src/App.tsx', import.meta.url);
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

assert.doesNotMatch(
  appSource,
  /desktopWindow\.onResized\(\(\) => \{[\s\S]*scheduleDesktopWindowFrameSync\(desktopWindow\);[\s\S]*\}\)/,
  'Desktop window resize events must not perform per-frame isMaximized IPC synchronization, because maximize and restore emit resize bursts that stall the window plugin channel.',
);

assert.doesNotMatch(
  appSource,
  /applyDesktopWindowFrameState\(\{[\s\S]*\}\);\s*scheduleViewportResizeFlush\(\);\s*void desktopWindow[\s\S]*toggleMaximize\(\)/,
  'Maximize handling must not dispatch a synthetic resize before the native window state changes, because that front-loads extra layout work onto the same interaction.',
);

console.log('desktop window ipc throttle contract passed.');
