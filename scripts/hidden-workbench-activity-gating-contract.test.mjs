import assert from 'node:assert/strict';
import fs from 'node:fs';

const codePageSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const studioPageSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
const projectsHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts', import.meta.url),
  'utf8',
);
const selectedMessagesHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useSelectedAgentSessionItems.ts', import.meta.url),
  'utf8',
);
const fileSystemHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useFileSystem.ts', import.meta.url),
  'utf8',
);
const codeCommandsHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeWorkbenchCommands.ts', import.meta.url),
  'utf8',
);
const codeEffectiveWorkspaceHookSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeEffectiveWorkspaceId.ts',
    import.meta.url,
  ),
  'utf8',
);
const studioBindingsHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/useStudioWorkbenchEventBindings.ts', import.meta.url),
  'utf8',
);
const agentSessionActionsHookSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useAgentSessionActions.ts', import.meta.url),
  'utf8',
);

assert.match(
  codePageSource,
  /useCodeEffectiveWorkspaceId\(\{[\s\S]*isVisible,[\s\S]*workspaceId,[\s\S]*\}\)/s,
  'CodePage must derive its effective workspace through the dedicated hook so workspace fallback remains consistently gated.',
);

assert.match(
  codeEffectiveWorkspaceHookSource,
  /useWorkspaces\(\{\s*isActive:\s*isVisible\s*\}\)/s,
  'useCodeEffectiveWorkspaceId must gate workspace-store subscriptions behind page visibility before deriving the effective workspace.',
);

assert.match(
  codePageSource,
  /useProjects\(\s*(?:workspaceId|effectiveWorkspaceId),\s*\{[\s\S]*?isActive:\s*isVisible,[\s\S]*?\}\s*\)/s,
  'CodePage must gate project-store subscriptions behind page visibility so the hidden code workbench stops replaying project inventory updates.',
);

assert.match(
  codePageSource,
  /useCodeWorkbenchCommands\(\{[\s\S]*isActive:\s*isVisible,[\s\S]*\}\);/s,
  'CodePage must gate workbench command listeners behind page visibility so hidden code surfaces stop responding to global commands.',
);

assert.match(
  codePageSource,
  /useFileSystem\(currentProjectId,\s*\{[\s\S]*isActive:\s*isVisible,[\s\S]*\}\)/s,
  'CodePage must gate filesystem loading by project id behind page visibility so hidden code surfaces stop loading trees and file contents without reading remote project paths.',
);

assert.match(
  codePageSource,
  /useAgentSessionActions\(\s*currentProjectId,\s*createAgentSessionWithSelection,\s*selectSession,\s*\{[\s\S]*isActive:\s*isVisible,[\s\S]*\},?\s*\)/s,
  'CodePage must gate coding-session command listeners behind page visibility.',
);

assert.match(
  codePageSource,
  /const isSelectedAgentSessionTranscriptVisible =\s*isVisible && \(\s*activeTab === 'ai' \|\| activeTab === 'editor'\s*\);/s,
  'CodePage must compute transcript visibility from the currently visible chat surfaces so transcript synchronization does not keep running while the mobile programming surface is active.',
);

assert.match(
  codePageSource,
  /useSelectedAgentSessionItems\(\{[\s\S]*isActive:\s*isSelectedAgentSessionTranscriptVisible,[\s\S]*\}\)/s,
  'CodePage must gate selected-session transcript synchronization behind transcript visibility instead of only page visibility.',
);

assert.match(
  studioPageSource,
  /useProjects\(\s*workspaceId,\s*\{[\s\S]*?isActive:\s*isVisible,[\s\S]*?\}\s*\)/s,
  'StudioPage must gate project-store subscriptions behind page visibility so the hidden studio workbench stops replaying project inventory updates.',
);

assert.match(
  studioPageSource,
  /useStudioWorkbenchEventBindings\(\{[\s\S]*isActive:\s*isVisible,[\s\S]*\}\);/s,
  'StudioPage must gate workbench command listeners behind page visibility so hidden studio surfaces stop responding to global commands.',
);

assert.match(
  studioPageSource,
  /if \(!isVisible\) \{\s*return;\s*\}\s*const unsubscribe = globalEventBus\.on\('toggleSidebar', handleToggleSidebar\);/s,
  'StudioPage must only listen for sidebar-toggle commands while visible.',
);

assert.match(
  studioPageSource,
  /useFileSystem\(currentProjectId,\s*\{[\s\S]*isActive:\s*isVisible,[\s\S]*\}\)/s,
  'StudioPage must gate filesystem loading by project id behind page visibility so hidden studio surfaces stop loading trees and file contents without reading remote project paths.',
);

assert.match(
  studioPageSource,
  /useAgentSessionActions\(\s*currentProjectId,\s*createAgentSessionWithSelection,\s*\(agentSessionId\) => \{[\s\S]*\},\s*\{[\s\S]*isActive:\s*isVisible,[\s\S]*\},?\s*\)/s,
  'StudioPage must gate coding-session command listeners behind page visibility.',
);

assert.match(
  studioPageSource,
  /const isSelectedAgentSessionTranscriptVisible = isVisible && isSidebarVisible;/s,
  'StudioPage must compute transcript visibility from the sidebar visibility so transcript synchronization pauses when the chat surface is collapsed.',
);

assert.match(
  studioPageSource,
  /useSelectedAgentSessionItems\(\{[\s\S]*isActive:\s*isSelectedAgentSessionTranscriptVisible,[\s\S]*\}\)/s,
  'StudioPage must gate selected-session transcript synchronization behind transcript visibility instead of only page visibility.',
);

assert.match(
  projectsHookSource,
  /isActive\?: boolean;/,
  'useProjects options must expose an activity flag for persistent hidden workbench surfaces.',
);

assert.match(
  projectsHookSource,
  /const isActive = options\?\.isActive \?\? true;/,
  'useProjects must default the activity flag to true.',
);

assert.match(
  projectsHookSource,
  /if \(!isActive\) \{[\s\S]*return;\s*\}/s,
  'useProjects must skip store subscription, realtime setup, and mount fetching while inactive.',
);

assert.match(
  projectsHookSource,
  /if \(!isActive\) \{\s*setStoreSnapshot\(createProjectsStoreSnapshot\(\)\);\s*return;\s*\}[\s\S]*const store = getProjectsStore\(storeScopeKey\);/s,
  'useProjects must bail out before creating or reading a project store while inactive so hidden workbench surfaces do not retain unused workspace stores.',
);

assert.match(
  selectedMessagesHookSource,
  /isActive\?: boolean;/,
  'useSelectedAgentSessionItems options must expose an activity flag.',
);

assert.match(
  selectedMessagesHookSource,
  /if \(!isActive \|\| !normalizedSessionId \|\| activeRequestKeyRef\.current === requestKey\) \{/,
  'useSelectedAgentSessionItems must skip transcript synchronization while inactive.',
);
assert.doesNotMatch(
  selectedMessagesHookSource,
  /appRuntimeReadService|localTranscriptReader/,
  'Selected-session item refresh must use only the canonical Agents session service.',
);

assert.match(
  fileSystemHookSource,
  /interface UseFileSystemOptions \{[\s\S]*isActive\?: boolean;[\s\S]*\}/s,
  'useFileSystem must expose an activity flag for hidden persistent surfaces.',
);

assert.match(
  fileSystemHookSource,
  /export function useFileSystem\(projectId: string, options\?: UseFileSystemOptions\)/,
  'useFileSystem must accept the activity options bag without accepting a remote-project path.',
);

assert.match(
  fileSystemHookSource,
  /const isActive = options\?\.isActive \?\? true;/,
  'useFileSystem must default the activity flag to true.',
);

assert.match(
  fileSystemHookSource,
  /if \(!requestProjectId \|\| !loadActive\) \{/,
  'useFileSystem must skip file-tree loading while inactive or while the code workspace remains unloaded.',
);

assert.match(
  fileSystemHookSource,
  /if \(!requestProjectId \|\| !requestSelectedFile \|\| !loadActive\) return;/,
  'useFileSystem must skip file-content loading while inactive or while the code workspace remains unloaded.',
);

assert.match(
  codeCommandsHookSource,
  /isActive\?: boolean;/,
  'useCodeWorkbenchCommands options must expose an activity flag.',
);

assert.match(
  codeCommandsHookSource,
  /if \(!isActive\) \{\s*return undefined;\s*\}/s,
  'useCodeWorkbenchCommands must not bind global workbench listeners while inactive.',
);

assert.match(
  studioBindingsHookSource,
  /isActive\?: boolean;/,
  'useStudioWorkbenchEventBindings options must expose an activity flag.',
);

assert.match(
  studioBindingsHookSource,
  /if \(!isActive\) \{\s*return undefined;\s*\}/s,
  'useStudioWorkbenchEventBindings must not bind global workbench listeners while inactive.',
);

assert.match(
  agentSessionActionsHookSource,
  /options\?: \{[\s\S]*isActive\?: boolean;[\s\S]*\}/s,
  'useAgentSessionActions must accept an activity flag.',
);

assert.match(
  agentSessionActionsHookSource,
  /const isActive = options\?\.isActive \?\? true;/,
  'useAgentSessionActions must default the activity flag to true.',
);

assert.match(
  agentSessionActionsHookSource,
  /if \(!isActive\) \{\s*return undefined;\s*\}/s,
  'useAgentSessionActions must not bind create-session listeners while inactive.',
);

console.log('hidden workbench activity gating contract passed.');
