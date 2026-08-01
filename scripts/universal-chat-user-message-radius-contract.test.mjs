import assert from 'node:assert/strict';
import fs from 'node:fs';

const replyMessageRenderersSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/renderers/ReplyMessageRenderers.tsx', import.meta.url),
  'utf8',
);

assert.match(
  replyMessageRenderersSource,
  /className="[^"]*max-w-\[77%\][^"]*rounded-2xl[^"]*bg-white\/\[0\.05\][^"]*px-3 py-2[^"]*"\s*data-chat-user-text="true"\s*data-user-message-bubble="true"/,
  'UniversalChat sent-message bubbles must use the installed Codex width, radius, foreground tint, padding, and DOM marker.',
);

assert.match(
  replyMessageRenderersSource,
  /if \(isSidebar\) \{[\s\S]*?max-w-\[77%\][\s\S]*?data-user-message-bubble="true"/,
  'UniversalChat sidebar sent-message bubble must use the same installed Codex geometry and DOM marker.',
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

assert.match(
  replyMessageRenderersSource,
  /<div className="flex w-full items-center justify-end gap-1">[\s\S]*?<ChatMessageActionBar[\s\S]*?data-user-message-bubble="true"/,
  'UniversalChat main sent-message compact actions and bubble must share the installed Codex horizontal row.',
);

assert.match(
  replyMessageRenderersSource,
  /<h4 className="sr-only select-none">\{userRoleHeading\}<\/h4>/,
  'UniversalChat user messages must expose the same screen-reader-only role heading as Codex.',
);

console.log('universal chat user message radius contract passed.');
