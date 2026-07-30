import assert from 'node:assert/strict';
import fs from 'node:fs';

function readWorkspaceSource(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const projectsHookSource = readWorkspaceSource(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts',
);
const projectsStoreSource = readWorkspaceSource(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/stores/projectsStore.ts',
);
const codeSidebarSource = readWorkspaceSource(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx',
);
const projectExplorerSource = readWorkspaceSource(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorer.shared.ts',
);
const studioSidebarSource = readWorkspaceSource(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioChatSidebar.tsx',
);

assert.doesNotMatch(
  projectsHookSource,
  /loadProjectsAgentSessionInventory|loadWorkspaceSessionInboxUpdate|workspaceSessionInboxSync/,
  'Loading the Project inventory must not eagerly load Session inventories or start Workspace Session polling.',
);
assert.match(
  projectsHookSource,
  /const incomingProjects = normalizeProjectsForInventoryStore\(\s*filterProjectsForInventoryStore\(store, page\.items\.filter\(Boolean\)\),\s*\);/u,
  'Project inventory pages must pass Project and Session rows through the Store tombstone filter before committing.',
);
assert.match(
  projectsHookSource,
  /upsertProjectIntoProjectsStoreByScopeKey\(storeScopeKey, synchronized\.project\);/u,
  'Project-scoped Session pagination must commit through the current page Store tombstone boundary.',
);
assert.doesNotMatch(
  projectsHookSource,
  /mutateProjectsStoreByScopeKey\(baseStoreScopeKey, \(projects\) =>\s*upsertProjectIntoCollection\(projects, synchronized\.project\)/u,
  'Project-scoped Session pagination must not write a non-default page into the base Store.',
);
assert.match(
  codeSidebarSource,
  /const isExpanding = expandedProjects\[projectId\] !== true;[\s\S]*isExpanding && project\?\.agentSessionPageInfo === undefined[\s\S]*handleLoadMoreProjectSessions\(projectId, INITIAL_VISIBLE_SESSIONS_PER_PROJECT\)/,
  'Project grouping must request the first project-scoped Session page when an unloaded Project is expanded.',
);
assert.match(
  codeSidebarSource,
  /!isVisible \|\| organizeBy === 'project'[\s\S]*project\.agentSessionPageInfo === undefined[\s\S]*handleLoadMoreProjectSessions\([\s\S]*project\.projectId,[\s\S]*INITIAL_VISIBLE_SESSIONS_PER_PROJECT/,
  'Flat provider and chronological groupings must load the first Session page after startup or refresh.',
);
assert.doesNotMatch(
  codeSidebarSource,
  /Expand projects by default|newExpanded\[p\.projectId\] = true/,
  'Projects must remain collapsed until the user chooses which Session inventory to load.',
);
assert.match(
  studioSidebarSource,
  /!showProjectMenu \|\|[\s\S]*!menuProject \|\|[\s\S]*menuProject\.agentSessionPageInfo !== undefined[\s\S]*handleLoadMoreMenuProjectSessions\([\s\S]*menuProject\.projectId,[\s\S]*INITIAL_VISIBLE_SESSIONS_PER_PROJECT/,
  'Studio must lazily request the selected Project Session page when the Project menu opens or its selection changes.',
);
assert.match(
  projectExplorerSource,
  /project\.agentSessionPageInfo === undefined[\s\S]*visibleSessionCount < project\.agentSessions\.length[\s\S]*agentSessionPageInfo\?\.hasMore === true/,
  'An unloaded Project must expose a loading path while loaded empty Projects remain true empty states.',
);
assert.match(
  projectsStoreSource,
  /agentSessionPageInfo:\s*incomingProject\.agentSessionPageInfo \?\? existingProject\?\.agentSessionPageInfo/,
  'Project inventory refreshes must preserve an already loaded Session page cursor.',
);
assert.match(
  projectsStoreSource,
  /left\.agentSessionPageInfo\?\.mode === right\.agentSessionPageInfo\?\.mode[\s\S]*left\.agentSessionPageInfo\?\.pageSize === right\.agentSessionPageInfo\?\.pageSize[\s\S]*left\.agentSessionPageInfo\?\.hasMore === right\.agentSessionPageInfo\?\.hasMore[\s\S]*left\.agentSessionPageInfo\?\.hasNewer === right\.agentSessionPageInfo\?\.hasNewer[\s\S]*left\.agentSessionPageInfo\?\.nextCursor === right\.agentSessionPageInfo\?\.nextCursor/,
  'Project store identity checks must include Session page metadata.',
);

console.log('project session lazy-loading contract passed.');
