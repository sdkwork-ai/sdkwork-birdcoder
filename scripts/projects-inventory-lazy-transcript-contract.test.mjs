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
    
    
    
    'sdkwork-birdcoder-pc-workbench',
    'src',
    'hooks',
    'useProjects.ts',
  ),
  'utf8',
);

assert.match(
  source,
  /const EMPTY_PROJECT_INVENTORY_ITEMS: AgentSessionItemView\[] = \[];/,
  'useProjects must define a stable empty Agent Session Item reference for project inventory summaries.',
);

assert.match(
  source,
  /function normalizeProjectsForInventoryStore\(/,
  'useProjects must normalize fetched projects into inventory-safe summary payloads before storing them.',
);

assert.match(
  source,
  /function readProjectInventoryPage\([\s\S]*return projectService\.getProjectsPage\(request\);/,
  'useProjects startup inventory must use the bounded project page service.',
);

assert.match(
  source,
  /items:\s*agentSession\.items\.length > 0 \? EMPTY_PROJECT_INVENTORY_ITEMS : agentSession\.items/s,
  'useProjects inventory normalization must strip Session Item payloads from fetched project snapshots while preserving empty-array identity for summaries.',
);

assert.doesNotMatch(
  source,
  /EMPTY_PROJECT_INVENTORY_MESSAGES|readProjectInventoryPageForWorkspace/,
  'Project inventory must not reintroduce retired Workspace or IM-style message terminology.',
);

assert.match(
  source,
  /projects:\s*mergeProjectsForStore\(/,
  'useProjects must continue merging project inventory through mergeProjectsForStore so unchanged project identities remain stable.',
);

assert.match(
  source,
  /normalizeProjectsForInventoryStore\(page\.items\.filter\(Boolean\)\)/,
  'useProjects must normalize authoritative project inventory payloads before merging them into the shared store.',
);

console.log('projects inventory lazy transcript contract passed.');
