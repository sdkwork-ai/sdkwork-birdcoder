import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const studioPagePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);

const studioPageSource = fs.readFileSync(studioPagePath, 'utf8');
const studioPageSize = Buffer.byteLength(studioPageSource, 'utf8');

assert.match(
  studioPageSource,
  /from '\.\/StudioChatSidebar';/,
  'StudioPage must move the assistant sidebar and project switcher into StudioChatSidebar.',
);

assert.match(
  studioPageSource,
  /from '\.\/StudioWorkspaceOverlays';/,
  'StudioPage must move find-in-files and quick-open overlays into StudioWorkspaceOverlays.',
);

assert.match(
  studioPageSource,
  /from '\.\/StudioTerminalIntegrationPanel';/,
  'StudioPage must render terminal integration through StudioTerminalIntegrationPanel instead of inlining the external terminal boundary.',
);

assert.ok(
  studioPageSize < 50000,
  `StudioPage should stay below 50000 bytes after componentization, received ${studioPageSize}.`,
);

assert.doesNotMatch(
  studioPageSource,
  /<UniversalChat[\s\S]*layout="sidebar"/,
  'StudioPage should not inline the sidebar chat surface after the sidebar component split.',
);

assert.doesNotMatch(
  studioPageSource,
  /top-16 right-1\/2 translate-x-1\/2 w-\[32rem\]/,
  'StudioPage should not inline the find-in-files overlay after the workspace overlay split.',
);

console.log('studio page componentization contract passed.');
