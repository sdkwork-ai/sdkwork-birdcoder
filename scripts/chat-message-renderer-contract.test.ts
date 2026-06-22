import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chatMessageViewSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/chat-message-view.ts',
    import.meta.url,
  ),
  'utf8',
);
const defaultRegistrySource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/defaultRegistry.ts',
    import.meta.url,
  ),
  'utf8',
);
const enginePluginsSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/plugins/enginePlugins.tsx',
    import.meta.url,
  ),
  'utf8',
);
const contentBlockDefaultRegistrySource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/defaultRegistry.ts',
    import.meta.url,
  ),
  'utf8',
);
const contentBlockRenderersSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ContentBlockRenderers.tsx',
    import.meta.url,
  ),
  'utf8',
);
const contentBlocksSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ContentBlockList.tsx',
    import.meta.url,
  ),
  'utf8',
);
const replyRenderersSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/renderers/ReplyMessageRenderers.tsx',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  chatMessageViewSource,
  /export type BirdCoderChatMessageViewKind/,
  'pc-types must define BirdCoderChatMessageViewKind for transcript message views.',
);
assert.match(
  chatMessageViewSource,
  /tool-calls/,
  'pc-types chat message view must model tool-calls content blocks.',
);
assert.match(
  defaultRegistrySource,
  /createEngineChatMessageRendererEntries\(\)/,
  'default chat message renderer registry must register per-engine plugins.',
);
assert.match(
  enginePluginsSource,
  /BIRDCODER_CODE_ENGINE_KEYS/,
  'engine transcript plugins must cover all built-in code engines.',
);
assert.match(
  chatMessageViewSource,
  /type: 'activity'/,
  'pc-types chat message view must model unified activity content blocks.',
);
assert.match(
  contentBlocksSource,
  /ContentBlockList/,
  'content block list must render view.blocks via registry.',
);
assert.match(
  contentBlockDefaultRegistrySource,
  /ActivityContentBlockRenderer/,
  'default content block registry must register unified activity block renderers.',
);
assert.match(
  contentBlockRenderersSource,
  /<ChatActivitySummary/,
  'activity block rendering must delegate to ChatActivitySummary.',
);
assert.match(
  replyRenderersSource,
  /<ContentBlockList view=\{view\} context=\{context\} \/>/,
  'message renderers must render standardized content blocks instead of ad-hoc fields.',
);
assert.match(
  replyRenderersSource,
  /RoleHeader/,
  'reply renderers must show role-specific headers for planner/reviewer/tool/system views.',
);

console.log('chat message renderer contract passed.');
