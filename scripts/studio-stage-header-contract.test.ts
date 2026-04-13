import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studioStageHeaderSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/preview/StudioStageHeader.tsx', import.meta.url),
  'utf8',
);

assert.equal(
  studioStageHeaderSource.includes("onClick={() => onTabChange('preview')}"),
  true,
  'StudioStageHeader should keep the preview tab entry.',
);

assert.equal(
  studioStageHeaderSource.includes("onClick={() => onTabChange('code')}"),
  true,
  'StudioStageHeader should keep the code tab entry.',
);

assert.doesNotMatch(
  studioStageHeaderSource,
  /<select[\s>]/,
  'StudioStageHeader should replace native select controls with custom dark-mode-safe dropdowns so option text remains readable in the desktop shell.',
);

assert.match(
  studioStageHeaderSource,
  /onClick=\{\(\) => onPreviewPlatformChange\('web'\)\}[\s\S]*?\{t\('studio\.web'\)\}/s,
  'StudioStageHeader web platform switch should render a visible text label instead of relying on an icon-only affordance.',
);

assert.match(
  studioStageHeaderSource,
  /onClick=\{\(\) => onPreviewPlatformChange\('miniprogram'\)\}[\s\S]*?\{t\('studio\.miniprogram'\)\}/s,
  'StudioStageHeader mini-program platform switch should render a visible text label instead of relying on an icon-only affordance.',
);

assert.match(
  studioStageHeaderSource,
  /onClick=\{\(\) => onPreviewPlatformChange\('app'\)\}[\s\S]*?\{t\('studio\.app'\)\}/s,
  'StudioStageHeader app platform switch should render a visible text label instead of relying on an icon-only affordance.',
);

assert.match(
  studioStageHeaderSource,
  /<StageHeaderSelect[\s\S]*?label=\{t\('studio\.device'\)\}/s,
  'StudioStageHeader should use a labeled custom dropdown component for target configuration controls.',
);

assert.doesNotMatch(
  studioStageHeaderSource,
  /previewPlatform === 'web'[\s\S]*?onPreviewWebDeviceChange\('desktop'\)[\s\S]*?onPreviewWebDeviceChange\('tablet'\)[\s\S]*?onPreviewWebDeviceChange\('mobile'\)/s,
  'StudioStageHeader should not render three inline web device icon buttons that visually collide with the top-level platform switch.',
);

assert.match(
  studioStageHeaderSource,
  /className=\{`flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-1 rounded-full[\s\S]*?\$\{activeTab === 'preview'/s,
  'StudioStageHeader preview tab must keep its indicator and label on one line when preview controls compress the left header area.',
);

assert.match(
  studioStageHeaderSource,
  /className=\{`flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-1 rounded-full[\s\S]*?\$\{activeTab === 'code'/s,
  'StudioStageHeader code tab must keep its indicator and label on one line when the header is narrow.',
);

assert.doesNotMatch(
  studioStageHeaderSource,
  /activeTab === 'preview'[\s\S]*?max-w-\[200px\][\s\S]*?w-full/s,
  'StudioStageHeader preview URL pill must not claim full width, or it will squeeze the left tab buttons into wrapping.',
);

assert.equal(
  studioStageHeaderSource.includes("onClick={() => onTabChange('simulator')}"),
  false,
  'StudioStageHeader should not expose a simulator tab entry in the header.',
);

console.log('studio stage header contract passed.');
