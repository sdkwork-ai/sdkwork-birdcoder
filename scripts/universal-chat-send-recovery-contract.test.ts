import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const universalChatSource = await readFile(
  resolve('packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx'),
  'utf8',
);
const codeEditorWorkspacePanelSource = await readFile(
  resolve('packages/sdkwork-birdcoder-code/src/pages/CodeEditorWorkspacePanel.tsx'),
  'utf8',
);
const codePageSurfacePropsSource = await readFile(
  resolve('packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts'),
  'utf8',
);
const codePageSource = await readFile(
  resolve('packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx'),
  'utf8',
);
const studioChatSidebarSource = await readFile(
  resolve('packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx'),
  'utf8',
);
const studioPageSource = await readFile(
  resolve('packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx'),
  'utf8',
);
const useProjectsSource = await readFile(
  resolve('packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts'),
  'utf8',
);
const workspaceChatTypesSource = await readFile(
  resolve('packages/sdkwork-birdcoder-code/src/pages/codeEditorWorkspacePanel.types.ts'),
  'utf8',
);

assert.match(
  universalChatSource,
  /sessionId\?: string;/,
  'UniversalChat props must expose the active session identifier through the canonical sessionId field.',
);

assert.doesNotMatch(
  universalChatSource,
  /\bchatId\?: string;/,
  'UniversalChat props must not retain the legacy chatId field once session-domain standardization is complete.',
);

assert.match(
  universalChatSource,
  /onSendMessage: \(text\?: string\) => void \| Promise<void>;/,
  'UniversalChat must treat message dispatch as an async-capable operation so send failures can be awaited and recovered in the composer.',
);

assert.match(
  workspaceChatTypesSource,
  /onSendMessage: \(text\?: string\) => void \| Promise<void>;/,
  'Workspace chat props must preserve the optional text override while supporting async send handlers.',
);

assert.match(
  universalChatSource,
  /await Promise\.resolve\(onSendMessage\(fullText\)\);/,
  'UniversalChat must await the provided send handler before treating a message submission as committed.',
);

assert.match(
  universalChatSource,
  /setInputValue\(\(previousInputValue\) =>\s*resolveComposerInputAfterSendFailure\(/,
  'UniversalChat must restore the composer draft when async message dispatch fails.',
);

assert.match(
  universalChatSource,
  /setMessageQueue\(\(previousQueue\) =>\s*restoreQueuedMessagesAfterSendFailure\(/,
  'UniversalChat must restore queued follow-up messages when async dispatch fails.',
);

assert.match(
  universalChatSource,
  /const persistSubmittedPromptHistory = useCallback\([\s\S]*saveSessionPromptHistoryEntry\(submittedText(?:,\s*normalizedSessionId)?\)/,
  'UniversalChat must route prompt-history persistence through the canonical session prompt-history helper so it can be sequenced after successful sends and scoped to the active session.',
);

assert.match(
  universalChatSource,
  /try \{\s*await Promise\.resolve\(onSendMessage\(fullText\)\);[\s\S]*\}\s*catch \(error\) \{[\s\S]*setInputValue\(\(previousInputValue\) =>\s*resolveComposerInputAfterSendFailure\(/,
  'UniversalChat must treat send failures as a dedicated recovery path that restores the composer state.',
);

assert.match(
  universalChatSource,
  /try \{\s*await persistSubmittedPromptHistory\(fullText\);\s*\}\s*catch \(error\) \{\s*console\.error\('Failed to persist prompt history after successful send', error\);/s,
  'Prompt-history persistence failures must not be mistaken for send failures once the message is already committed.',
);

assert.match(
  universalChatSource,
  /await Promise\.resolve\(onSendMessage\(fullText\)\);[\s\S]*try \{\s*await persistSubmittedPromptHistory\(fullText\);/s,
  'Prompt history must only be persisted after the message dispatch succeeds.',
);

assert.match(
  universalChatSource,
  /hydratedSessionPromptHistoryIdRef\.current = normalizedSessionId;[\s\S]*sessionChatInputHistoryRef\.current = \[\];[\s\S]*setHistoryIndex\([\s\S]*-1[\s\S]*setTempInput\([\s\S]*''[\s\S]*syncHistoryPrompts\(\[\]\);/s,
  'UniversalChat must clear the in-memory prompt-history navigation state before hydrating a different session so prompt recall cannot leak across sessions.',
);

assert.match(
  universalChatSource,
  /function resolveVisibleSessionMessages\([\s\S]*message\.codingSessionId\?\.trim\(\)[\s\S]*normalizedSessionId[\s\S]*return filteredMessages \?\? messages;/s,
  'UniversalChat must defensively filter explicit wrong-session transcript entries while preserving the original messages reference when the collection is already clean.',
);

assert.doesNotMatch(
  universalChatSource,
  /!messageSessionId\s*\|\|\s*messageSessionId === normalizedSessionId/,
  'UniversalChat must not render blank-scope messages inside a selected session because they can hide upstream session leakage.',
);

assert.match(
  universalChatSource,
  /const normalizedMessages = useMemo\(\s*\(\) => resolveVisibleSessionMessages\(messages, normalizedSessionId\),\s*\[messages, normalizedSessionId\],\s*\);/s,
  'UniversalChat must derive the visible transcript from the active session id so mixed upstream message payloads cannot render in the selected session.',
);

assert.match(
  universalChatSource,
  /else if \(e\.key === 'ArrowUp'\) \{[\s\S]*if \([\s\S]*normalizedSessionId[\s\S]*textareaRef\.current[\s\S]*textareaRef\.current\.selectionStart === 0[\s\S]*\) \{[\s\S]*setHistoryIndex\(nextIndex\);[\s\S]*setInputValue\(sessionChatInputHistoryRef\.current\[nextIndex\]\);/s,
  'Arrow-up recall must stay session-aware and only step through prompt history when the composer cursor is at the start boundary.',
);

assert.match(
  universalChatSource,
  /else if \(e\.key === 'ArrowDown'\) \{[\s\S]*if \([\s\S]*normalizedSessionId[\s\S]*textareaRef\.current[\s\S]*textareaRef\.current\.selectionEnd === inputValue\.length[\s\S]*\) \{[\s\S]*setHistoryIndex\(-1\);[\s\S]*setInputValue\(tempInput\);/s,
  'Arrow-down recall must restore the pre-navigation draft only for the active session when the cursor is at the end boundary.',
);

assert.match(
  codeEditorWorkspacePanelSource,
  /<UniversalChat[\s\S]*sessionId=\{selectedCodingSessionId \|\| undefined\}/,
  'Code editor workspace chat must pass the selected coding session through the canonical sessionId prop.',
);

assert.match(
  codePageSurfacePropsSource,
  /sessionId: activeTab === 'ai' \? \(sessionId \|\| undefined\) : undefined,/,
  'Code main chat props must carry the selected coding session through sessionId instead of the legacy chatId alias.',
);

assert.match(
  studioChatSidebarSource,
  /<UniversalChat[\s\S]*sessionId=\{selectedCodingSessionId \|\| undefined\}/,
  'Studio chat sidebar must pass the selected coding session through the canonical sessionId prop.',
);

assert.match(
  universalChatSource,
  /setIsDispatchingMessage\(true\);[\s\S]*finally \{[\s\S]*setIsDispatchingMessage\(false\);[\s\S]*\}/s,
  'UniversalChat must always clear the dispatching flag after a send attempt so failed sends do not leave the composer stuck in a busy state.',
);

assert.match(
  universalChatSource,
  /const isDispatchingMessageRef = useRef\(false\);/,
  'UniversalChat must keep a synchronous dispatch guard so duplicate Enter/click events cannot submit the same draft before React busy state renders.',
);

assert.match(
  universalChatSource,
  /if \(isDispatchingMessageRef\.current\) \{\s*return;\s*\}[\s\S]*isDispatchingMessageRef\.current = true;[\s\S]*setIsDispatchingMessage\(true\);[\s\S]*finally \{\s*isDispatchingMessageRef\.current = false;\s*setIsDispatchingMessage\(false\);/s,
  'UniversalChat send handling must acquire and release the synchronous dispatch guard around the awaited send operation.',
);

assert.match(
  codePageSource,
  /const sentMessage = await sendMessage\([\s\S]*bootstrappedSession\.codingSessionId[\s\S]*\);[\s\S]*sentMessage\?\.codingSessionId[\s\S]*!== bootstrappedSession\.codingSessionId[\s\S]*selectSession\(sentMessage\.codingSessionId,\s*\{\s*projectId: bootstrappedSession\.projectId\s*\}\);/s,
  'CodePage must switch selection to a recovered authoritative session id when send recovery remaps a stale local session.',
);

assert.match(
  studioPageSource,
  /const sentMessage = await sendMessage\([\s\S]*bootstrappedSession\.codingSessionId[\s\S]*\);[\s\S]*sentMessage\?\.codingSessionId[\s\S]*!== bootstrappedSession\.codingSessionId[\s\S]*selectCodingSession\(sentMessage\.codingSessionId,\s*\{\s*projectId: bootstrappedSession\.projectId\s*\}\);/s,
  'StudioPage must switch selection to a recovered authoritative session id when send recovery remaps a stale local session.',
);

assert.match(
  useProjectsSource,
  /if \(previousCodingSession && projectService\.upsertCodingSession\) \{[\s\S]*await projectService\.upsertCodingSession\(projectId, previousCodingSession\);[\s\S]*const newMessage = await projectService\.addCodingSessionMessage\(projectId, codingSessionId,/s,
  'sendMessage must repair the project-service session mirror from the selected store session before creating the core turn so stale mirror misses do not surface as delayed coding-session-not-found toasts.',
);

console.log('universal chat send recovery contract passed.');
