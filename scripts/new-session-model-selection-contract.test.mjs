import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readSource = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const newSessionButtonSource = readSource(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/WorkbenchNewSessionButton.tsx',
);
const projectExplorerHeaderSource = readSource(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorerHeader.tsx',
);
const sidebarSource = readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx');
const projectContextMenuSource = readSource(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorerProjectContextMenu.tsx',
);
const universalChatSource = readSource(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
);
const chatSelectionSource = readSource(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useWorkbenchChatSelection.ts',
);

assert.match(
  newSessionButtonSource,
  /onCreateSession:\s*\(engineId:\s*string,\s*modelId:\s*string\)\s*=>/,
  'WorkbenchNewSessionButton must expose both engineId and modelId to every new-session caller.',
);
assert.match(
  newSessionButtonSource,
  /onCreateSession\(preferredSelection\.engine\.id,\s*preferredSelection\.modelId\)/,
  'WorkbenchNewSessionButton primary action must create the session with the resolved per-engine model.',
);
assert.match(
  newSessionButtonSource,
  /const engineModelId = item\.engine\s*\?\s*resolveWorkbenchAgentEngineSelectedModelId\(\s*item\.engine\.id,\s*preferences\)[\s\S]*onCreateSession\(item\.id,\s*engineModelId\)/,
  'WorkbenchNewSessionButton engine menu must create each engine with that engine owned selected model.',
);
assert.match(
  newSessionButtonSource,
  /getWorkbenchCodeModelLabel\(item\.engine\.id,\s*engineModelId,\s*preferences\)/,
  'WorkbenchNewSessionButton engine menu must show the model that will be used for each new session engine option.',
);
assert.match(
  projectExplorerHeaderSource,
  /onCreateSession:\s*\(engineId:\s*string,\s*modelId:\s*string\)/,
  'Project explorer header must pass modelId through the new-session creation boundary.',
);
assert.match(
  projectExplorerHeaderSource,
  /onCreateSession=\{onCreateSession\}/,
  'Project explorer header must forward the engine and model aware session callback to WorkbenchNewSessionButton.',
);
assert.match(
  projectExplorerHeaderSource,
  /from '@sdkwork\/birdcoder-pc-ui\/components\/WorkbenchNewSessionButton';/,
  'Project explorer must load WorkbenchNewSessionButton through its precise UI component subpath.',
);
assert.match(
  sidebarSource,
  /const handleCreateEngineSession = useCallback\(\s*\(engineId:\s*string,\s*modelId:\s*string\)/,
  'Project sidebar must accept modelId when creating a session from the shared button or root menu.',
);
assert.match(
  sidebarSource,
  /onNewAgentSessionInProject\(selectedProjectId,\s*engineId,\s*modelId\)/,
  'Project sidebar must forward modelId into project-scoped session creation.',
);
assert.match(
  projectContextMenuSource,
  /onCreateEngineSession:\s*\(projectId:\s*string,\s*engineId:\s*string,\s*modelId:\s*string\)/,
  'Project context menu must carry modelId for engine-specific session creation.',
);
assert.match(
  universalChatSource,
  /const selectedProviderModelId = resolveWorkbenchAgentEngineSelectedModelId\(\s*selectedProvider,\s*preferences,\s*selectedProvider === resolvedSelectedEngineId \? currentModelId : undefined,\s*\)/s,
  'UniversalChat model menu must compute the selected model for the provider being viewed instead of reusing the active engine model.',
);
assert.match(
  chatSelectionSource,
  /useWorkbenchAgentEngineCatalog\(\)[\s\S]*if \(!agentEngineCatalog\.loaded\) \{\s*await loadWorkbenchAgentEngineCatalog\(\);\s*\}/,
  'Provider Session creation must subscribe to and await the Agents agent-engine catalog before resolving runtime identity.',
);

console.log('new session model selection contract passed.');
