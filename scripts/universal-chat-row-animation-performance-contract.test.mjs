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
  /const renderSidebarMessage = \([\s\S]*?className=\{`[^`]*animate-in fade-in slide-in-from-bottom-4 fill-mode-both/s,
  'UniversalChat sidebar transcript rows must not attach per-message entrance animations because long transcripts and streaming updates should not restagger layout work.',
);

assert.doesNotMatch(
  universalChatSource,
  /const renderMainMessage = \([\s\S]*?className=\{`[^`]*animate-in fade-in slide-in-from-bottom-4 fill-mode-both/s,
  'UniversalChat main transcript rows must not attach per-message entrance animations because viewport virtualization should not pay extra animation/layout cost on every rendered row.',
);

assert.doesNotMatch(
  universalChatSource,
  /function resolveTranscriptAnimationDelay\(/,
  'UniversalChat should not keep transcript-row animation delay helpers once row entrance animations are removed.',
);

console.log('universal chat row animation performance contract passed.');
