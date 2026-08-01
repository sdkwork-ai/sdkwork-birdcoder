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
const transcriptSurfaceSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/ChatTranscriptSurface.tsx', import.meta.url),
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
  /mx-auto w-full \$\{layout === 'main' \? 'max-w-\[40rem\]' : ''\}/u,
  'Main-layout composer must keep the Codex-aligned 40rem centered content track.',
);

assert.match(
  transcriptSurfaceSource,
  /className=\{`group flex w-full min-w-0 px-6 \$\{[\s\S]*?turn\.isStart \? 'pt-6' : 'pt-3'[\s\S]*?\}`\}/u,
  'Main transcript rows must use the same 24px responsive horizontal inset as the composer.',
);

assert.match(
  transcriptSurfaceSource,
  /className=\{`[^`]*mx-auto[^`]*max-w-\[40rem\][^`]*`\}/u,
  'Main transcript content must use the same 40rem centered width as the composer.',
);

assert.doesNotMatch(
  transcriptSurfaceSource,
  /max-w-3xl|md:px-8/u,
  'Main transcript must not retain the narrower legacy content track.',
);

console.log('code main chat width stability contract passed.');
