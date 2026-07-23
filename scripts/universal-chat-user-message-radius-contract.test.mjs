import assert from 'node:assert/strict';
import fs from 'node:fs';

const replyMessageRenderersSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/renderers/ReplyMessageRenderers.tsx', import.meta.url),
  'utf8',
);

assert.match(
  replyMessageRenderersSource,
  /max-w-\[85%\] min-w-0 overflow-hidden break-words bg-white\/5 px-4 py-2\.5 text-\[14px\] leading-relaxed text-gray-200 whitespace-pre-wrap \[overflow-wrap:anywhere\] rounded-xl rounded-tr-md/,
  'UniversalChat main sent-message bubble must use a restrained radius so short messages do not render as circles.',
);

assert.match(
  replyMessageRenderersSource,
  /max-w-\[90%\] min-w-0 overflow-hidden break-words bg-white\/5 px-4 py-3 text-gray-200 \[overflow-wrap:anywhere\] rounded-xl rounded-tr-md/,
  'UniversalChat sidebar sent-message bubble must use a restrained radius so short messages do not render as circles.',
);

assert.match(
  replyMessageRenderersSource,
  /if \(isSidebar\) \{\s*return \([\s\S]*?<div className="max-w-\[90%\][^"]*rounded-xl rounded-tr-md">\s*<ContentBlockList view=\{view\} context=\{context\} \/>\s*<\/div>\s*\{context\.showMessageActions \? \(\s*<ChatMessageActionBar/,
  'UniversalChat sidebar sent-message hover actions must render outside the bubble so narrow chat panes do not wrap the toolbar into the message bubble.',
);

assert.doesNotMatch(
  replyMessageRenderersSource,
  /(?:rounded-2xl|rounded-3xl)[^'"]*(?:whitespace-pre-wrap|rounded-tr-sm)/,
  'UniversalChat sent-message bubbles must not use large 2xl/3xl radii that make short messages look circular.',
);

console.log('universal chat user message radius contract passed.');
