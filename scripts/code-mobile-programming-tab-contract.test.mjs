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
  /QRCode\.toSvgDataURL\(/,
  'Code mobile programming panel must render the QR image from the mobile-coding deep link payload without relying on Canvas data URL support.',
);

assert.match(
  mobilePanelSource,
  /aria-label=\{t\('code\.mobileProgramming\.simulatorLabel'\)\}/,
  'Code mobile programming panel must present a phone simulator as the primary mobile programming surface.',
);

assert.match(
  mobilePanelSource,
  /className="relative flex h-\[720px\] w-\[360px\]/,
  'Code mobile programming phone simulator must be visually dominant with a taller device frame.',
);

assert.match(
  mobilePanelSource,
  /lg:grid-cols-\[360px_minmax\(380px,420px\)\][^"]*lg:gap-6/,
  'Code mobile programming layout must keep the phone and QR panel close with fixed product-focused columns.',
);

assert.match(
  mobilePanelSource,
  /<aside className="flex min-w-0 flex-col items-center p-2 text-center lg:sticky lg:top-6">/,
  'Code mobile programming QR side must be a borderless transparent information zone instead of a competing card.',
);

assert.doesNotMatch(
  mobilePanelSource,
  /<aside className="[^"]*border[^"]*bg-\[#17181d\][^"]*shadow/,
  'Code mobile programming QR side must not render the old dark bordered card shell.',
);

assert.match(
  mobilePanelSource,
  /className="mt-5 flex justify-center rounded-lg bg-white p-4 shadow-\[0_18px_60px_rgba\(0,0,0,0\.38\)\]"/,
  'Code mobile programming QR code should keep a focused white scan surface without restoring an outer border card.',
);

assert.match(
  mobilePanelSource,
  /className="mt-5 max-w-sm text-xs leading-6 text-emerald-100\/75"/,
  'Code mobile programming context hint should read as lightweight supporting copy in the borderless QR side.',
);

assert.match(
  mobilePanelSource,
  /className="h-64 w-64 object-contain sm:h-72 sm:w-72"/,
  'Code mobile programming QR code must be large enough to feel like a primary mobile entry point.',
);

assert.match(
  mobilePanelSource,
  /const \[qrCodeStatus, setQrCodeStatus\] = useState<'idle' \| 'loading' \| 'ready' \| 'error'>\('idle'\);/,
  'Code mobile programming panel must track QR loading and failure state instead of rendering a blank fallback.',
);

assert.match(
  mobilePanelSource,
  /qrCodeStatus === 'error'\s+\? t\('code\.mobileProgramming\.qrUnavailableTitle'\)\s+:\s+t\('code\.mobileProgramming\.qrLoadingTitle'\)/,
  'Code mobile programming QR fallback must show visible loading or unavailable copy instead of a blank block.',
);

assert.doesNotMatch(
  mobilePanelSource,
  /animate-pulse rounded bg-slate-200/,
  'Code mobile programming QR fallback must not regress to a blank-looking light placeholder.',
);

assert.match(
  mobilePanelSource,
  /t\('code\.mobileProgramming\.assistantMessageCode'\)/,
  'The phone simulator must demonstrate code-assistant conversation content instead of only explaining QR scanning.',
);

assert.match(
  mobilePanelSource,
  /t\('code\.mobileProgramming\.scanTitle'\)[\s\S]*t\('code\.mobileProgramming\.scanCta'\)/,
  'The QR panel must put the scan instruction below the code with the "scan to start mobile programming" CTA.',
);

assert.doesNotMatch(
  mobilePanelSource,
  /stepDownloadTitle|stepScanTitle|stepContinueTitle/,
  'Code mobile programming panel must not regress to a documentation-style three-step instruction page.',
);

assert.doesNotMatch(
  mobilePanelSource,
  /t\('code\.mobileProgramming\.title'\)|t\('code\.mobileProgramming\.description'\)|t\('code\.mobileProgramming\.eyebrow'\)/,
  'Code mobile programming panel must not render a left-side explanatory copy block that competes with the phone simulator.',
);

console.log('code mobile programming tab contract passed.');
