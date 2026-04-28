import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const universalChatSource = await readFile(
  resolve('packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx'),
  'utf8',
);
const codePageSource = await readFile(
  resolve('packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx'),
  'utf8',
);
const workbenchMessageEditActionHookSource = await readFile(
  resolve('packages/sdkwork-birdcoder-commons/src/hooks/useWorkbenchCodingSessionMessageEditAction.ts'),
  'utf8',
);
const commonsIndexSource = await readFile(
  resolve('packages/sdkwork-birdcoder-commons/src/index.ts'),
  'utf8',
);
const codePageSurfacePropsSource = await readFile(
  resolve('packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts'),
  'utf8',
);
const codeEditorWorkspacePanelTypesSource = await readFile(
  resolve('packages/sdkwork-birdcoder-code/src/pages/codeEditorWorkspacePanel.types.ts'),
  'utf8',
);
const studioPageSource = await readFile(
  resolve('packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx'),
  'utf8',
);
const studioChatSidebarSource = await readFile(
  resolve('packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx'),
  'utf8',
);

assert.match(
  universalChatSource,
  /onEditMessage\?: \(messageId: string, content: string\) => void \| Promise<void>;/,
  'UniversalChat edit action must submit authoritative replacement content instead of only exposing a draft-copy hook.',
);

assert.match(
  universalChatSource,
  /const \[editingMessage,\s*setEditingMessage\] = useState<\{[\s\S]*messageId: string;[\s\S]*originalContent: string;[\s\S]*previousDraft: string;[\s\S]*\} \| null>\(null\);/,
  'UniversalChat must keep an explicit editing state so edited messages cannot be confused with new turns.',
);

assert.match(
  universalChatSource,
  /const \[editingMessage,\s*setEditingMessage\] = useState<\{[\s\S]*scopeKey: string;[\s\S]*\} \| null>\(null\);/,
  'UniversalChat edit state must carry the active transcript scope so it cannot be submitted into a different session after navigation.',
);

assert.match(
  universalChatSource,
  /const beginEditingMessage = useCallback\(\(messageId: string, content: string\) => \{[\s\S]*setEditingMessage\(\{[\s\S]*messageId,[\s\S]*originalContent: content,[\s\S]*previousDraft: inputValueRef\.current,[\s\S]*scopeKey: normalizedTranscriptScopeKey,[\s\S]*\}\);[\s\S]*setInputValue\(content\);[\s\S]*textareaRef\.current\?\.focus\(\);[\s\S]*\}/,
  'UniversalChat edit toolbar must enter composer edit mode with the selected message content and focus the composer.',
);

assert.match(
  universalChatSource,
  /useEffect\(\(\) => \{[\s\S]*if \(!editingMessage \|\| editingMessage\.scopeKey === normalizedTranscriptScopeKey\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setEditingMessage\(null\);[\s\S]*\}, \[editingMessage, normalizedTranscriptScopeKey\]\);/,
  'UniversalChat must cancel stale edit mode when the visible transcript scope changes.',
);

assert.match(
  universalChatSource,
  /const submitEditedMessage = useCallback\(async \(nextContent: string\): Promise<boolean> => \{[\s\S]*await Promise\.resolve\(onEditMessage\(editingMessage\.messageId, nextContent\)\);[\s\S]*setEditingMessage\(null\);[\s\S]*return true;[\s\S]*\}/,
  'UniversalChat edit submission must await the authoritative page handler before clearing edit mode.',
);

assert.match(
  universalChatSource,
  /if \(editingMessage\) \{[\s\S]*if \(isComposerTurnBlocked \|\| isAwaitingQueuedTurnSettlement \|\| messageQueue\.length > 0\) \{[\s\S]*t\('chat\.editMessageWaitForIdle'\)[\s\S]*return;[\s\S]*\}[\s\S]*clearInputValue\(\);[\s\S]*const didSubmitEdit = await submitEditedMessage\(currentInput\);[\s\S]*if \(!didSubmitEdit\) \{[\s\S]*setInputValue\(\(previousInputValue\) =>[\s\S]*resolveComposerInputAfterSendFailure\(currentInput, previousInputValue\)[\s\S]*\);[\s\S]*\}[\s\S]*return;[\s\S]*\}/,
  'UniversalChat handleSend must route edit-mode submissions to editCodingSessionMessage instead of sending or queueing a new turn.',
);

assert.match(
  universalChatSource,
  /editingMessage \? t\('chat\.saveEditedMessage'\) :/,
  'UniversalChat send button affordance must expose save-edit semantics while edit mode is active.',
);

assert.match(
  universalChatSource,
  /environment\.beginEditingMessage\?\.\(msg\.id, msg\.content\)/,
  'Transcript edit buttons must start UniversalChat edit mode with the actual message content.',
);

assert.match(
  codePageSource,
  /editCodingSessionMessage,/,
  'CodePage must consume the project service editCodingSessionMessage API.',
);

assert.match(
  workbenchMessageEditActionHookSource,
  /export function useWorkbenchCodingSessionMessageEditAction\(/,
  'Workbench messaging must expose a shared message edit action hook so Code and Studio cannot drift in edit semantics.',
);

assert.match(
  workbenchMessageEditActionHookSource,
  /editWorkbenchCodingSessionMessage\(\{[\s\S]*codingSessionId,[\s\S]*content,[\s\S]*editCodingSessionMessage,[\s\S]*messageId,[\s\S]*projectId: project\.id,[\s\S]*\}\)/,
  'Shared message edit action must route through editWorkbenchCodingSessionMessage so trimming and empty-content behavior stay standardized.',
);

assert.match(
  workbenchMessageEditActionHookSource,
  /setSelectionRefreshToken\(\(previousState\) => previousState \+ 1\);/,
  'Shared message edit action must refresh the selected transcript after an authoritative edit succeeds.',
);

assert.match(
  workbenchMessageEditActionHookSource,
  /throw new Error\(sessionUnavailableMessage\);/,
  'Shared message edit action must report missing project/session state consistently across surfaces.',
);

assert.match(
  commonsIndexSource,
  /export \* from '\.\/hooks\/useWorkbenchCodingSessionMessageEditAction\.ts';/,
  'Commons must export the shared message edit action hook as part of the public workbench standard.',
);

assert.match(
  codePageSource,
  /const handleEditMessage = useWorkbenchCodingSessionMessageEditAction\(\{[\s\S]*editCodingSessionMessage,[\s\S]*resolveCodingSessionLocation: resolveSession,[\s\S]*sessionUnavailableMessage: t\('chat\.sendMessageSessionUnavailable'\),[\s\S]*setSelectionRefreshToken,[\s\S]*\}\);/,
  'CodePage must reuse the shared workbench message edit action instead of carrying a code-only edit hook.',
);

assert.doesNotMatch(
  codePageSource,
  /useCodeEditMessage/,
  'CodePage must not keep a product-specific edit hook once a shared workbench edit action exists.',
);

assert.doesNotMatch(
  codePageSource,
  /handleEditMessage[\s\S]{0,500}setWorkbenchChatInputDraft/,
  'CodePage must not implement transcript edit by only copying the old message into the draft composer.',
);

assert.match(
  codePageSurfacePropsSource,
  /onEditMessage: NonNullable<UniversalChatComponentProps\['onEditMessage'\]>;/,
  'Code page surface props must keep UniversalChat as the canonical edit handler type source.',
);

assert.match(
  codeEditorWorkspacePanelTypesSource,
  /onEditMessage: \(messageId: string, content: string\) => void \| Promise<void>;/,
  'Editor workspace chat props must forward authoritative edit content through the split IDE boundary.',
);

assert.match(
  studioPageSource,
  /editCodingSessionMessage,/,
  'StudioPage must consume the project service editCodingSessionMessage API.',
);

assert.match(
  studioPageSource,
  /const handleEditMessage = useWorkbenchCodingSessionMessageEditAction\(\{[\s\S]*editCodingSessionMessage,[\s\S]*resolveCodingSessionLocation,[\s\S]*sessionUnavailableMessage: t\('chat\.sendMessageSessionUnavailable'\),[\s\S]*setSelectionRefreshToken,[\s\S]*\}\);/,
  'StudioPage must reuse the shared workbench message edit action instead of inlining edit behavior.',
);

assert.doesNotMatch(
  studioPageSource,
  /const handleEditMessage = useCallback\(async \(codingSessionId: string, messageId: string, content: string\) => \{[\s\S]*editCodingSessionMessage\(/,
  'StudioPage must not inline authoritative edit calls once the shared workbench edit action owns that behavior.',
);

assert.doesNotMatch(
  studioPageSource,
  /handleEditMessage[\s\S]{0,500}setWorkbenchChatInputDraft/,
  'StudioPage must not implement transcript edit by only copying the old message into the draft composer.',
);

assert.match(
  studioChatSidebarSource,
  /onEditMessage: \(messageId: string, content: string\) => void \| Promise<void>;/,
  'StudioChatSidebar props must forward authoritative edit content into UniversalChat.',
);

console.log('universal chat message edit contract passed.');
