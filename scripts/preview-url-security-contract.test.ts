import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveSafePreviewUrl } from '../packages/sdkwork-birdcoder-ui-shell/src/components/previewUrlSecurity.ts';

assert.equal(resolveSafePreviewUrl(''), 'about:blank');
assert.equal(resolveSafePreviewUrl('   '), 'about:blank');
assert.equal(resolveSafePreviewUrl('about:blank'), 'about:blank');
assert.equal(resolveSafePreviewUrl('ABOUT:BLANK'), 'about:blank');
assert.equal(resolveSafePreviewUrl('http://localhost:5173'), 'http://localhost:5173');
assert.equal(resolveSafePreviewUrl('https://sdkwork.com/preview'), 'https://sdkwork.com/preview');
assert.equal(resolveSafePreviewUrl('javascript:alert(1)'), 'about:blank');
assert.equal(resolveSafePreviewUrl('JaVaScRiPt:alert(1)'), 'about:blank');
assert.equal(resolveSafePreviewUrl('data:text/html,<script>alert(1)</script>'), 'about:blank');
assert.equal(resolveSafePreviewUrl('file:///C:/Users/admin/.ssh/id_rsa'), 'about:blank');
assert.equal(resolveSafePreviewUrl('ftp://example.com/app'), 'about:blank');
assert.equal(resolveSafePreviewUrl('/relative-preview'), 'about:blank');
assert.equal(resolveSafePreviewUrl('//example.com/preview'), 'about:blank');

const devicePreviewSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui-shell/src/components/DevicePreview.tsx', import.meta.url),
  'utf8',
);
const multiWindowPaneSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-multiwindow/src/components/MultiWindowPane.tsx', import.meta.url),
  'utf8',
);
const studioExecutionActionsSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/useStudioExecutionActions.ts', import.meta.url),
  'utf8',
);
const uiShellRootSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui-shell/src/index.ts', import.meta.url),
  'utf8',
);

assert.match(
  devicePreviewSource,
  /const safeUrl = resolveSafePreviewUrl\(url\);/,
  'DevicePreview must sanitize incoming preview URLs before assigning iframe src.',
);
assert.match(
  devicePreviewSource,
  /src=\{safeUrl\}/,
  'DevicePreview iframe must use the sanitized preview URL.',
);
assert.match(
  multiWindowPaneSource,
  /resolveSafePreviewUrl\(pane\.previewUrl\)/,
  'MultiWindowPane must sanitize manual preview URLs before iframe rendering or external open.',
);
assert.match(
  multiWindowPaneSource,
  /resolveSafePreviewUrl\(autoPreviewUrl\)/,
  'MultiWindowPane must sanitize detected preview URLs before iframe rendering or external open.',
);
assert.match(
  multiWindowPaneSource,
  /window\.open\(previewUrl, '_blank', 'noopener,noreferrer'\)/,
  'MultiWindowPane external preview open must use the sanitized preview URL.',
);
assert.match(
  studioExecutionActionsSource,
  /import \{ resolveSafePreviewUrl \} from '@sdkwork\/birdcoder-ui-shell';/,
  'Studio execution actions must use the shared preview URL sanitizer for launched preview targets.',
);
assert.match(
  studioExecutionActionsSource,
  /const safePreviewUrl = resolveSafePreviewUrl\(launch\.request\.session\.target\.url\);/,
  'Studio execution actions must sanitize preview launch target URLs before storing or opening them.',
);
assert.match(
  studioExecutionActionsSource,
  /setPreviewUrl\(safePreviewUrl\);/,
  'Studio preview state must store only sanitized preview URLs.',
);
assert.match(
  studioExecutionActionsSource,
  /window\.open\(safePreviewUrl, '_blank', 'noopener,noreferrer'\)/,
  'Studio external preview open must use the sanitized preview URL.',
);
assert.match(
  uiShellRootSource,
  /export \{ resolveSafePreviewUrl \} from '\.\/components\/previewUrlSecurity';/,
  'UI shell root must export resolveSafePreviewUrl for preview surfaces in product packages.',
);

console.log('preview URL security contract passed.');
