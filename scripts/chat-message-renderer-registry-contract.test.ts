import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);
const messagesIndexSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/index.ts', import.meta.url),
  'utf8',
);
const registrySource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/registry.ts', import.meta.url),
  'utf8',
);

assert.match(
  messagesIndexSource,
  /createChatMessageRendererRegistry/,
  'Chat message module must expose renderer registry factory.',
);

assert.match(
  registrySource,
  /if \(match\.engineId\) \{\s*score \+= 1000;/,
  'Renderer registry must prioritize engine-specific renderers over generic view-kind renderers.',
);

assert.match(
  universalChatSource,
  /<ChatTranscriptMessage[\s\S]*engineId=\{engineId\}/,
  'UniversalChat transcript must render messages through ChatTranscriptMessage with engine context.',
);

assert.doesNotMatch(
  universalChatSource,
  /const renderSidebarMessage =/,
  'UniversalChat must not keep inline sidebar message renderers after registry migration.',
);

assert.doesNotMatch(
  universalChatSource,
  /const renderMainMessage =/,
  'UniversalChat must not keep inline main message renderers after registry migration.',
);

console.log('chat message renderer registry contract passed.');
