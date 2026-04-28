import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readSource = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const newSessionButtonSource = readSource(
  'packages/sdkwork-birdcoder-ui/src/components/WorkbenchNewSessionButton.tsx',
);
const topBarSource = readSource('packages/sdkwork-birdcoder-code/src/components/TopBar.tsx');
const sidebarSource = readSource('packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx');
const projectContextMenuSource = readSource(
  'packages/sdkwork-birdcoder-code/src/components/ProjectExplorerProjectContextMenu.tsx',
);
const universalChatSource = readSource(
  'packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx',
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
  /const engineModelId = resolveWorkbenchCodeEngineSelectedModelId\(\s*engine\.id,\s*preferences,?\s*\)[\s\S]*onCreateSession\(engine\.id,\s*engineModelId\)/,
  'WorkbenchNewSessionButton engine menu must create each engine with that engine owned selected model.',
);
assert.match(
  newSessionButtonSource,
  /getWorkbenchCodeModelLabel\(engine\.id,\s*engineModelId,\s*preferences\)/,
  'WorkbenchNewSessionButton engine menu must show the model that will be used for each new session engine option.',
);
assert.match(
  topBarSource,
  /onCreateNewSession:\s*\(engineId\?:\s*string,\s*modelId\?:\s*string\)/,
  'Code top bar must pass modelId through the new-session creation boundary.',
);
assert.match(
  topBarSource,
  /void onCreateNewSession\(engineId,\s*modelId\)/,
  'Code top bar WorkbenchNewSessionButton adapter must forward engineId and modelId together.',
);
assert.match(
  sidebarSource,
  /const handleCreateEngineSession = useCallback\(\(engineId:\s*string,\s*modelId:\s*string\)/,
  'Project sidebar must accept modelId when creating a session from the shared button or root menu.',
);
assert.match(
  sidebarSource,
  /onNewCodingSessionInProject\(selectedProjectId,\s*engineId,\s*modelId\)/,
  'Project sidebar must forward modelId into project-scoped session creation.',
);
assert.match(
  projectContextMenuSource,
  /onCreateEngineSession:\s*\(projectId:\s*string,\s*engineId:\s*string,\s*modelId:\s*string\)/,
  'Project context menu must carry modelId for engine-specific session creation.',
);
assert.match(
  universalChatSource,
  /const selectedProviderModelId = resolveWorkbenchCodeEngineSelectedModelId\(\s*selectedProvider,\s*preferences,\s*selectedProvider === resolvedSelectedEngineId \? currentModelId : undefined,\s*\)/s,
  'UniversalChat model menu must compute the selected model for the provider being viewed instead of reusing the active engine model.',
);

console.log('new session model selection contract passed.');
