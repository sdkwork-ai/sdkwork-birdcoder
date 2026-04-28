import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const universalChatSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'UniversalChat.tsx',
);
const codePageSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const codePageSurfacePropsSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'useCodePageSurfaceProps.ts',
);
const codeEditorWorkspacePanelSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodeEditorWorkspacePanel.tsx',
);
const codeEditorWorkspacePanelTypesSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'codeEditorWorkspacePanel.types.ts',
);
const codeEditorWorkspacePanelEqualitySource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'codeEditorWorkspacePanelEquality.ts',
);
const studioPageSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);
const studioChatSidebarSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioChatSidebar.tsx',
);

assert.match(
  universalChatSource,
  /isEngineBusy\?: boolean;/,
  'UniversalChat must expose a separate engine-busy input so loading spinners are not driven by awaiting approval/user states.',
);

assert.match(
  universalChatSource,
  /isEngineBusy = isBusy,/,
  'UniversalChat should default engine-busy rendering to the existing busy state for direct callers while page surfaces pass the stricter signal.',
);

assert.match(
  universalChatSource,
  /const isComposerTurnBlocked = isBusy \|\| isDispatchingMessage \|\| isSubmittingPendingInteraction;/,
  'UniversalChat must keep turn-blocking semantics separate from visual processing state so awaiting interactions still queue follow-up prompts.',
);

assert.match(
  universalChatSource,
  /const isComposerProcessing = isEngineBusy \|\| isDispatchingMessage \|\| isSubmittingPendingInteraction;/,
  'UniversalChat must show spinner/generating treatment only for engine-busy or local submission work.',
);

assert.match(
  universalChatSource,
  /if \(isComposerTurnBlocked \|\| isAwaitingQueuedTurnSettlement\) \{/,
  'UniversalChat queued-message dispatch must continue to block behind active turns even when the engine is awaiting approval or user input.',
);

assert.match(
  universalChatSource,
  /isComposerProcessing && !editingMessage && !canQueueTypedMessage && !canSubmitPendingUserQuestionAnswer/s,
  'UniversalChat send button must not show a spinner for pure awaiting approval/user states with no active engine work.',
);

assert.doesNotMatch(
  universalChatSource,
  /isComposerBusy && !canQueueTypedMessage && !canSubmitPendingUserQuestionAnswer/s,
  'UniversalChat must not drive the idle send-button spinner from the broader turn-blocked state.',
);

assert.match(
  codePageSource,
  /const isSelectedSessionTurnActive = isBirdCoderCodingSessionExecuting\(session\);/,
  'CodePage should name the broader executing helper as turn-active instead of treating it as engine-busy UI state.',
);

assert.match(
  codePageSource,
  /const isChatBusy = isSubmittingTurn \|\| isSelectedSessionTurnActive \|\| isNewCodingSessionCreating;/,
  'CodePage must keep isChatBusy as the turn-blocking signal so queued follow-up prompts still wait behind pending interactions.',
);

assert.match(
  codePageSource,
  /const isChatEngineBusy = isSubmittingTurn \|\| isSelectedSessionEngineBusy \|\| isNewCodingSessionCreating;/,
  'CodePage must derive a strict engine-busy signal for spinner rendering.',
);

assert.match(
  codePageSource,
  /isChatEngineBusy,\s*[\s\S]*isSelectedSessionEngineBusy,/,
  'CodePage must pass both strict engine-busy and selected-session engine-busy signals into the surface props bundle.',
);

assert.match(
  codePageSurfacePropsSource,
  /isChatEngineBusy: boolean;/,
  'Code page surface props must carry the strict engine-busy signal separately from the turn-blocking busy signal.',
);

assert.match(
  codePageSurfacePropsSource,
  /isEngineBusy: isChatEngineBusy,/,
  'Code page UniversalChat props must receive strict engine-busy state for spinner rendering.',
);

assert.match(
  codeEditorWorkspacePanelTypesSource,
  /isEngineBusy: boolean;/,
  'Code editor workspace chat props must carry strict engine-busy state through the editor panel boundary.',
);

assert.match(
  codeEditorWorkspacePanelSource,
  /isEngineBusy=\{isEngineBusy\}/,
  'Code editor workspace chat must pass strict engine-busy state to UniversalChat.',
);

assert.match(
  codeEditorWorkspacePanelEqualitySource,
  /left\.isEngineBusy === right\.isEngineBusy/,
  'Code editor workspace panel memoization must include strict engine-busy changes so spinner state updates without unrelated rerenders.',
);

assert.match(
  studioPageSource,
  /isBirdCoderCodingSessionEngineBusy,/,
  'StudioPage must import the strict engine-busy helper.',
);

assert.match(
  studioPageSource,
  /const isSelectedSessionTurnActive = isBirdCoderCodingSessionExecuting\(selectedSession\);/,
  'StudioPage should name the broader executing helper as turn-active instead of treating it as engine-busy UI state.',
);

assert.match(
  studioPageSource,
  /const isChatBusy = isSubmittingTurn \|\| isSelectedSessionTurnActive;/,
  'StudioPage must keep isChatBusy as the turn-blocking signal for queue semantics.',
);

assert.match(
  studioPageSource,
  /const isChatEngineBusy = isSubmittingTurn \|\| isSelectedSessionEngineBusy;/,
  'StudioPage must derive strict engine-busy state for visual loading treatment.',
);

assert.match(
  studioPageSource,
  /isEngineBusy=\{isChatEngineBusy\}/,
  'StudioPage must pass strict engine-busy state into StudioChatSidebar.',
);

assert.match(
  studioChatSidebarSource,
  /isEngineBusy: boolean;/,
  'StudioChatSidebar props must distinguish strict engine-busy rendering from turn-blocked queue semantics.',
);

assert.match(
  studioChatSidebarSource,
  /isEngineBusy=\{isEngineBusy\}/,
  'StudioChatSidebar must pass strict engine-busy state to UniversalChat.',
);

console.log('chat turn busy state contract passed.');
