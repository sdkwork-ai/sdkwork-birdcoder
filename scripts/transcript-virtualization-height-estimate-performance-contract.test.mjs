import assert from 'node:assert/strict';
import fs from 'node:fs';

const virtualizationSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/transcriptVirtualization.ts', import.meta.url),
  'utf8',
);

assert.match(
  virtualizationSource,
  /function countTranscriptContentLines\(/,
  'Transcript virtualization must count content lines with a dedicated helper instead of allocating a line array.',
);

assert.doesNotMatch(
  virtualizationSource,
  /\.split\(\s*\/\\r\?\\n\/u\s*\)/,
  'Transcript virtualization height estimation must not split large message content into a full line array.',
);

assert.match(
  virtualizationSource,
  /const lineCount = countTranscriptContentLines\(message\.content\);/,
  'Transcript virtualization height estimation must use the allocation-free line counter.',
);

console.log('transcript virtualization height estimate performance contract passed.');
