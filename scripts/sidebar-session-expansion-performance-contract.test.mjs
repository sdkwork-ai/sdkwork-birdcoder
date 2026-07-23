import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebarSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);
const projectSectionSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorerProjectSection.tsx', import.meta.url),
  'utf8',
);
const projectExplorerTypesSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorer.types.ts', import.meta.url),
  'utf8',
);
const studioSidebarSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioChatSidebar.tsx', import.meta.url),
  'utf8',
);
const projectsHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts', import.meta.url),
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
  /const projectEntries = useMemo<SidebarProjectEntry\[\]>\([\s\S]*buildSortedAgentSessions\(/s,
  'Code sidebar project entry derivation must not call buildSortedAgentSessions directly because visible-count updates would re-sort every project session list.',
);

for (const [surfaceName, source] of [
  ['Code', sidebarSource],
  ['Studio', studioSidebarSource],
]) {
  assert.match(
    source,
    /const INITIAL_VISIBLE_SESSIONS_PER_PROJECT = 5;/,
    `${surfaceName} project session lists must display five sessions initially.`,
  );
  assert.match(
    source,
    /const SESSION_EXPANSION_BATCH_SIZE = 10;/,
    `${surfaceName} project session lists must load ten additional sessions per click.`,
  );
  assert.match(
    source,
    /visibleSessionCountByProjectId\[[^\]]+\]\s*\?\?\s*INITIAL_VISIBLE_SESSIONS_PER_PROJECT/,
    `${surfaceName} must keep the visible session prefix independently for each project.`,
  );
  assert.match(
    source,
    /loadingMoreSessionProjectIdsRef\.current\.has\(normalizedProjectId\)/,
    `${surfaceName} must coalesce repeated Show more clicks for the same project.`,
  );
  assert.match(
    source,
    /await onLoadMoreProjectSessions(?:\?\.)?\(normalizedProjectId, nextCount\)/,
    `${surfaceName} must await the project-scoped authority callback before exposing another session batch.`,
  );
  assert.match(
    source,
    /Math\.max\(previousCount, Math\.min\(nextCount, loadedCount\)\)/,
    `${surfaceName} must reveal at most the sessions confirmed as loaded by authority.`,
  );
  assert.doesNotMatch(
    source,
    /t\(['"](?:code|studio)\.collapseSessions['"]\)/,
    `${surfaceName} must hide Show more at the end instead of turning it into a collapse action.`,
  );
}

assert.match(
  sidebarSource,
  /nextVisibleSessionCount:\s*visibleSessionCount \+ SESSION_EXPANSION_BATCH_SIZE/,
  'Code must request visible prefixes 15, 25, 35, and so on from the five-session initial prefix.',
);
assert.match(
  projectSectionSource,
  /entry\.canShowMoreSessions && \(/,
  'Code must render Show more only while the loaded project inventory contains a hidden sentinel.',
);
assert.match(
  projectSectionSource,
  /filteredSessions\.length > 0[\s\S]*?: !entry\.canShowMoreSessions \?[\s\S]*?entry\.canShowMoreSessions && \(/,
  'Code must keep Show more outside the filtered non-empty branch so search/archive filters cannot hide the continuation path.',
);
assert.match(
  projectSectionSource,
  /onLoadMoreProjectSessions\(project\.id, entry\.nextVisibleSessionCount\)/,
  'Code Show more must send the owning project id and the next +10 target to its callback.',
);
assert.match(
  projectExplorerTypesSource,
  /onLoadMoreProjectSessions\?:\s*\(\s*projectId: string,\s*requestedCount: number,/s,
  'ProjectExplorer must expose a project-scoped session pagination callback.',
);
assert.match(
  studioSidebarSource,
  /visibleSessionCount \+ SESSION_EXPANSION_BATCH_SIZE/,
  'Studio must request visible prefixes 15, 25, 35, and so on from the five-session initial prefix.',
);
assert.match(
  studioSidebarSource,
  /\{canShowMoreSessions && \(/,
  'Studio must remove the Show more control after the complete project session inventory is visible.',
);
assert.match(
  projectsHookSource,
  /sessionLimit:\s*Math\.min\(200_000, targetCount \+ 1\)/,
  'Show more must request one hidden authority sentinel beyond the visible target count.',
);
assert.match(
  projectsHookSource,
  /loadedCount:\s*synchronized\.loadedSessionCount/,
  'Show more must return the authority-confirmed project session count to both IDE surfaces.',
);
assert.match(
  projectsHookSource,
  /existingEntry\.targetCount >= targetCount[\s\S]*?await existingEntry\.promise[\s\S]*?existingResult\.loadedCount >= targetCount/,
  'A larger concurrent project-session target must wait for and then upgrade a smaller in-flight request.',
);
assert.match(
  projectsHookSource,
  /runtimeStatus:\s*'streaming',[\s\S]*?updatedAt:\s*optimisticMessage\.createdAt,[\s\S]*?lastTurnAt:\s*optimisticMessage\.createdAt,[\s\S]*?resolveMessageActivitySortTimestamp\(optimisticMessage\.createdAt\)/,
  'The optimistic send must update the session activity timestamp and stable sort key exactly once.',
);
assert.match(
  sidebarSource,
  /nextVisibleSessionCount:\s*visibleSessionCount \+ SESSION_EXPANSION_BATCH_SIZE/,
  'Code Show more must derive its next authority target from the internal expansion batch size.',
);
for (const [surfaceName, source, translationKey] of [
  ['Code', sidebarSource, 'code'],
  ['Studio', studioSidebarSource, 'studio'],
]) {
  const legacyExpansionField = ['next', 'ExpansionCount'].join('');
  assert.match(
    source,
    new RegExp(`t\\('${translationKey}\\.showMoreSessions'\\)`),
    `${surfaceName} must use the stable Show more label without exposing the internal batch size.`,
  );
  assert.doesNotMatch(
    source,
    new RegExp(`t\\('${translationKey}\\.showMoreSessions',\\s*\\{`),
    `${surfaceName} must not pass a count into the stable Show more label.`,
  );
  assert.doesNotMatch(
    source,
    new RegExp(legacyExpansionField),
    `${surfaceName} must not keep a view-model field used only to expose the internal batch size.`,
  );
}
assert.match(
  sidebarSource,
  /collectSidebarChronologicalSessions\([\s\S]*?visibleSessionCountByProjectId[\s\S]*?sessionIndex < sessionCount/,
  'Chronological mode must flatten only each project\'s visible five-plus-ten window and keep the hidden sentinel out of the list.',
);
assert.match(
  sidebarSource,
  /chronologicalContinuationEntries\.map\([\s\S]*?entry\.project\.id,[\s\S]*?entry\.nextVisibleSessionCount/,
  'Chronological mode must retain a project-scoped Show more path for every project with a continuation sentinel.',
);

console.log('sidebar session expansion performance contract passed.');
