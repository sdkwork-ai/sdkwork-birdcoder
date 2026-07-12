import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveSafeMarkdownHref } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/markdownLinkSecurity.ts';

const contentMarkdownPreviewSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/ContentMarkdownPreview.tsx', import.meta.url),
  'utf8',
);
const universalChatMarkdownSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatMarkdown.tsx', import.meta.url),
  'utf8',
);

assert.equal(resolveSafeMarkdownHref('https://sdkwork.com/docs'), 'https://sdkwork.com/docs');
assert.equal(resolveSafeMarkdownHref('http://localhost:3000'), 'http://localhost:3000');
assert.equal(resolveSafeMarkdownHref('mailto:support@sdkwork.com'), 'mailto:support@sdkwork.com');
assert.equal(resolveSafeMarkdownHref('/docs/readme.md'), '/docs/readme.md');
assert.equal(resolveSafeMarkdownHref('#section'), '#section');
assert.equal(resolveSafeMarkdownHref('//evil.example/phish'), null);
assert.equal(resolveSafeMarkdownHref('skill://Refactor', { allowSkillLinks: true }), 'skill://Refactor');
assert.equal(resolveSafeMarkdownHref('Skill://Refactor', { allowSkillLinks: true }), 'skill://Refactor');
assert.equal(resolveSafeMarkdownHref('skill://%E0%A4%A', { allowSkillLinks: true }), null);
assert.equal(resolveSafeMarkdownHref('skill://', { allowSkillLinks: true }), null);
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
assert.match(
  universalChatMarkdownSource,
  /safeHref\.startsWith\('skill:\/\/'\)/,
  'UniversalChatMarkdown must consume canonical lowercase internal skill links after URL validation.',
);
assert.match(
  universalChatMarkdownSource,
  /function decodeSkillHrefName\(/,
  'UniversalChatMarkdown must defensively decode internal skill link names instead of letting malformed URI components crash rendering.',
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

console.log('markdown link security contract passed.');
