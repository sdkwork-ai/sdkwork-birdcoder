import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const uiFontSizeClass = 'text-[length:var(--birdcoder-ui-font-size,12px)]';

const appSettingsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/settings/appSettings.ts',
);
const themeSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/theme/birdcoderTheme.ts',
);
const themeManagerSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/providers/ThemeManager.tsx',
);
const universalChatSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
);
const contentBlockRenderersSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ContentBlockRenderers.tsx',
);
const replyMessageRenderersSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/renderers/ReplyMessageRenderers.tsx',
);
const sidebarSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx',
);
const sessionRowSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorerSessionRow.tsx',
);
const projectSectionSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorerProjectSection.tsx',
);
const appearanceSettingsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/AppearanceSettings.tsx',
);

assert.match(
  appSettingsSource,
  /uiFontSize: "12",/,
  'The persisted application settings must default the UI font size to 12px.',
);
assert.match(
  themeSource,
  /Number\.parseInt\(uiFontSize, 10\) \|\| 12/,
  'The theme token must retain a 12px fallback when a setting is unavailable.',
);
assert.match(
  themeManagerSource,
  /Number\.parseInt\(uiFontSize, 10\) \|\| 12/,
  'The document theme manager must retain the same 12px fallback.',
);
assert.match(
  appearanceSettingsSource,
  /min=\{APP_FONT_SIZE_MIN\}[\s\S]*max=\{APP_FONT_SIZE_MAX\}/,
  'The appearance controls must use the same bounded range as persisted font settings.',
);

for (const [surfaceName, source] of [
  ['chat composer', universalChatSource],
  ['chat article', contentBlockRenderersSource],
  ['user message', replyMessageRenderersSource],
  ['project and session list', sidebarSource],
  ['session row', sessionRowSource],
  ['project row', projectSectionSource],
]) {
  assert.ok(
    source.includes(uiFontSizeClass),
    `${surfaceName} must consume the configurable BirdCoder UI font-size token.`,
  );
}

console.log('workbench UI font size contract passed.');
