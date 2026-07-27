import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const markdownSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatMarkdown.tsx',
);
const mermaidSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatMermaid.tsx',
);
const vitePluginSource = readText('scripts/create-birdcoder-vite-plugins.mjs');
const webViteConfigSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts',
);

assert.match(
  markdownSource,
  /import\(['"]\.\/UniversalChatMermaid['"]\)/u,
  'Markdown rendering must lazy-load the isolated Mermaid renderer.',
);
assert.match(
  markdownSource,
  /language\.trim\(\)\.toLowerCase\(\) === ['"]mermaid['"]/u,
  'Mermaid code fences must route to the diagram renderer.',
);
assert.match(
  markdownSource,
  /<UniversalChatMermaid source=/u,
  'Mermaid code fences must pass their source to UniversalChatMermaid.',
);
assert.match(mermaidSource, /from ['"]mermaid['"]/u, 'The renderer must use the Mermaid runtime.');
assert.match(mermaidSource, /securityLevel: ['"]strict['"]/u, 'Mermaid must use strict security.');
assert.match(
  mermaidSource,
  /darkMode: true,\s*htmlLabels: false,/u,
  'Mermaid HTML labels must be disabled at the Mermaid 11 root configuration level.',
);
assert.match(
  mermaidSource,
  /MAX_MERMAID_SOURCE_CHARACTERS = 50_000/u,
  'Mermaid source size must be bounded.',
);
assert.match(
  mermaidSource,
  /MAX_MERMAID_SVG_CACHE_ENTRIES = 24/u,
  'Virtualized transcript remounts must use a bounded Mermaid SVG cache.',
);
assert.match(
  mermaidSource,
  /const mermaidSvgCache = new Map<string, Promise<string>>\(\)/u,
  'Virtualized transcript remounts must reuse in-flight and completed Mermaid renders.',
);
assert.match(
  mermaidSource,
  /const resolvedMermaidSvgCache = new Map<string, string>\(\)/u,
  'Virtualized transcript remounts must synchronously reuse completed Mermaid SVG output.',
);
assert.match(
  mermaidSource,
  /const mermaidZoomCache = new Map<string, number>\(\)/u,
  'Virtualized transcript remounts must preserve Mermaid zoom state.',
);
assert.match(
  mermaidSource,
  /revealChatDisclosureDetails\(diagramId\)/u,
  'Completed and zoomed Mermaid diagrams must remain visible above the composer.',
);
assert.match(mermaidSource, /new DOMParser\(\)/u, 'Rendered SVG must be parsed as structured XML.');
for (const blockedElement of ['script', 'foreignObject', 'iframe', 'object', 'embed', 'image']) {
  assert.match(
    mermaidSource,
    new RegExp(`['"]${blockedElement}['"]`, 'u'),
    `Rendered SVG must block ${blockedElement} elements.`,
  );
}
assert.match(mermaidSource, /startsWith\(['"]on['"]\)/u, 'SVG event attributes must be removed.');
assert.match(mermaidSource, /normalizedName === ['"]href['"]/u, 'External SVG links must be filtered.');
assert.match(mermaidSource, /containsUnsafeCss/u, 'SVG CSS URLs and executable CSS must be filtered.');
assert.match(
  vitePluginSource,
  /BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE = \[[\s\S]*?['"]mermaid['"]/u,
  'Web development hosts must prebundle Mermaid under noDiscovery dependency governance.',
);
assert.match(
  vitePluginSource,
  /BIRDCODER_VITE_DESKTOP_OPTIMIZE_DEPS_INCLUDE = \[[\s\S]*?['"]mermaid['"]/u,
  'Desktop development hosts must prebundle Mermaid under noDiscovery dependency governance.',
);
assert.match(
  webViteConfigSource,
  /return ['"]vendor-mermaid['"]/u,
  'Production builds must isolate the Mermaid runtime in a vendor-mermaid chunk.',
);
assert.match(
  webViteConfigSource,
  /return ['"]vendor-mermaid-parser['"]/u,
  'Production builds must isolate the Mermaid parser from the core runtime chunk.',
);
assert.match(
  webViteConfigSource,
  /return ['"]ui-chat-mermaid['"]/u,
  'The Mermaid React component must retain its own lazy production chunk.',
);
assert.match(
  webViteConfigSource,
  /vendor-code-highlight\|vendor-mermaid/u,
  'The HTML entry must not eagerly preload the Mermaid runtime chunk.',
);
assert.doesNotMatch(
  mermaidSource,
  /dangerouslySetInnerHTML/u,
  'Mermaid SVG must never be injected with dangerouslySetInnerHTML.',
);
for (const interactionHook of [
  'data-chat-mermaid-zoom-in',
  'data-chat-mermaid-zoom-out',
  'data-chat-mermaid-reset-zoom',
  'data-chat-mermaid-copy',
  'data-chat-mermaid-retry',
]) {
  assert.match(
    mermaidSource,
    new RegExp(interactionHook, 'u'),
    `Mermaid must expose its ${interactionHook} interaction contract.`,
  );
}

console.log('universal chat Mermaid contract passed.');
