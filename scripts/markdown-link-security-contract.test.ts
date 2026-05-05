import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveSafeMarkdownHref } from '../packages/sdkwork-birdcoder-ui/src/components/markdownLinkSecurity.ts';

const contentMarkdownPreviewSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/ContentMarkdownPreview.tsx', import.meta.url),
  'utf8',
);
const universalChatMarkdownSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChatMarkdown.tsx', import.meta.url),
  'utf8',
);
const skillsPageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-skills/src/SkillsPage.tsx', import.meta.url),
  'utf8',
);

assert.equal(resolveSafeMarkdownHref('https://sdkwork.com/docs'), 'https://sdkwork.com/docs');
assert.equal(resolveSafeMarkdownHref('http://localhost:3000'), 'http://localhost:3000');
assert.equal(resolveSafeMarkdownHref('mailto:support@sdkwork.com'), 'mailto:support@sdkwork.com');
assert.equal(resolveSafeMarkdownHref('/docs/readme.md'), '/docs/readme.md');
assert.equal(resolveSafeMarkdownHref('#section'), '#section');
assert.equal(resolveSafeMarkdownHref('skill://Refactor', { allowSkillLinks: true }), 'skill://Refactor');
assert.equal(resolveSafeMarkdownHref('skill://Refactor'), null);
assert.equal(resolveSafeMarkdownHref('javascript:alert(1)'), null);
assert.equal(resolveSafeMarkdownHref('JaVaScRiPt:alert(1)'), null);
assert.equal(resolveSafeMarkdownHref('data:text/html,<script>alert(1)</script>'), null);
assert.equal(resolveSafeMarkdownHref('vbscript:msgbox(1)'), null);

assert.match(
  contentMarkdownPreviewSource,
  /resolveSafeMarkdownHref\((?:props\.href|href)\)/,
  'ContentMarkdownPreview must explicitly filter markdown link hrefs before rendering anchors.',
);
assert.match(
  universalChatMarkdownSource,
  /resolveSafeMarkdownHref\(props\.href,\s*\{\s*allowSkillLinks: true,\s*\}\)/,
  'UniversalChatMarkdown must explicitly filter markdown link hrefs while preserving internal skill links.',
);
assert.doesNotMatch(
  universalChatMarkdownSource,
  /<ReactMarkdown>\s*\{\s*content\s*\}\s*<\/ReactMarkdown>/,
  'UniversalChatMarkdown basic mode must not bypass the shared safe markdown link renderer.',
);
assert.doesNotMatch(
  contentMarkdownPreviewSource,
  /<a\s*\{\.\.\.props\}/,
  'ContentMarkdownPreview must not blindly spread markdown link props into an anchor before URL validation.',
);
assert.doesNotMatch(
  universalChatMarkdownSource,
  /<a\s*\{\.\.\.props\}/,
  'UniversalChatMarkdown must not blindly spread markdown link props into an anchor before URL validation.',
);
assert.match(
  skillsPageSource,
  /resolveSafeMarkdownHref\(href\)/,
  'SkillsPage must explicitly filter catalog README markdown links before rendering anchors.',
);
assert.doesNotMatch(
  skillsPageSource,
  /<ReactMarkdown>\s*\{\s*selectedSkill\.readme\s*\}\s*<\/ReactMarkdown>/,
  'SkillsPage must not render catalog README markdown through a bare ReactMarkdown instance.',
);

console.log('markdown link security contract passed.');
