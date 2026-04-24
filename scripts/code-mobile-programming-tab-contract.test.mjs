import assert from 'node:assert/strict';
import fs from 'node:fs';

const codePageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const codePageSurfaceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePageSurface.tsx', import.meta.url),
  'utf8',
);
const topBarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/TopBar.tsx', import.meta.url),
  'utf8',
);
const mobilePanelPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodeMobileProgrammingPanel.tsx',
  import.meta.url,
);

assert.ok(
  fs.existsSync(mobilePanelPath),
  'Code mobile programming panel file must exist as a dedicated code-view surface component.',
);

const mobilePanelSource = fs.readFileSync(mobilePanelPath, 'utf8');

assert.match(
  codePageSource,
  /const \[activeTab, setActiveTab\] = useState<'ai' \| 'editor' \| 'mobile'>\('ai'\);/,
  'CodePage must add mobile as a first-class code view tab state.',
);

assert.match(
  codePageSurfaceSource,
  /from '\.\/CodeMobileProgrammingPanel';/,
  'CodePageSurface must render the dedicated mobile programming panel instead of inlining the QR UI.',
);

assert.match(
  codePageSurfaceSource,
  /<CodeMobileProgrammingPanel \{\.\.\.mobileProgrammingProps\} isActive=\{activeTab === 'mobile'\} \/>/,
  'CodePageSurface must switch the mobile programming panel through the shared activeTab state.',
);

assert.match(
  topBarSource,
  /activeTab: 'ai' \| 'editor' \| 'mobile';/,
  'TopBar must accept the mobile programming tab in its active tab union.',
);

assert.match(
  topBarSource,
  /setActiveTab: \(tab: 'ai' \| 'editor' \| 'mobile'\) => void;/,
  'TopBar must allow selecting the mobile programming tab through the shared tab setter.',
);

assert.match(
  topBarSource,
  /t\('app\.menu\.mobileCodingMode'\)/,
  'TopBar must render a dedicated mobile programming tab label.',
);

assert.match(
  mobilePanelSource,
  /import QRCode from '\.\.\/shims\/qrcode';/,
  'Code mobile programming panel must generate a real QR code through the local browser shim instead of a runtime-unsafe package entry.',
);

assert.match(
  mobilePanelSource,
  /export function buildCodeMobileProgrammingQrValue\(/,
  'Code mobile programming panel must expose a dedicated QR payload builder for mobile programming sessions.',
);

assert.match(
  mobilePanelSource,
  /sdkwork:\/\/birdcoder\/mobile-coding\?/,
  'The mobile programming QR payload must use the canonical sdkwork birdcoder mobile-coding deep link.',
);

assert.match(
  mobilePanelSource,
  /QRCode\.toDataURL\(/,
  'Code mobile programming panel must render the QR image from the mobile-coding deep link payload.',
);

assert.match(
  mobilePanelSource,
  /t\('code\.mobileProgramming\.title'\)/,
  'Code mobile programming panel must show dedicated copy for the mobile programming experience.',
);

console.log('code mobile programming tab contract passed.');
