import assert from 'node:assert/strict';
import fs from 'node:fs';

const codePageSurfaceSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageSurface.tsx', import.meta.url),
  'utf8',
);
const universalChatSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);
const transcriptMessageSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/ChatTranscriptMessage.tsx', import.meta.url),
  'utf8',
);

assert.match(
  codePageSurfaceSource,
  /<div className=\{isActive \? 'flex flex-1 min-h-0 w-full overflow-hidden' : 'hidden'\}>/,
  'CodePage main chat wrapper must occupy the full available width so the chat surface does not resize itself around composer content as it hydrates.',
);

assert.match(
  universalChatSource,
  /className=\{`flex flex-1 h-full w-full min-w-0 overflow-hidden flex-col .*?\$\{className\}`\}/s,
  'UniversalChat root surface must fill the available width instead of sizing to the current composer content.',
);

assert.match(
  universalChatSource,
  /layout === 'main' \? 'max-w-\[880px\]' : 'w-full'/u,
  'Main-layout composer must keep the canonical 880px centered content track.',
);

assert.match(
  transcriptMessageSource,
  /className=\{`flex w-full px-5 \$\{isUser \? 'py-2' : 'py-2\.5'\} group`\}/u,
  'Main transcript rows must use the same 20px responsive horizontal inset as the composer.',
);

assert.match(
  transcriptMessageSource,
  /className=\{`mx-auto flex w-full max-w-\[880px\]/u,
  'Main transcript content must use the same 880px centered width as the composer.',
);

assert.doesNotMatch(
  transcriptMessageSource,
  /max-w-3xl|md:px-8/u,
  'Main transcript must not retain the narrower legacy content track.',
);

console.log('code main chat width stability contract passed.');
