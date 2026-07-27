import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const universalChatSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
);
const newSessionProviderSelectorSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatNewSessionProviderSelector.tsx',
);
const codePageSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
);
const surfacePropsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSurfaceProps.ts',
);

assert.match(
  universalChatSource,
  /isNewSession\?: boolean;/,
  'UniversalChat must accept an explicit new-session state instead of inferring it from a temporarily empty transcript.',
);

assert.match(
  universalChatSource,
  /isNewSession && normalizedMessages\.length === 0 && layout === 'main'/,
  'The centered new-session composer must only render for an empty main conversation.',
);

assert.match(
  universalChatSource,
  /textarea\.focus\(\{ preventScroll: true \}\)/,
  'A new session must focus its composer without scrolling the workbench.',
);

assert.match(
  universalChatSource,
  /focusedNewSessionScopeRef\.current === focusScopeKey/,
  'New-session focus must be scoped so normal user focus changes are not repeatedly stolen.',
);

assert.match(
  universalChatSource,
  /data-new-session-context="true"/,
  'The project and runtime context must have a dedicated new-session-only render boundary.',
);

assert.match(
  universalChatSource,
  /<UniversalChatNewSessionProviderSelector[\s\S]*options=\{newSessionProviderOptions\}[\s\S]*selectedEngineId=\{resolvedSelectedEngineId\}[\s\S]*onSelectProvider=\{handleNewSessionProviderSelect\}/,
  'The centered new-session composer must place its provider selector beside the new-session context.',
);

assert.match(
  universalChatSource,
  /const handleNewSessionProviderSelect = useCallback\(\(engineId: string\) => \{[\s\S]*resolveWorkbenchCodeEngineSelectedModelId\([\s\S]*applyComposerSelection\(engineId, modelId\)/,
  'Changing the new-session provider must also resolve and apply the model owned by that provider.',
);

assert.match(
  universalChatSource,
  /onSendMessage\(fullText, currentComposerSelection\)/,
  'The first submitted turn must carry the provider-scoped composer selection into Session creation.',
);

assert.match(
  newSessionProviderSelectorSource,
  /data-testid="universal-chat-new-session-provider-selector"/,
  'The new-session provider selector must expose a stable browser-test boundary.',
);

assert.match(
  newSessionProviderSelectorSource,
  /data-variant="flat"/,
  'The new-session provider selector must use the flat composer-control variant.',
);

assert.doesNotMatch(
  newSessionProviderSelectorSource,
  /\bborder(?:-\S+)?\b/u,
  'The flat new-session provider selector and its menu must remain borderless.',
);

assert.doesNotMatch(
  newSessionProviderSelectorSource,
  /t\('chat\.newSessionProvider'\)/u,
  'The flat provider trigger must not render a redundant Provider prefix.',
);

assert.match(
  newSessionProviderSelectorSource,
  /role="menuitemradio"/,
  'Provider choices must expose single-selection menu semantics.',
);

assert.match(
  codePageSource,
  /!isSelectedAgentSessionHydrating && selectedAgentSessionItems\.length === 0/,
  'The Code surface must distinguish a ready empty session from transcript hydration.',
);

assert.match(
  surfacePropsSource,
  /newSessionContext: createElement\(CodeNewSessionContext/,
  'The Code surface must provide project, runtime, and Git context above the new-session composer.',
);

console.log('universal chat new-session composer contract passed.');
