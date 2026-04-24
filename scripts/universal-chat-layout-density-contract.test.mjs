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

assert.match(
  universalChatSource,
  /className=\{`w-full max-w-3xl mx-auto flex \$\{msg\.role === 'user' \? 'justify-end' : 'justify-center'\}`\}/,
  'UniversalChat main transcript must keep assistant messages centered inside the reading lane instead of left-anchoring them.',
);

assert.match(
  universalChatSource,
  /<div className="flex min-w-0 w-full max-w-2xl flex-col">/,
  'UniversalChat assistant transcript content must render inside a centered constrained reading column.',
);

assert.match(
  universalChatSource,
  /layout === 'sidebar' \? 'gap-4 p-4 pb-28' : 'pb-32'/,
  'UniversalChat transcript body must use tighter vertical spacing so session history does not feel overly sparse.',
);

assert.match(
  universalChatSource,
  /layout === 'sidebar' \? 'p-4 pt-6' : 'p-5 pt-8'/,
  'UniversalChat composer overlay must reduce excess top padding so the input stays visually connected to the latest messages.',
);

assert.doesNotMatch(
  universalChatSource,
  /layout === 'sidebar' \? 'gap-6 p-4 pb-32' : 'pb-40'/,
  'UniversalChat must not regress to the previous overly loose transcript spacing.',
);

console.log('universal chat layout density contract passed.');
