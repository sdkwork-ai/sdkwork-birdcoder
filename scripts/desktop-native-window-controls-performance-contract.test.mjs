import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-shell/src/application/app/nativeWindowControlsBridge.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  source,
  /const minimizeButtonElement = options\.minimizeButtonRef\.current;/,
  'Native window controls bridge should capture the current minimize button node during render so observer setup can depend on the real element instead of re-running for unrelated renders.',
);

assert.match(
  source,
  /const bridgeOptionsRef = useRef\(options\);\s*bridgeOptionsRef\.current = options;/s,
  'Native window controls bridge should store the latest bridge options in a ref so deferred sync work always reads current values without forcing a full observer resubscription.',
);

assert.match(
  source,
  /const bridgeCapabilitiesRef = useRef\(DEFAULT_BRIDGE_CAPABILITIES\);\s*bridgeCapabilitiesRef\.current = bridgeCapabilities;/s,
  'Native window controls bridge should store the latest bridge capabilities in a ref so sync work can read current host support without stale closures.',
);

assert.match(
  source,
  /if \(!bridgeCapabilitiesRef\.current\.supportsNativeHitTest\) \{\s*lastSerializedConfigRef\.current = '';\s*return;\s*\}/s,
  'Native window controls bridge must skip bridge config work immediately when native hit testing is unavailable.',
);

assert.doesNotMatch(
  source,
  /useLayoutEffect\(\(\) => \{\s*scheduleBridgeConfigSyncRef\.current\?\.\(\);\s*\}\);/s,
  'Native window controls bridge must not schedule a layout sync after every render because that forces unnecessary RAF work and repeated DOM rect serialization during normal app state updates.',
);

assert.match(
  source,
  /useLayoutEffect\(\(\) => \{\s*scheduleBridgeConfigSyncRef\.current\?\.\(\);\s*\}, \[\s*bridgeCapabilities\.supportsNativeHitTest,\s*closeButtonElement,\s*options\.enabled,\s*options\.isFullscreen,\s*maximizeButtonElement,\s*minimizeButtonElement,\s*\]\);/s,
  'Native window controls bridge should only schedule a layout sync when capability support, fullscreen state, enabled state, or the mirrored button nodes change.',
);

console.log('desktop native window controls performance contract passed.');
