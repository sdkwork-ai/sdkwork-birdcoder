import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const universalChatSource = readText('packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx');
const pendingInteractionsSource = fs.existsSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-ui/src/components/UniversalChatPendingInteractions.tsx'),
)
  ? readText('packages/sdkwork-birdcoder-ui/src/components/UniversalChatPendingInteractions.tsx')
  : '';
const codePageSource = readText('packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx');
const codePendingInteractionsSource = readText(
  'packages/sdkwork-birdcoder-code/src/pages/useCodePendingInteractions.ts',
);
const codeSurfacePropsSource = readText('packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts');
const editorPanelTypesSource = readText('packages/sdkwork-birdcoder-code/src/pages/codeEditorWorkspacePanel.types.ts');
const editorPanelSource = readText('packages/sdkwork-birdcoder-code/src/pages/CodeEditorWorkspacePanel.tsx');
const studioPageSource = readText('packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx');
const studioSidebarSource = readText('packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx');

assert.match(
  universalChatSource,
  /pendingUserQuestions\?:\s*BirdCoderCodingSessionPendingUserQuestion\[\]/,
  'UniversalChatProps must expose pending user questions as a first-class SDK interaction surface.',
);

assert.match(
  universalChatSource,
  /pendingApprovals\?:\s*BirdCoderCodingSessionPendingApproval\[\]/,
  'UniversalChatProps must expose pending approvals as a first-class SDK interaction surface.',
);

assert.match(
  universalChatSource,
  /onSubmitUserQuestionAnswer\?:\s*\([^)]*BirdCoderSubmitUserQuestionAnswerRequest[^)]*\)\s*=>\s*void\s*\|\s*Promise<void>/s,
  'UniversalChatProps must expose an async-capable user-question answer submission handler.',
);

assert.match(
  universalChatSource,
  /onSubmitApprovalDecision\?:\s*\([^)]*BirdCoderSubmitApprovalDecisionRequest[^)]*\)\s*=>\s*void\s*\|\s*Promise<void>/s,
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
  /optionId[\s\S]*optionLabel[\s\S]*answer/,
  'Pending question option clicks must preserve SDK optionId, optionLabel, and answer payload semantics.',
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
  /useCodingSessionPendingInteractionState\(\s*sessionId,\s*refreshToken,\s*sessionScopeKey,\s*projectId,\s*\)/,
  'Code pending interaction hook must consume the shared combined pending interaction projection hook with the scoped session and project keys.',
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
  /<UniversalChat[\s\S]*pendingUserQuestions=\{pendingUserQuestions\}[\s\S]*pendingApprovals=\{pendingApprovals\}/,
  'Editor-side UniversalChat must receive pending interactions for split IDE workflows.',
);

assert.match(
  studioPageSource,
  /useCodingSessionPendingInteractionState\(\s*sessionId \|\| null,\s*pendingInteractionRefreshToken,\s*pendingInteractionScopeKey,\s*currentProjectId,\s*\)/,
  'StudioPage must consume pending approval and user-question state from the shared combined projection hook with the scoped session and project keys.',
);

assert.match(
  studioSidebarSource,
  /<UniversalChat[\s\S]*pendingApprovals=\{pendingApprovals\}[\s\S]*pendingUserQuestions=\{pendingUserQuestions\}/,
  'Studio sidebar UniversalChat must receive pending interactions.',
);

console.log('universal chat pending interactions contract passed.');
