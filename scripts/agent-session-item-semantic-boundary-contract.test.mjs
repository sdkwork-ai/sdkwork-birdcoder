import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const contractsSourceRoot = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src',
);
const workbenchSourceRoot = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src',
);
const uiSourceRoot = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src',
);

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

function assertMissing(...segments) {
  const relativePath = segments.join('/');
  assert.equal(
    fs.existsSync(path.join(rootDir, ...segments)),
    false,
    `Retired Agents chat-message artifact must stay absent: ${relativePath}`,
  );
}

const retiredContractFiles = [
  'chat-message-activity-view.ts',
  'chat-message-media.ts',
  'chat-message-reasoning.ts',
  'chat-message-resources.ts',
  'chat-message-task-progress.ts',
  'chat-message-tool-calls.ts',
  'chat-message-tool-results.ts',
  'chat-message-view.ts',
];

for (const fileName of retiredContractFiles) {
  assertMissing(
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-contracts-commons',
    'src',
    fileName,
  );
}

assert.deepEqual(
  fs.readdirSync(contractsSourceRoot).filter((fileName) => /^chat-message-.*\.ts$/u.test(fileName)),
  [],
  'Agents contracts must not reintroduce chat-message-* source modules.',
);

assertMissing(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'chat',
  'messageQueueStore.ts',
);
assertMissing(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'chatComposerRecovery.ts',
);

const contractsIndexSource = fs.readFileSync(path.join(contractsSourceRoot, 'index.ts'), 'utf8');
const workbenchIndexSource = fs.readFileSync(path.join(workbenchSourceRoot, 'index.ts'), 'utf8');
const contractsSource = fs.readdirSync(contractsSourceRoot)
  .filter((fileName) => fileName.endsWith('.ts'))
  .map((fileName) => fs.readFileSync(path.join(contractsSourceRoot, fileName), 'utf8'))
  .join('\n');

for (const canonicalContractModule of [
  'agent-session-item-activity-presentation',
  'agent-session-item-media',
  'agent-session-item-presentation',
  'agent-session-item-reasoning',
  'agent-session-item-resources',
  'agent-session-item-task-progress',
  'agent-session-item-tool-calls',
  'agent-session-item-tool-results',
]) {
  assert.match(
    contractsIndexSource,
    new RegExp(`export \\* from './${canonicalContractModule}\\.ts';`, 'u'),
    `Contracts index must export the canonical ${canonicalContractModule} module.`,
  );
}

for (const retiredIdentifier of [
  'ChatMessageViewSource',
  'ResolveChatMessageViewOptions',
  'resolveChatMessageView',
  'resolveChatMessageViews',
  'estimateChatMessageViewHeight',
  'buildChatMessageViewSynchronizationSignature',
  'ChatTurnActivitySummaryIndex',
  'buildChatTurnActivitySummaryIndex',
  'resolveChatTurnActivitySummaryIndex',
  'normalizeMessageResource',
  'MAX_MESSAGE_RESOURCES',
  'resolveChatMessageToolCallNonErrorOutputValue',
]) {
  assert.doesNotMatch(
    contractsSource,
    new RegExp(`\\b${retiredIdentifier}\\b`, 'u'),
    `Agents contracts must not retain the retired ${retiredIdentifier} public contract.`,
  );
}

assert.match(contractsSource, /export interface AgentSessionItemPresentation\b/u);
assert.match(contractsSource, /export function resolveAgentSessionItemPresentation\b/u);
assert.match(contractsSource, /\bAgentTurnActivitySummaryIndex\b/u);
assert.match(contractsSource, /\bnormalizeSessionItemResource\b/u);
assert.match(contractsSource, /\bresolveAgentSessionItemToolCallNonErrorOutputValue\b/u);
assert.match(contractsSource, /\bsessionItemId:\s*string\b/u);
assert.doesNotMatch(
  contractsSource,
  /\bmessageId(?:s)?\b|\bmessageContent\b|\bmessageIdentity\b|\bmessageIndexes(?:ByScopeId|ByTurnId)?\b/u,
  'Agents contracts must name item identity and turn input with Agents domain vocabulary.',
);

assert.match(workbenchIndexSource, /export \* from '\.\/chat\/agentTurnInputQueueStore\.ts';/u);
for (const retiredIdentifier of [
  'WorkbenchChatQueuedMessage',
  'WorkbenchChatMessageQueueFlushGateState',
  'useWorkbenchChatMessageQueue',
]) {
  assert.doesNotMatch(
    workbenchIndexSource,
    new RegExp(`\\b${retiredIdentifier}\\b`, 'u'),
    `Workbench must not export the retired ${retiredIdentifier} contract.`,
  );
}

const agentWorkflowSource = [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/chat/agentTurnInputQueueStore.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/chat/types.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useWorkbenchAgentSessionItemEditAction.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/stores/projectsStore.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/agentSessionCreation.ts',
].map((relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8')).join('\n');

assert.match(agentWorkflowSource, /\bsubmitAgentTurnInput\b/u);
assert.match(agentWorkflowSource, /\bWorkbenchQueuedAgentTurnInput\b/u);
assert.match(agentWorkflowSource, /\bsessionItemId\b/u);
assert.doesNotMatch(
  agentWorkflowSource,
  /\b(?:sendMessage|messageId|messageIds|messageContent|didEditMessage|WorkbenchChatQueuedMessage|useWorkbenchChatMessageQueue)\b/u,
  'Agents workflow source must use turn-input and session-item vocabulary instead of IM message vocabulary.',
);

const universalChatSource = fs.readFileSync(
  path.join(uiSourceRoot, 'components', 'UniversalChat.tsx'),
  'utf8',
);
const transcriptMessageSource = fs.readFileSync(
  path.join(uiSourceRoot, 'components', 'chat', 'messages', 'ChatTranscriptMessage.tsx'),
  'utf8',
);
const rendererTypesSource = fs.readFileSync(
  path.join(uiSourceRoot, 'components', 'chat', 'messages', 'types.ts'),
  'utf8',
);

assert.match(universalChatSource, /messages:\s*AgentSessionItemView\[\]/u);
assert.match(universalChatSource, /\bonSendMessage\b/u);
assert.match(transcriptMessageSource, /message:\s*AgentSessionItemView\b/u);
assert.match(transcriptMessageSource, /resolveAgentSessionItemPresentation\(/u);
assert.match(rendererTypesSource, /view:\s*AgentSessionItemPresentation\b/u);
assert.match(rendererTypesSource, /export interface ChatMessageRenderContext\b/u);

console.log('Agent Session Item semantic boundary contract passed.');
