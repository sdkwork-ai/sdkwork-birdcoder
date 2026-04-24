import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);

assert.match(
  universalChatSource,
  /layout === 'main' \? \(\s*<div className=\"flex min-h-full w-full px-4 md:px-8\">[\s\S]*max-w-3xl mx-auto[\s\S]*justify-center/s,
  'UniversalChat main-layout empty state must use the same centered max-width frame as the message transcript so the chat surface width stays stable before and after the first message.',
);

console.log('universal chat empty state layout contract passed.');
