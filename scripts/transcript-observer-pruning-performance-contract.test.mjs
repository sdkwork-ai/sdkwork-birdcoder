import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const source = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    
    'sdkwork-birdcoder-pc',
    
    'packages',
    
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'useVirtualizedTranscriptWindow.ts',
  ),
  'utf8',
);

assert.match(
  source,
  /for \(const \[messageId,\s*element\] of measurementScope\.observedElements\.entries\(\)\) \{[\s\S]*measurementScope\.resizeObserver\?\.unobserve\(element\);[\s\S]*measurementScope\.observedElements\.delete\(messageId\);[\s\S]*measurementScope\.messageIdByElement\.delete\(element\);[\s\S]*\}/s,
  'useVirtualizedTranscriptWindow must stop observing removed transcript rows and clear element mappings when messages leave the windowed transcript set.',
);

console.log('transcript observer pruning performance contract passed.');
