import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);

assert.match(
  sidebarSource,
  /const filteredProjectSessions = useMemo<SidebarFilteredProjectSessionsEntry\[\]>\(/,
  'Code sidebar must precompute filtered and sorted project session inventories in a dedicated memo so expansion changes do not force a full re-sort.',
);

assert.match(
  sidebarSource,
  /const projectEntries = useMemo<SidebarProjectEntry\[\]>\(/,
  'Code sidebar must derive visible project entries from the precomputed filtered project session inventories.',
);

assert.doesNotMatch(
  sidebarSource,
  /const projectEntries = useMemo<SidebarProjectEntry\[\]>\([\s\S]*buildSortedCodingSessions\(/s,
  'Code sidebar project entry derivation must not call buildSortedCodingSessions directly because visible-count updates would re-sort every project session list.',
);

console.log('sidebar session expansion performance contract passed.');
