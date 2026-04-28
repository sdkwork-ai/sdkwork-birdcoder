import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);

assert.match(
  universalChatSource,
  /max-w-\[85%\] bg-white\/5 text-gray-200 px-4 py-2\.5 rounded-xl rounded-tr-md text-\[14px\] whitespace-pre-wrap leading-relaxed/,
  'UniversalChat main sent-message bubble must use a restrained radius so short messages do not render as circles.',
);

assert.match(
  universalChatSource,
  /max-w-\[90%\] bg-white\/5 text-gray-200 rounded-xl rounded-tr-md px-4 py-3/,
  'UniversalChat sidebar sent-message bubble must use a restrained radius so short messages do not render as circles.',
);

assert.match(
  universalChatSource,
  /if \(msg\.role === 'user'\) \{\s*return \([\s\S]*?<div className="max-w-\[90%\] bg-white\/5 text-gray-200 rounded-xl rounded-tr-md px-4 py-3">\s*<div className="prose[\s\S]*?\{renderMarkdownContent\(msg\.content\)\}\s*<\/div>\s*<\/div>\s*\{showMessageActions && \(\s*<div className="mt-1\.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1">/,
  'UniversalChat sidebar sent-message hover actions must render outside the bubble so narrow chat panes do not wrap the toolbar into the message bubble.',
);

assert.doesNotMatch(
  universalChatSource,
  /(?:rounded-2xl|rounded-3xl)[^'"]*(?:whitespace-pre-wrap|rounded-tr-sm)/,
  'UniversalChat sent-message bubbles must not use large 2xl/3xl radii that make short messages look circular.',
);

console.log('universal chat user message radius contract passed.');
