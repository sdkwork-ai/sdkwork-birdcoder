import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const chromePath = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'UniversalChatComposerChrome.tsx',
);
const resizeHandlePath = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui-shell',
  'src',
  'components',
  'ResizeHandle.tsx',
);

const chromeSource = fs.readFileSync(chromePath, 'utf8');
const resizeHandleSource = fs.readFileSync(resizeHandlePath, 'utf8');
const hitAreaClassMatch = chromeSource.match(
  /className="([^"]*group\/composer-resize[^"]*)"/u,
);
const resizeHandleClassMatch = chromeSource.match(
  /<ResizeHandle\s+className="([^"]+)"/u,
);

assert.doesNotMatch(
  chromeSource,
  /group-hover\/composer:|group-focus-within\/composer:/u,
  'Composer chrome must not reveal resize feedback from hover or focus anywhere in the composer.',
);
assert.ok(hitAreaClassMatch, 'Composer must define a dedicated resize hit area group.');
assert.match(
  hitAreaClassMatch[1],
  /inset-x-4[\s\S]*h-3[\s\S]*-translate-y-1\/2/u,
  'Composer resize hit area must stay a compact strip centered on the top edge.',
);
assert.match(
  chromeSource,
  /data-testid="universal-chat-composer-resize-indicator"/u,
  'Composer resize feedback must expose a stable visual indicator boundary.',
);
assert.match(
  chromeSource,
  /group-hover\/composer-resize:opacity-100/u,
  'Composer resize feedback must be driven by the dedicated top-edge group.',
);
assert.match(
  chromeSource,
  /peer-data-\[dragging=true\]:opacity-100/u,
  'Composer resize feedback must remain visible while a drag is active.',
);
assert.ok(resizeHandleClassMatch, 'Composer must use the shared resize handle.');
assert.match(
  resizeHandleClassMatch[1],
  /peer[\s\S]*!h-full[\s\S]*!bg-transparent[\s\S]*hover:!bg-transparent/u,
  'Composer resize handle must fill only the dedicated transparent hit area.',
);
assert.match(
  resizeHandleSource,
  /data-dragging=\{isDragging \? 'true' : 'false'\}/u,
  'Shared resize handle must expose its drag state for scoped visual feedback.',
);

console.log('universal chat composer resize interaction contract passed.');
