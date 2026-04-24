import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url), 'utf8');

assert.match(
  appSource,
  /function WindowControlMinimizeIcon\(\)/,
  'App header must define a dedicated minimize glyph instead of relying on a generic icon library glyph.',
);

assert.match(
  appSource,
  /function WindowControlMaximizeIcon\(\)/,
  'App header must define a dedicated maximize glyph instead of relying on a generic icon library glyph.',
);

assert.match(
  appSource,
  /function WindowControlRestoreIcon\(\)/,
  'App header must define a dedicated restore glyph instead of relying on a generic icon library glyph.',
);

assert.match(
  appSource,
  /function WindowControlMaximizeIcon\(\)[\s\S]*shapeRendering="crispEdges"[\s\S]*d="M2 2\.5H8V8H2V2\.5Z"[\s\S]*d="M2 3\.5H8"/,
  'App header maximize glyph must use a crisp native-style window frame with a distinct title bar.',
);

assert.match(
  appSource,
  /function WindowControlRestoreIcon\(\)[\s\S]*shapeRendering="crispEdges"[\s\S]*d="M3\.5 2H8V6\.5H6\.5"[\s\S]*d="M3\.5 3H8"[\s\S]*d="M2 3\.5H6\.5V8H2V3\.5Z"[\s\S]*d="M2 4\.5H6\.5"/,
  'App header restore glyph must use overlapping native-style window frames with distinct title bars.',
);

assert.match(
  appSource,
  /<WindowControlMinimizeIcon \/>/,
  'App header minimize button must render the dedicated minimize glyph.',
);

assert.match(
  appSource,
  /isDesktopWindowMaximized \? <WindowControlRestoreIcon \/> : <WindowControlMaximizeIcon \/>/,
  'App header maximize button must switch between dedicated maximize and restore glyphs.',
);

assert.doesNotMatch(
  appSource,
  /<Minus size=\{14\} \/>|<Square size=\{12\} \/>|<SquareSquare size=\{12\} \/>/,
  'App header window control buttons must not use the generic lucide icons for minimize, maximize, or restore.',
);

assert.doesNotMatch(
  appSource,
  /<rect x="1\.75" y="1\.75" width="6\.5" height="6\.5"[\s\S]*<rect x="3" y="1\.75" width="5\.25" height="5\.25"[\s\S]*<rect x="1\.75" y="3" width="5\.25" height="5\.25"/,
  'App header maximize and restore glyphs must not use the previous generic rectangle-only implementation.',
);

console.log('app header window control icons contract passed.');
