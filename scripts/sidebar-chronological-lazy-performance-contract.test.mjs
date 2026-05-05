import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);

assert.match(
  sidebarSource,
  /const EMPTY_SIDEBAR_CODING_SESSIONS: BirdCoderCodingSession\[\] = \[\];/,
  'Code sidebar must keep a stable empty coding-session collection for lazy inactive views.',
);

assert.match(
  sidebarSource,
  /const EMPTY_SIDEBAR_FILTERED_PROJECT_SESSIONS: SidebarFilteredProjectSessionsEntry\[\] = \[\];/,
  'Code sidebar must keep a stable empty project-session collection for lazy inactive views.',
);

assert.match(
  sidebarSource,
  /const EMPTY_SIDEBAR_PROJECT_ENTRIES: SidebarProjectEntry\[\] = \[\];/,
  'Code sidebar must keep a stable empty project-entry collection for lazy inactive views.',
);

assert.match(
  sidebarSource,
  /const chronologicalSessions = useMemo\([\s\S]*if \(organizeBy !== 'chronological'\) \{[\s\S]*return EMPTY_SIDEBAR_CODING_SESSIONS;[\s\S]*\}/s,
  'Code sidebar must not build the chronological all-session list while the project-organized view is active.',
);

assert.match(
  sidebarSource,
  /const filteredProjectSessions = useMemo<SidebarFilteredProjectSessionsEntry\[\]>\([\s\S]*if \(organizeBy !== 'project'\) \{[\s\S]*return EMPTY_SIDEBAR_FILTERED_PROJECT_SESSIONS;[\s\S]*\}/s,
  'Code sidebar must not filter and sort every project session while the chronological view is active.',
);

assert.match(
  sidebarSource,
  /const projectEntries = useMemo<SidebarProjectEntry\[\]>\([\s\S]*if \(organizeBy !== 'project'\) \{[\s\S]*return EMPTY_SIDEBAR_PROJECT_ENTRIES;[\s\S]*\}/s,
  'Code sidebar must not build project expansion entries while the chronological view is active.',
);

assert.doesNotMatch(
  sidebarSource,
  /renderProjects\s*\.flatMap\(/,
  'Code sidebar must avoid flatMap allocation over the full project tree in hot inventory paths.',
);

assert.doesNotMatch(
  sidebarSource,
  /new Map\(\s*renderProjects\.flatMap/s,
  'Code sidebar session lookup must be built with a single imperative pass instead of flatMap plus nested map allocations.',
);

assert.match(
  sidebarSource,
  /function resolveSidebarProjectViewSessions\([\s\S]*if \(sortBy === 'updated'\) \{[\s\S]*return codingSessions as BirdCoderCodingSession\[\];[\s\S]*\}/s,
  'Project-organized sidebar view must reuse the already activity-sorted session order when sorting by updated time.',
);

assert.doesNotMatch(
  sidebarSource,
  /filteredSessions:\s*buildSortedCodingSessions\(/,
  'Project-organized sidebar view must not re-sort every project session list on the default updated-time render path.',
);

console.log('sidebar chronological lazy performance contract passed.');
