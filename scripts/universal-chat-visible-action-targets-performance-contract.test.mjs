import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);

assert.match(
  universalChatSource,
  /function buildVisibleMessageActionTargets\(/,
  'UniversalChat must build message action targets only for the virtualized visible transcript window.',
);

assert.doesNotMatch(
  universalChatSource,
  /buildMessageActionTargets\(renderedMessages\)/,
  'UniversalChat must not build action targets for every progressively rendered message before virtualization.',
);

assert.match(
  universalChatSource,
  /const messageActionTargets = useMemo\(\s*\(\) =>\s*buildVisibleMessageActionTargets\(\s*renderedMessages,\s*visibleStartIndex,\s*visibleMessages\.length,\s*\),\s*\[renderedMessages, visibleMessages\.length, visibleStartIndex\],?\s*\);/s,
  'UniversalChat must derive action targets from renderedMessages plus the virtualized visible range, not from the full progressive window.',
);

const visibleActionTargetBuilder = universalChatSource.match(
  /function buildVisibleMessageActionTargets\([\s\S]*?\n\}/,
)?.[0];
assert.ok(
  visibleActionTargetBuilder,
  'UniversalChat must keep visible action target generation in a dedicated helper.',
);
assert.doesNotMatch(
  visibleActionTargetBuilder,
  /new Array<ChatMessageActionTarget \| null>\(messages\.length\)/,
  'Visible action target generation must not allocate an action target array sized to the full transcript.',
);
assert.doesNotMatch(
  visibleActionTargetBuilder,
  /\bmessageIds\b/,
  'Visible action target generation must not allocate grouped message id arrays during render; delete ids should be resolved on the click path.',
);

assert.match(
  universalChatSource,
  /function resolveMessageActionTargetMessageIds\(/,
  'UniversalChat must resolve grouped delete ids lazily from the current rendered message window.',
);

console.log('universal chat visible action targets performance contract passed.');
