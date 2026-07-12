import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const mainBodySource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppMainBody.tsx',
  ),
  'utf8',
);
const boundarySource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppErrorBoundary.tsx',
  ),
  'utf8',
);

assert.match(
  boundarySource,
  /class SurfaceErrorBoundary extends Component<[\s\S]*componentDidCatch[\s\S]*onClick=\{this\.props\.onRecover\}/u,
  'the shell must expose a recoverable surface-level error boundary instead of relying only on the global reload boundary.',
);

for (const surface of [
  'code',
  'studio',
  'multiwindow',
  'terminal',
  'auth',
  'user',
  'vip',
  'settings',
]) {
  assert.match(
    mainBodySource,
    new RegExp(`<SurfaceErrorBoundaryWithTranslation\\s+surface="${surface}"`, 'u'),
    `${surface} must be isolated by its own error boundary.`,
  );
}

assert.match(
  mainBodySource,
  /surface="code"\s+onRecover=\{\(\) => onActiveTabChange\('settings'\)\}/u,
  'a failed Code chunk must be able to recover to Settings instead of reopening the persisted failed tab.',
);

assert.match(
  mainBodySource,
  /surface="studio"\s+onRecover=\{\(\) => onActiveTabChange\('code'\)\}/u,
  'a failed secondary workbench surface must recover to Code without replacing the entire shell.',
);

console.log('app surface error isolation contract passed.');
