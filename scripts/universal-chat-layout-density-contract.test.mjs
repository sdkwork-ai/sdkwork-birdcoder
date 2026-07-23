import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const universalChatSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'UniversalChat.tsx',
  ),
  'utf8',
);
const transcriptMessageSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'chat',
    'messages',
    'ChatTranscriptMessage.tsx',
  ),
  'utf8',
);
const replyMessageRenderersSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'chat',
    'messages',
    'renderers',
    'ReplyMessageRenderers.tsx',
  ),
  'utf8',
);

assert.match(
  transcriptMessageSource,
  /className=\{`mx-auto flex w-full min-w-0 max-w-\[880px\] \$\{isUser \? 'justify-end' : 'justify-start'\}`\}/,
  'UniversalChat transcript rows must use one centered reading lane, right-align user items, and left-align assistant items within that lane.',
);

assert.match(
  replyMessageRenderersSource,
  /className=\{`flex w-full min-w-0 max-w-full flex-col \$\{isSidebar \? 'items-start group' : ''\}`\}/,
  'UniversalChat assistant transcript content must fill the constrained reading lane without introducing a second nested width constraint.',
);

assert.match(
  universalChatSource,
  /layout === 'sidebar' \? 'gap-4 p-4 pb-4 pl-11' : 'pb-6'/,
  'UniversalChat transcript body must keep compact flow spacing and reserve the sidebar anchor-rail gutter.',
);

assert.match(
  universalChatSource,
  /layout === 'sidebar' \? 'px-4 pb-4 pt-3' : 'px-5 pb-5 pt-4'/,
  'UniversalChat composer must use compact flow spacing so the input stays visually connected to the latest Session Items.',
);

assert.doesNotMatch(
  universalChatSource,
  /layout === 'sidebar' \? 'gap-6 p-4 pb-32' : 'pb-40'/,
  'UniversalChat must not regress to the previous overly loose transcript spacing.',
);

console.log('universal chat layout density contract passed.');
