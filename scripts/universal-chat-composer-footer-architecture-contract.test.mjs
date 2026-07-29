import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const composerDir = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'chat',
  'composer',
);
const readComposer = (fileName) => fs.readFileSync(path.join(composerDir, fileName), 'utf8');
const dispatcherSource = readComposer('UniversalChatComposerFooter.tsx');
const sharedFooterSource = readComposer('SharedComposerFooter.tsx');
const accessModeControlSource = readComposer('ComposerAccessModeControl.tsx');

const engineFooters = [
  ['CodexComposerFooter.tsx', 'CodexComposerFooter', 'codex'],
  ['ClaudeCodeComposerFooter.tsx', 'ClaudeCodeComposerFooter', 'claude-code'],
  ['OpenCodeComposerFooter.tsx', 'OpenCodeComposerFooter', 'opencode'],
  ['GeminiComposerFooter.tsx', 'GeminiComposerFooter', 'gemini'],
];

for (const [fileName, componentName, engineId] of engineFooters) {
  const source = readComposer(fileName);
  assert.match(
    source,
    new RegExp(`export const ${componentName}`),
    `${componentName} must remain an explicit engine-specific extension point.`,
  );
  assert.ok(
    source.includes(`<SharedComposerFooter {...props} engineId="${engineId}" />`),
    `${componentName} must delegate common controls with its canonical engine ID.`,
  );
  assert.ok(
    dispatcherSource.includes(`<${componentName} {...props} />`),
    `Composer footer dispatcher must render ${componentName}.`,
  );
}

for (const engineId of ['codex', 'claude-code', 'opencode', 'gemini']) {
  assert.ok(
    dispatcherSource.includes(`'${engineId}'`),
    `Composer footer dispatcher must recognize the canonical ${engineId} engine ID.`,
  );
}

assert.match(
  sharedFooterSource,
  /from '@sdkwork\/models-pc-picker';/u,
  'Shared composer controls must reuse the SDKWork models picker package.',
);
assert.match(
  sharedFooterSource,
  /data-composer-engine=\{engineId\}/u,
  'Shared footer must expose the active engine for focused styling and integration tests.',
);
assert.match(
  sharedFooterSource,
  /<Plus[\s\S]*<ComposerAccessModeControl[\s\S]*<input/u,
  'The shared footer must place the access-mode control immediately to the right of the attachment button.',
);
assert.match(
  accessModeControlSource,
  /role="menuitemradio"/u,
  'Access modes must expose single-selection menu semantics.',
);
assert.match(
  accessModeControlSource,
  /event\.key === 'ArrowDown'[\s\S]*event\.key === 'ArrowUp'[\s\S]*event\.key === 'Home'[\s\S]*event\.key === 'End'/u,
  'Access-mode options must support complete keyboard navigation.',
);
assert.match(
  accessModeControlSource,
  /event\.key !== 'Escape'[\s\S]*closeAndRestoreFocus\(\)/u,
  'Escape must close the access-mode menu and restore trigger focus.',
);

console.log('universal chat composer footer architecture contract passed.');
