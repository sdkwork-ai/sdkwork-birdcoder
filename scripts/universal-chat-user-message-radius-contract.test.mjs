import assert from 'node:assert/strict';
import fs from 'node:fs';

const replyMessageRenderersSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/renderers/ReplyMessageRenderers.tsx', import.meta.url),
  'utf8',
);

assert.match(
  replyMessageRenderersSource,
  /className="[^"]*max-w-\[min\(82%,64ch\)\][^"]*rounded-\[10px\][^"]*px-3 py-2[^"]*"\s*data-chat-user-text="true"/,
  'UniversalChat main sent-message bubble must use the OpenCode-aligned readable width, radius, and compact padding.',
);

assert.match(
  replyMessageRenderersSource,
  /className="[^"]*max-w-\[min\(82%,64ch\)\][^"]*rounded-\[10px\][^"]*px-3 py-2[^"]*"\s*data-chat-user-text="true"/,
  'UniversalChat sidebar sent-message bubble must use the same provider-neutral OpenCode-aligned geometry.',
);

assert.match(
  replyMessageRenderersSource,
  /if \(isSidebar\) \{[\s\S]*?<UserMessageAttachments[\s\S]*?data-chat-user-text="true"[\s\S]*?<ContentBlockList view=\{textView\} context=\{context\} \/>[\s\S]*?\{context\.showMessageActions \? \(/,
  'UniversalChat sidebar sent-message hover actions must render outside the bubble so narrow chat panes do not wrap the toolbar into the message bubble.',
);

assert.match(
  replyMessageRenderersSource,
  /<UserMessageAttachments[\s\S]*?data-chat-user-text="true"/,
  'User attachments must render before the standalone text bubble.',
);

assert.doesNotMatch(
  replyMessageRenderersSource,
  /(?:rounded-2xl|rounded-3xl)[^'"]*(?:whitespace-pre-wrap|rounded-tr-sm)/,
  'UniversalChat sent-message bubbles must not use large 2xl/3xl radii that make short messages look circular.',
);

console.log('universal chat user message radius contract passed.');
