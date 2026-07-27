import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const chatSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
);
const progressiveWindowSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/useProgressiveTranscriptWindow.ts',
);
const codeSurfaceSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSurfaceProps.ts',
);
const editorPanelSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodeEditorWorkspacePanel.tsx',
);
const refreshHookSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useSessionRefreshActions.ts',
);

assert.match(
  chatSource,
  /hasMoreRemoteMessages\?: boolean;[\s\S]*isLoadingMoreRemoteMessages\?: boolean;[\s\S]*onLoadMoreRemoteMessages\?: \(\) => void \| Promise<void>;/,
  'UniversalChat must expose explicit remote transcript continuation state.',
);
assert.match(
  chatSource,
  /computeTranscriptRepairScrollTop\([\s\S]*pendingPrepend\.metrics[\s\S]*scrollContainer\.scrollHeight/,
  'Remote transcript prepends must preserve the visible scroll anchor.',
);
assert.match(
  chatSource,
  /!hasEarlierMessages && hasMoreRemoteMessages[\s\S]*chat\.loadEarlierMessages/,
  'The server continuation control must appear only after locally loaded messages are visible.',
);
assert.doesNotMatch(
  progressiveWindowSource,
  /transcriptIdentity\s*=\s*`\$\{normalizedTranscriptScopeKey\}\\u0001\$\{firstMessageId\}`/,
  'Prepending a server page must not reset the local transcript window as though a new Session opened.',
);
assert.match(
  codeSurfaceSource,
  /const mainChatProps[\s\S]*hasMoreRemoteMessages,[\s\S]*isLoadingMoreRemoteMessages,[\s\S]*onLoadMoreRemoteMessages,/,
  'The main coding chat must receive server transcript continuation props.',
);
assert.match(
  codeSurfaceSource,
  /const workspaceProps[\s\S]*hasMoreRemoteMessages,[\s\S]*isLoadingMoreRemoteMessages,[\s\S]*onLoadMoreRemoteMessages,/,
  'The editor workspace chat must receive the same server transcript continuation props.',
);
assert.match(
  editorPanelSource,
  /<DeferredUniversalChat[\s\S]*hasMoreRemoteMessages=\{hasMoreRemoteMessages\}[\s\S]*isLoadingMoreRemoteMessages=\{isLoadingMoreRemoteMessages\}[\s\S]*onLoadMoreRemoteMessages=\{onLoadMoreRemoteMessages\}/,
  'The editor sidebar must forward all transcript continuation props to UniversalChat.',
);
assert.match(
  refreshHookSource,
  /activeEarlierItemsRequestRef[\s\S]*activeRequest\?\.scopeKey === scopeKey[\s\S]*controller\.abort/,
  'Transcript continuation requests must deduplicate by Session scope and cancel superseded work.',
);
assert.doesNotMatch(
  chatSource,
  /fetch\(|axios\.|Authorization|Access-Token/,
  'UniversalChat must not bypass the injected Agents SDK service path.',
);

console.log('agent session transcript history contract passed.');
