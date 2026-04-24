import assert from 'node:assert/strict';
import fs from 'node:fs';

const codePageSurfaceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePageSurface.tsx', import.meta.url),
  'utf8',
);
const universalChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx', import.meta.url),
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

console.log('code main chat width stability contract passed.');
