import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);

assert.match(
  universalChatSource,
  /layout === 'main' \? \(\s*<div className=\"flex min-h-full w-full px-6\">[\s\S]*max-w-\[40rem\][\s\S]*justify-center/s,
  'UniversalChat main-layout empty state must use the same 40rem centered frame and padding as the message transcript and composer.',
);

console.log('universal chat empty state layout contract passed.');
