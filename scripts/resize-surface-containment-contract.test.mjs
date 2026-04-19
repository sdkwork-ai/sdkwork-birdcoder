import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);
const sidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);
const studioSidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx', import.meta.url),
  'utf8',
);

assert.match(
  universalChatSource,
  /contain:\s*'layout paint style'/,
  'UniversalChat transcript rows must keep CSS containment so large conversations do not trigger unnecessary cross-surface relayout during resize.',
);

assert.match(
  universalChatSource,
  /containIntrinsicSize/,
  'UniversalChat transcript rows must provide contain-intrinsic-size so skipped content still reserves stable scroll geometry.',
);

assert.doesNotMatch(
  universalChatSource,
  /contentVisibility:\s*'auto'/,
  'UniversalChat transcript rows must not use content-visibility:auto because it can leave newly exposed resize regions temporarily blank.',
);

assert.match(
  sidebarSource,
  /contain:\s*'layout paint style'/,
  'Code sidebar rows must keep CSS containment so large project/session inventories do not force unnecessary cross-surface relayout.',
);

assert.doesNotMatch(
  sidebarSource,
  /contentVisibility:\s*'auto'/,
  'Code sidebar rows must not use content-visibility:auto because the sidebar must repaint immediately during maximize and restore.',
);

assert.match(
  studioSidebarSource,
  /contain:\s*'layout paint style'/,
  'Studio sidebar rows must keep CSS containment so project/session menus remain responsive during host resize.',
);

assert.doesNotMatch(
  studioSidebarSource,
  /contentVisibility:\s*'auto'/,
  'Studio sidebar rows must not use content-visibility:auto because resize-critical surfaces must repaint without blank gaps.',
);

console.log('resize surface containment contract passed.');
