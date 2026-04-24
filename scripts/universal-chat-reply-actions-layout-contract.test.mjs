import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const universalChatSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-ui',
    'src',
    'components',
    'UniversalChat.tsx',
  ),
  'utf8',
);

assert.doesNotMatch(
  universalChatSource,
  /\{showMessageActions \? \(\s*<div className="mt-1\.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">[\s\S]*?\)\s*:\s*null\}\s*\n\s*\{msg\.fileChanges && msg\.fileChanges\.length > 0 && \(/,
  'UniversalChat assistant reply actions must not render before file change and command sections, or they will appear inside the reply body instead of at the bottom edge.',
);

assert.match(
  universalChatSource,
  /\{msg\.commands && msg\.commands\.length > 0 && \([\s\S]*?\)\}\s*\n\s*\{showMessageActions \? \(\s*<div className="mt-1\.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">/s,
  'UniversalChat assistant reply actions must render after commands so the hover toolbar anchors to the bottom of the full reply block.',
);

assert.doesNotMatch(
  universalChatSource,
  /\{isReplySegmentRole\(msg\.role\) && showMessageActions && \(\s*<div className="mt-1\.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">[\s\S]*?\)\}\s*\n\s*\{msg\.fileChanges && msg\.fileChanges\.length > 0 && \(/,
  'UniversalChat sidebar reply actions must not render above file and command sections, or the hover toolbar will float inside the reply content.',
);

assert.match(
  universalChatSource,
  /\{msg\.commands && msg\.commands\.length > 0 && \([\s\S]*?\)\}\s*\n\s*\{isReplySegmentRole\(msg\.role\) && showMessageActions && \(\s*<div className="mt-1\.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">/s,
  'UniversalChat sidebar reply actions must render after commands so the hover toolbar sits at the bottom of the reply block.',
);

console.log('universal chat reply actions layout contract passed.');
