import assert from 'node:assert/strict';
import fs from 'node:fs';

import { shouldUseRichChatMarkdown } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chatMarkdownHeuristics.ts';

const universalChatMarkdownSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatMarkdown.tsx', import.meta.url),
  'utf8',
);
const universalChatSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);
const englishChatSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/en/chat.ts', import.meta.url),
  'utf8',
);
const chineseChatSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/zh/chat.ts', import.meta.url),
  'utf8',
);

assert.equal(
  shouldUseRichChatMarkdown('Skill runtime alignment status'),
  false,
  'Plain BirdCoder capability-alignment messages must not enter rich markdown just because they contain the word Skill.',
);

assert.equal(
  shouldUseRichChatMarkdown('Skill Refactor.', 'rich', [{ name: 'Refactor' }]),
  true,
  'Known configured skill mentions must enter rich markdown so UniversalChatMarkdown can render the skill badge.',
);

assert.equal(
  shouldUseRichChatMarkdown('Skill runtime alignment status', 'rich', [{ name: 'Refactor' }]),
  false,
  'Unknown capability-alignment prose must stay plain even when other skills are configured.',
);

assert.match(
  universalChatMarkdownSource,
  /function processContent\(content: string,\s*skills: readonly ChatSkill\[\]/,
  'UniversalChatMarkdown must normalize Skill mentions against the configured skill catalog instead of raw regex text.',
);

assert.match(
  universalChatMarkdownSource,
  /const skillNames = skills[\s\S]*\.filter\(\(name\) => name\.length > 0\)/,
  'Skill mention rendering must be driven by known configured skill names.',
);

assert.doesNotMatch(
  universalChatMarkdownSource,
  /Skill\\s\*\(\[a-zA-Z0-9\\s\]\+\?/,
  'UniversalChatMarkdown must not auto-link arbitrary "Skill <text>" phrases because capability-alignment prose is not always a skill reference.',
);

assert.doesNotMatch(
  universalChatMarkdownSource,
  /Provides specialized capabilities for \$\{skillName\}/,
  'Unknown skill links must not display fabricated capability descriptions.',
);

assert.match(
  universalChatMarkdownSource,
  /unknownSkillDescription\?: string;/,
  'UniversalChatMarkdown must accept a localized neutral fallback for unknown explicit skill links.',
);

assert.match(
  universalChatSource,
  /shouldUseRichChatMarkdown\(content,\s*mode,\s*environmentRef\.current\?\.skills \?\? \[\]\)/,
  'UniversalChat must pass configured skills into the rich markdown gate so known skill mentions can render.',
);

assert.match(
  universalChatSource,
  /unknownSkillDescription=\{environmentRef\.current\?\.t\('chat\.skillDetailsUnavailable'\) \?\? 'Skill details unavailable'\}/,
  'UniversalChat must pass localized neutral copy for unknown skill links into the markdown renderer.',
);

assert.match(
  englishChatSource,
  /skillDetailsUnavailable: 'Skill details unavailable'/,
  'English chat copy must include neutral unknown-skill tooltip text.',
);

assert.match(
  chineseChatSource,
  /skillDetailsUnavailable: '\\u6280\\u80fd\\u8be6\\u60c5\\u6682\\u4e0d\\u53ef\\u7528'/,
  'Chinese chat copy must include neutral unknown-skill tooltip text.',
);

console.log('universal chat capability message display contract passed.');
