import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const source = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'hooks',
    'useProjects.ts',
  ),
  'utf8',
);

assert.match(
  source,
  /const EMPTY_PROJECT_INVENTORY_MESSAGES: BirdCoderChatMessage\[] = \[];/,
  'useProjects must define a stable empty transcript reference for project inventory summaries.',
);

assert.match(
  source,
  /function normalizeProjectsForInventoryStore\(/,
  'useProjects must normalize fetched projects into inventory-safe summary payloads before storing them.',
);

assert.match(
  source,
  /messages:\s*codingSession\.messages\.length > 0 \? EMPTY_PROJECT_INVENTORY_MESSAGES : codingSession\.messages/s,
  'useProjects inventory normalization must strip transcript payloads from fetched project snapshots while preserving empty-array identity for summaries.',
);

assert.match(
  source,
  /projects:\s*mergeProjectsForStore\(/,
  'useProjects must continue merging project inventory through mergeProjectsForStore so unchanged project identities remain stable.',
);

assert.match(
  source,
  /normalizeProjectsForInventoryStore\(projects\.filter\(Boolean\)\)/,
  'useProjects must normalize authoritative project inventory payloads before merging them into the shared store.',
);

console.log('projects inventory lazy transcript contract passed.');
