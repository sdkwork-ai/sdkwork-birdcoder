import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const source = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-ui',
    'src',
    'components',
    'useVirtualizedTranscriptWindow.ts',
  ),
  'utf8',
);

assert.match(
  source,
  /for \(const \[messageId,\s*element\] of observedElementsRef\.current\.entries\(\)\) \{[\s\S]*resizeObserverRef\.current\?\.unobserve\(element\);[\s\S]*observedElementsRef\.current\.delete\(messageId\);[\s\S]*messageIdByElementRef\.current\.delete\(element\);[\s\S]*\}/s,
  'useVirtualizedTranscriptWindow must stop observing removed transcript rows and clear element mappings when messages leave the windowed transcript set.',
);

console.log('transcript observer pruning performance contract passed.');
