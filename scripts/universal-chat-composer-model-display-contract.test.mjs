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

assert.match(
  universalChatSource,
  /const currentComposerModelLabel = currentModelLabel\.trim\(\) \|\| currentEngine\.label;/u,
  'Composer must always resolve a non-empty selected model label for display.',
);
assert.match(
  universalChatSource,
  /\{showComposerEngineSelector \? \([\s\S]*?<ModelPicker[\s\S]*?\) : \(\s*<div[\s\S]*?data-testid="universal-chat-selected-model"[\s\S]*?title=\{currentEngineSummary\}[\s\S]*?\{currentComposerModelLabel\}[\s\S]*?<\/div>\s*\)\}/u,
  'Composer must show the editable picker for new sessions and a read-only selected-model label for locked sessions.',
);
assert.match(
  universalChatSource,
  /className="flex min-w-12 max-w-\[min\(46vw,240px\)\][^"]*"[\s\S]*?<span className="min-w-0 truncate text-xs font-semibold text-zinc-200">\s*\{currentComposerModelLabel\}/u,
  'Read-only selected-model text must remain visible and truncate inside narrow composer layouts.',
);

console.log('universal chat composer model display contract passed.');
