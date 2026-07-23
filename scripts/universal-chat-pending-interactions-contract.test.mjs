import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const universalChatSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx');
const pendingInteractionsSource = fs.existsSync(
  path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatPendingInteractions.tsx'),
)
  ? readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatPendingInteractions.tsx')
  : '';
const codePageSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx');
const codePendingInteractionsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePendingInteractions.ts',
);
const codeSurfacePropsSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSurfaceProps.ts');
const editorPanelTypesSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/codeEditorWorkspacePanel.types.ts');
const editorPanelSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodeEditorWorkspacePanel.tsx');
const studioPageSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx');
const studioSidebarSource = readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioChatSidebar.tsx');

assert.match(
  universalChatSource,
  /pendingUserQuestions\?:\s*AgentSessionPendingQuestion\[\]/,
  'UniversalChatProps must expose pending Agents user questions as a first-class interaction surface.',
);

assert.match(
  universalChatSource,
  /pendingApprovals\?:\s*AgentSessionPendingApproval\[\]/,
  'UniversalChatProps must expose pending Agents approvals as a first-class interaction surface.',
);

assert.match(
  universalChatSource,
  /onSubmitUserQuestionAnswer\?:\s*\([^)]*AgentQuestionAnswerInput[^)]*\)\s*=>\s*void\s*\|\s*Promise<void>/s,
  'UniversalChatProps must expose an async-capable user-question answer submission handler.',
);

assert.match(
  universalChatSource,
  /onSubmitApprovalDecision\?:\s*\([^)]*AgentApprovalDecisionInput[^)]*\)\s*=>\s*void\s*\|\s*Promise<void>/s,
  'UniversalChatProps must expose an async-capable approval decision submission handler.',
);

assert.match(
  universalChatSource,
  /<UniversalChatPendingInteractions[\s\S]*pendingUserQuestions=\{pendingUserQuestions\}[\s\S]*pendingApprovals=\{pendingApprovals\}[\s\S]*onSubmitUserQuestionAnswer=\{handleSubmitPendingUserQuestionAnswer\}[\s\S]*onSubmitApprovalDecision=\{handleSubmitPendingApprovalDecision\}/,
  'UniversalChat must render one standardized pending-interactions panel above the composer.',
);

assert.match(
  universalChatSource,
  /hasPendingUserQuestionReplyTarget[\s\S]*submitPendingUserQuestionAnswerFromComposer[\s\S]*clearInputValue\(\)/,
  'UniversalChat composer submissions must answer a pending user question instead of enqueueing a normal turn while the engine is awaiting user input.',
);

assert.match(
  pendingInteractionsSource,
  /export function UniversalChatPendingInteractions\(/,
  'Pending user questions and approvals must live in a dedicated UniversalChatPendingInteractions component instead of growing the chat shell.',
);

assert.match(
  pendingInteractionsSource,
  /answer:\s*option\.value\?\.trim\(\)\s*\|\|\s*option\.label[\s\S]*optionValue:\s*option\.value[\s\S]*optionLabel:\s*option\.label/,
  'Pending question option clicks must preserve the canonical Agents option value, label, and answer semantics.',
);

assert.match(
  pendingInteractionsSource,
  /submitQuestionAnswer\([^)]*\{[\s\S]*rejected:\s*true[\s\S]*\}/,
  'Pending question UI must expose a first-class reject action instead of faking an empty answer.',
);

assert.match(
  pendingInteractionsSource,
  /t\('chat\.rejectQuestion'\)/,
  'Pending question reject action must use the standard chat.rejectQuestion label.',
);

assert.match(
  pendingInteractionsSource,
  /submitApprovalDecision\([^)]*'approved'[\s\S]*submitApprovalDecision\([^)]*'denied'[\s\S]*submitApprovalDecision\([^)]*'blocked'/,
  'Pending approval UI must expose approve, deny, and block decisions from the SDK contract.',
);

assert.match(
  pendingInteractionsSource,
  /isSubmitting/,
  'Pending interaction controls must expose an in-flight state so repeated clicks cannot submit duplicate decisions.',
);

assert.match(
  pendingInteractionsSource,
  /useEffect\(\(\) => \{[\s\S]*setAnswerDrafts[\s\S]*activeQuestionIds\.has\(questionId\)[\s\S]*setApprovalReasons[\s\S]*activeApprovalIds\.has\(approvalId\)[\s\S]*\}, \[activeApprovalIds, activeQuestionIds\]\);/,
  'Pending interaction panel must prune stale local drafts/reasons when the selected session or pending interaction set changes.',
);

assert.match(
  pendingInteractionsSource,
  /prompt\.options\.map\(\(option, optionIndex\)[\s\S]*key=\{buildQuestionOptionKey\(prompt, option, optionIndex\)\}/,
  'Pending question option buttons must include optionIndex in their React keys so duplicate provider option ids or labels cannot warn.',
);

assert.match(
  codePendingInteractionsSource,
  /useAgentSessionPendingInteractions\(\s*sessionId,\s*refreshToken,\s*sessionScopeKey,\s*projectId,\s*\)/,
  'Code pending interaction hook must consume canonical Agents Interactions with scoped session and project keys.',
);

assert.match(
  codeSurfacePropsSource,
  /useCodePendingInteractions\([\s\S]*pendingApprovals[\s\S]*pendingUserQuestions[\s\S]*onSubmitApprovalDecision[\s\S]*onSubmitUserQuestionAnswer/,
  'CodePage surface props must carry pending interactions through both main and editor chat surfaces.',
);

assert.doesNotMatch(
  codePageSource,
  /pendingUserQuestions|pendingApprovals|onSubmitUserQuestionAnswer|onSubmitApprovalDecision/,
  'CodePage must not own pending interaction prop plumbing; surface prop composition owns it.',
);

assert.match(
  editorPanelTypesSource,
  /pendingApprovals[\s\S]*pendingUserQuestions[\s\S]*onSubmitApprovalDecision[\s\S]*onSubmitUserQuestionAnswer/,
  'Editor-side chat props must support the same pending interaction contract as the main chat.',
);

assert.match(
  editorPanelSource,
  /<DeferredUniversalChat/,
  'Editor-side chat must preserve the standardized deferred UniversalChat boundary.',
);

assert.match(
  editorPanelSource,
  /pendingApprovals=\{pendingApprovals\}[\s\S]*pendingUserQuestions=\{pendingUserQuestions\}/,
  'Editor-side DeferredUniversalChat must receive both pending interaction collections for split IDE workflows.',
);

assert.match(
  studioPageSource,
  /useAgentSessionPendingInteractions\(\s*sessionId \|\| null,\s*pendingInteractionRefreshToken,\s*pendingInteractionScopeKey,\s*currentProjectId,\s*\)/,
  'StudioPage must consume canonical Agents approval and user-question interactions with scoped session and project keys.',
);

assert.match(
  studioSidebarSource,
  /<DeferredUniversalChat/,
  'Studio sidebar chat must preserve the standardized deferred UniversalChat boundary.',
);

assert.match(
  studioSidebarSource,
  /pendingApprovals=\{pendingApprovals\}[\s\S]*pendingUserQuestions=\{pendingUserQuestions\}/,
  'Studio sidebar DeferredUniversalChat must receive both pending interaction collections.',
);

console.log('universal chat pending interactions contract passed.');
