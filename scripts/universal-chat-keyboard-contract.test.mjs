import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const universalChatSource = await readFile(
  resolve(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
  ),
  'utf8',
);

assert.match(
  universalChatSource,
  /useBirdcoderAppSettings,[\s\S]*const \{ settings: appSettings \} = useBirdcoderAppSettings\(\);/,
  'UniversalChat must consume the canonical app setting that controls composer submission.',
);

assert.match(
  universalChatSource,
  /const composerCompositionRef = useRef\(false\);[\s\S]*const handleComposerCompositionStart = \(\) => \{\s*composerCompositionRef\.current = true;\s*\};[\s\S]*const handleComposerCompositionEnd = \(\) => \{\s*composerCompositionRef\.current = false;\s*\};/,
  'UniversalChat must track the full IME composition lifecycle instead of relying on one key event.',
);

const keyboardHandlerMatch = universalChatSource.match(
  /const handleKeyDown = \(e: React\.KeyboardEvent<HTMLTextAreaElement>\) => \{([\s\S]*?)\n  \};\n\n  const hasTypedComposerInput/,
);
assert.ok(keyboardHandlerMatch, 'UniversalChat must expose a typed textarea keyboard handler.');

const keyboardHandlerSource = keyboardHandlerMatch[1];
const tabBranchMatch = keyboardHandlerSource.match(
  /if \(e\.key === 'Tab'\) \{([\s\S]*?)\n    \}/,
);
assert.ok(tabBranchMatch, 'UniversalChat must explicitly preserve native Tab focus navigation.');
assert.doesNotMatch(
  tabBranchMatch[1],
  /preventDefault|handleSend/,
  'Tab must not be prevented or treated as a message submission shortcut.',
);

assert.match(
  keyboardHandlerSource,
  /if \(e\.key === 'Enter'\) \{[\s\S]*e\.shiftKey \|\|[\s\S]*e\.nativeEvent\.isComposing \|\|[\s\S]*e\.nativeEvent\.keyCode === 229 \|\|[\s\S]*composerCompositionRef\.current[\s\S]*return;/,
  'Enter must remain a newline during Shift+Enter and must never submit during IME composition.',
);

assert.match(
  keyboardHandlerSource,
  /const hasSubmitModifier = \(e\.ctrlKey \|\| e\.metaKey\) && !e\.altKey;\s*if \(appSettings\.requireCtrlEnter && !hasSubmitModifier\) \{\s*return;\s*\}[\s\S]*e\.preventDefault\(\);\s*void handleSend\(\);/,
  'The requireCtrlEnter setting must require a Ctrl/Meta+Enter submission without hijacking Alt shortcuts.',
);

assert.match(
  universalChatSource,
  /onCompositionStart=\{handleComposerCompositionStart\}[\s\S]*onCompositionEnd=\{handleComposerCompositionEnd\}[\s\S]*onKeyDown=\{handleKeyDown\}/,
  'The chat textarea must wire composition state before routing keyboard submission events.',
);

console.log('universal chat keyboard contract passed.');
