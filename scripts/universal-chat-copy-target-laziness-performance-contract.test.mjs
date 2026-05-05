import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);

const actionTargetInterface = universalChatSource.match(
  /interface ChatMessageActionTarget \{[\s\S]*?\n\}/,
)?.[0];
assert.ok(
  actionTargetInterface,
  'UniversalChat must define an explicit ChatMessageActionTarget shape.',
);
assert.doesNotMatch(
  actionTargetInterface,
  /\bcopyText\s*:/,
  'ChatMessageActionTarget must not store eager copyText strings because grouped assistant/tool replies can be very large and copy is a rare click path.',
);
assert.match(
  actionTargetInterface,
  /\bstartIndex\s*:\s*number;/,
  'ChatMessageActionTarget must keep a start index so copy text can be resolved lazily from the current rendered message window.',
);

const actionTargetBuilder = universalChatSource.match(
  /function buildVisibleMessageActionTargets\([\s\S]*?\n\}/,
)?.[0];
assert.ok(
  actionTargetBuilder,
  'UniversalChat must keep visible grouped message action target generation in a dedicated helper.',
);
assert.doesNotMatch(
  actionTargetBuilder,
  /\bcopyText\b/,
  'buildMessageActionTargets must not allocate copy strings while rendering the transcript; it should only collect index and id metadata.',
);
assert.doesNotMatch(
  actionTargetBuilder,
  /\$\{copyText\}\\n\\n\$\{content\}/,
  'UniversalChat must not concatenate grouped reply content during action target construction.',
);

assert.match(
  universalChatSource,
  /function resolveMessageActionTargetCopyText\(/,
  'UniversalChat must resolve grouped copy text through an explicit lazy helper called only from copy actions.',
);

const eagerCopyHandlerPattern = /copyMessageToClipboard\(actionTarget\?\.copyText \?\? msg\.content\)/;
assert.doesNotMatch(
  universalChatSource,
  eagerCopyHandlerPattern,
  'Copy buttons must call the lazy resolver instead of reading precomputed actionTarget.copyText.',
);

console.log('universal chat copy target laziness performance contract passed.');
