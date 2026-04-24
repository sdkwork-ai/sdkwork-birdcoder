import assert from 'node:assert/strict';
import fs from 'node:fs';

const mobilePanelSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodeMobileProgrammingPanel.tsx', import.meta.url),
  'utf8',
);
const shimPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/shims/qrcode.ts',
  import.meta.url,
);
const vitePluginSource = fs.readFileSync(
  new URL('../scripts/create-birdcoder-vite-plugins.mjs', import.meta.url),
  'utf8',
);
const packageJsonSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/package.json', import.meta.url),
  'utf8',
);
const workspaceSource = fs.readFileSync(
  new URL('../pnpm-workspace.yaml', import.meta.url),
  'utf8',
);

assert.ok(
  fs.existsSync(shimPath),
  'BirdCoder must provide a local qrcode browser shim instead of importing the package entry directly from runtime code.',
);

const shimSource = fs.readFileSync(shimPath, 'utf8');

assert.match(
  mobilePanelSource,
  /import QRCode from '\.\.\/shims\/qrcode';/,
  'CodeMobileProgrammingPanel must consume the local qrcode browser shim.',
);

assert.doesNotMatch(
  mobilePanelSource,
  /from 'qrcode';/,
  'CodeMobileProgrammingPanel must not import the qrcode package entry directly because it resolves to a require-based runtime path.',
);

assert.match(
  shimSource,
  /import\('qrcode\/lib\/browser\.js'\)/,
  'The local qrcode shim must load the explicit browser entry from qrcode.',
);

assert.match(
  vitePluginSource,
  /BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE[\s\S]*'qrcode',[\s\S]*'qrcode\/lib\/browser\.js'/,
  'BirdCoder web host optimizeDeps include list must prebundle both qrcode and qrcode browser entry for dev runtime safety.',
);

assert.match(
  workspaceSource,
  /qrcode:\s+\^1\.5\.4/,
  'The qrcode dependency version must be governed from the workspace catalog.',
);

assert.match(
  packageJsonSource,
  /"qrcode": "catalog:"/,
  'The code package must consume qrcode through the workspace catalog instead of a package-local version string.',
);

console.log('qrcode browser shim contract passed.');
