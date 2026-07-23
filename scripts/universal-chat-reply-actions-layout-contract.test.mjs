import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
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
const assistantReplyRendererSource = replyMessageRenderersSource.match(
  /export const AssistantReplyMessageRenderer[\s\S]*$/u,
)?.[0];
assert.ok(
  assistantReplyRendererSource,
  'UniversalChat must keep assistant reply rendering in the dedicated reply renderer.',
);

assert.doesNotMatch(
  assistantReplyRendererSource,
  /<ChatMessageActionBar[\s\S]*?<ContentBlockList view=\{view\} context=\{context\} \/>/,
  'UniversalChat assistant reply actions must not render before the structured Session Item blocks.',
);

assert.match(
  assistantReplyRendererSource,
  /<ContentBlockList view=\{view\} context=\{context\} \/>\s*\{context\.showMessageActions && !suppressReplyChrome \? \(\s*<ChatMessageActionBar/,
  'UniversalChat assistant reply actions must render after all structured Session Item blocks so the toolbar anchors to the full reply edge.',
);

assert.match(
  assistantReplyRendererSource,
  /iconSize=\{isSidebar \? 12 : 14\}/,
  'UniversalChat must reuse the same post-content action boundary for sidebar and main layouts with layout-appropriate controls.',
);

console.log('universal chat reply actions layout contract passed.');
