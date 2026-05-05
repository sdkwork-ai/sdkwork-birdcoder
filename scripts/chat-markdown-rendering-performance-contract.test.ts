import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CHAT_RICH_MARKDOWN_MAX_CHARACTERS,
  shouldUseRichChatMarkdown,
} from '../packages/sdkwork-birdcoder-ui/src/components/chatMarkdownHeuristics.ts';

const heuristicSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/chatMarkdownHeuristics.ts', import.meta.url),
  'utf8',
);
const universalChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);

assert.match(
  heuristicSource,
  /export const CHAT_RICH_MARKDOWN_MAX_CHARACTERS = \d+;/,
  'Chat markdown heuristics must define a hard rich-render character budget.',
);

assert.match(
  heuristicSource,
  /if \(normalizedContent\.length > CHAT_RICH_MARKDOWN_MAX_CHARACTERS\) \{[\s\S]*return false;[\s\S]*\}/,
  'Chat markdown heuristics must refuse rich rendering for oversized messages before expensive markdown regex scans and ReactMarkdown parsing.',
);

assert.match(
  universalChatSource,
  /if \(!shouldUseRichChatMarkdown\(content, mode\)\) \{[\s\S]*<PlainMessageContent content=\{content\} \/>[\s\S]*\}/,
  'UniversalChat must keep the markdown heuristic as the gate before lazy-loading ReactMarkdown.',
);

assert.equal(
  shouldUseRichChatMarkdown('Short **markdown** content.'),
  true,
  'Short markdown should still use rich rendering.',
);

assert.equal(
  shouldUseRichChatMarkdown('plain log line '.repeat(2000)),
  false,
  'Large plain logs should not trigger rich markdown rendering.',
);

assert.equal(
  shouldUseRichChatMarkdown(`${'x'.repeat(CHAT_RICH_MARKDOWN_MAX_CHARACTERS + 1)}\n\n\`\`\`ts\nconsole.log(1)\n\`\`\``),
  false,
  'Oversized messages must not enter ReactMarkdown or syntax-highlighting even when they contain markdown tokens.',
);

console.log('chat markdown rendering performance contract passed.');
