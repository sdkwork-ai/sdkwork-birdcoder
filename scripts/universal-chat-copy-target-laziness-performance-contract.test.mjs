import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);

const messageTypesSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/types.ts', import.meta.url),
  'utf8',
);

const messageActionsSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/messageActions.ts', import.meta.url),
  'utf8',
);

const actionTargetInterface = messageTypesSource.match(
  /interface ChatMessageActionTarget \{[\s\S]*?\n\}/,
)?.[0];
assert.ok(
  actionTargetInterface,
  'Chat transcript message types must define an explicit ChatMessageActionTarget shape.',
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

const actionTargetBuilder = messageActionsSource.match(
  /function buildVisibleMessageActionTargets\([\s\S]*?\n\}/,
)?.[0];
assert.ok(
  actionTargetBuilder,
  'Chat transcript message actions must keep visible grouped message action target generation in a dedicated helper.',
);
assert.doesNotMatch(
  actionTargetBuilder,
  /\bcopyText\b/,
  'buildVisibleMessageActionTargets must not allocate copy strings while rendering the transcript; it should only collect index and id metadata.',
);

assert.match(
  messageActionsSource,
  /function resolveMessageActionTargetCopyText\(/,
  'Chat transcript copy actions must resolve grouped copy text through an explicit lazy helper called only from copy actions.',
);

assert.match(
  messageActionsSource,
  /resolveMessageCopyContent\(message\)/,
  'Lazy copy resolution must use pc-types message copy projection instead of raw message.content for assistant replies.',
);

const eagerCopyHandlerPattern = /copyMessageToClipboard\(actionTarget\?\.copyText \?\? msg\.content\)/;
assert.doesNotMatch(
  universalChatSource,
  eagerCopyHandlerPattern,
  'Copy buttons must call the lazy resolver instead of reading precomputed actionTarget.copyText.',
);

console.log('universal chat copy target laziness performance contract passed.');
