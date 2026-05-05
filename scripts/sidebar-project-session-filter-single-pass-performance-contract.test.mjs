import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);

assert.match(
  sidebarSource,
  /function filterSidebarProjectSessions\(\s*codingSessions: readonly BirdCoderCodingSession\[\],\s*showArchived: boolean,\s*normalizedSearchQuery: string,\s*\): BirdCoderCodingSession\[\] \{/s,
  'Code sidebar must centralize project-session filtering in a single-pass helper.',
);

const helperStart = sidebarSource.indexOf('function filterSidebarProjectSessions(');
assert.notEqual(
  helperStart,
  -1,
  'Code sidebar must define filterSidebarProjectSessions.',
);
const helperEnd = sidebarSource.indexOf('\nfunction ', helperStart + 1);
const helperSource = sidebarSource.slice(
  helperStart,
  helperEnd === -1 ? sidebarSource.length : helperEnd,
);

assert.match(
  helperSource,
  /if \(showArchived && !normalizedSearchQuery\) \{[\s\S]*return codingSessions(?: as BirdCoderCodingSession\[\])?;[\s\S]*\}/s,
  'Project-session filtering must reuse the original already-sorted array when no project-session filters are active.',
);
assert.match(
  helperSource,
  /for \(const codingSession of codingSessions\)/,
  'Project-session filtering must use one imperative pass for large project session lists.',
);
assert.doesNotMatch(
  helperSource,
  /\.filter\(|\.map\(|\.flatMap\(/,
  'Project-session filtering helper must not allocate intermediate filter/map arrays.',
);

const filteredProjectSessionsStart = sidebarSource.indexOf(
  'const filteredProjectSessions = useMemo<SidebarFilteredProjectSessionsEntry[]>(',
);
assert.notEqual(
  filteredProjectSessionsStart,
  -1,
  'Code sidebar must keep filteredProjectSessions memoized.',
);
const filteredProjectSessionsEnd = sidebarSource.indexOf(
  'const chronologicalSessions = useMemo',
  filteredProjectSessionsStart,
);
const filteredProjectSessionsSource = sidebarSource.slice(
  filteredProjectSessionsStart,
  filteredProjectSessionsEnd === -1 ? sidebarSource.length : filteredProjectSessionsEnd,
);

assert.doesNotMatch(
  filteredProjectSessionsSource,
  /project\.codingSessions\s*\.filter\(/,
  'Project-organized sidebar render must not chain filters over every project session list.',
);
assert.match(
  filteredProjectSessionsSource,
  /filterSidebarProjectSessions\(\s*project\.codingSessions,\s*showArchived,\s*normalizedSearchQuery,\s*\)/s,
  'Project-organized sidebar render must use the single-pass project-session filter helper.',
);

console.log('sidebar project-session single-pass filter performance contract passed.');
