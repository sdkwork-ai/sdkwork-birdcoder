import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const universalChatPath = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'UniversalChat.tsx',
);
const universalChatSource = fs.readFileSync(universalChatPath, 'utf8');
const codePageSource = fs.readFileSync(path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodePage.tsx',
), 'utf8');
const studioChatSidebarSource = fs.readFileSync(path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioChatSidebar.tsx',
), 'utf8');
const appStylesSource = fs.readFileSync(path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'src',
  'index.css',
), 'utf8');

assert.match(
  universalChatSource,
  /const currentComposerModelLabel = currentModelLabel\.trim\(\) \|\| currentEngine\.label;/u,
  'Composer must always resolve a non-empty selected model label for display.',
);
assert.match(
  universalChatSource,
  /data-testid="universal-chat-model-picker"[\s\S]*?<ModelPicker[\s\S]*?menuPlacement="auto"[\s\S]*?onSelectModel=\{handleComposerModelSelect\}[\s\S]*?selectedModelId=\{currentModelPickerId\}/u,
  'Composer model picker must expose its selected model and use adaptive viewport placement.',
);
assert.match(
  codePageSource,
  /showComposerEngineSelector:\s*true,/u,
  'Code workbench must keep the composer model picker available after a session exists.',
);
assert.match(
  studioChatSidebarSource,
  /<DeferredUniversalChat[\s\S]*?showComposerEngineSelector\s*[\s\S]*?layout="sidebar"/u,
  'Studio workbench must keep the composer model picker available after a session exists.',
);
assert.match(
  universalChatSource,
  /const RESIZABLE_COMPOSER_MIN_HEIGHT = 48;[\s\S]*?className=\{`min-h-12 w-full[\s\S]*?rows=\{2\}/u,
  'Composer textarea must default to two 24px lines and keep resizing aligned to that 48px minimum.',
);
assert.match(
  universalChatSource,
  /<div className="mt-1 flex min-w-0 items-center justify-between gap-3">/u,
  'Composer footer must use compact spacing below the two-line textarea.',
);
assert.match(
  appStylesSource,
  /\.sdkwork-model-picker-menu\s*\{[\s\S]*?overscroll-behavior:\s*contain;[\s\S]*?z-index:\s*2147483000\s*!important;/u,
  'Model picker portal must stay above application overlays and contain internal scrolling.',
);
assert.match(
  appStylesSource,
  /@media \(max-width:\s*520px\)[\s\S]*?\.sdkwork-model-picker-menu--flat\s*\{[\s\S]*?grid-template-columns:\s*minmax\(96px, 36%\) minmax\(0, 1fr\)\s*!important;/u,
  'Model picker menu must adapt its vendor and model columns on narrow viewports.',
);

console.log('universal chat composer model display contract passed.');
