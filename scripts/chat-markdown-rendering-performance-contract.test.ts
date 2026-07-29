import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CHAT_RICH_MARKDOWN_MAX_CHARACTERS,
  shouldUseRichChatMarkdown,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chatMarkdownHeuristics.ts';

const heuristicSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chatMarkdownHeuristics.ts', import.meta.url),
  'utf8',
);
const universalChatSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);
const universalChatMarkdownSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatMarkdown.tsx', import.meta.url),
  'utf8',
);
const chatTranscriptMessageSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/ChatTranscriptMessage.tsx', import.meta.url),
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
  /if \(!shouldUseRichChatMarkdown\(content,\s*mode,\s*messageEnvironment\?\.skills \?\? \[\]\)\) \{[\s\S]*<PlainMessageContent content=\{content\} \/>[\s\S]*\}/,
  'UniversalChat must keep the markdown heuristic as the gate before lazy-loading ReactMarkdown while passing configured skills for known skill mentions.',
);

assert.match(
  universalChatMarkdownSource,
  /const safeLinkComponents = useMemo\(\(\) => \(\{[\s\S]*\}\), \[[\s\S]*onOpenFile,[\s\S]*onOpenUrl,[\s\S]*skills,[\s\S]*unknownSkillDescription,[\s\S]*\]\);/s,
  'UniversalChatMarkdown must memoize link and table renderers so token updates do not rebuild the ReactMarkdown component map.',
);
assert.match(
  universalChatMarkdownSource,
  /const basicMarkdownComponents = useMemo\([\s\S]*\[safeLinkComponents\]\);[\s\S]*const richMarkdownComponents = useMemo\([\s\S]*\[safeLinkComponents\]\);/s,
  'UniversalChatMarkdown must reuse stable basic and rich renderer maps between content updates.',
);
assert.match(
  chatTranscriptMessageSource,
  /context\.renderMarkdownContent\(content, 'basic'\)[\s\S]*context\.turn\.isActiveTail[\s\S]*\? renderStreamingMarkdownContent[\s\S]*: context\.renderMarkdownContent/s,
  'Only the active streaming tail should use basic Markdown so token delivery cannot repeatedly rebuild rich code and diagram renderers.',
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
