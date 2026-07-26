import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  resolveRendererDevBootstrapContext,
} from '@sdkwork/iam-credential-entry/renderer-dev-bootstrap';
import {
  mergeRepoDevBootstrapAccessTokenEnv,
} from '@sdkwork/iam-credential-entry/node-bootstrap';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const surfaces = [
  'sdkwork-birdcoder-pc',
  'sdkwork-birdcoder-h5',
  'sdkwork-birdcoder-flutter-mobile',
];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

for (const appId of surfaces) {
  test(`${appId} resolves credential bootstrap through IAM public package contracts`, () => {
    const context = resolveRendererDevBootstrapContext(path.join(repoRoot, 'apps', appId));
    const merged = mergeRepoDevBootstrapAccessTokenEnv({
      env: {},
      manifestPath: context.manifestPath,
      repoRoot: context.repoRoot,
    });
    const payload = JSON.parse(
      Buffer.from(merged.SDKWORK_ACCESS_TOKEN.split('.')[1], 'base64url').toString('utf8'),
    );

    assert.equal(payload.app_id, appId);
    assert.equal(payload.tenant_id, '100001');
    assert.equal(payload.organization_id, '0');
  });
}

test('BirdCoder consumes IAM through package and assembly boundaries', () => {
  const h5Package = JSON.parse(read('apps/sdkwork-birdcoder-h5/package.json'));
  const flutterRunner = read('scripts/run-flutter-mobile-command.mjs');
  const pcViteConfig = read('apps/sdkwork-birdcoder-pc/vite.config.ts');
  const pcAppRoot = read(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/AppRoot.tsx',
  );
  const pcIamRuntime = read(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts',
  );

  assert.match(h5Package.scripts['start:browser'], /sdkwork-iam-renderer-dev-bootstrap/u);
  assert.doesNotMatch(h5Package.scripts['start:browser'], /sdkwork-iam[\\/]scripts/u);
  assert.match(flutterRunner, /@sdkwork\/iam-credential-entry\/node-bootstrap/u);
  assert.doesNotMatch(flutterRunner, /\.\.\/\.\.\/sdkwork-iam/u);
  assert.match(pcViteConfig, /@sdkwork\/iam-credential-entry\/vite/u);
  assert.match(pcAppRoot, /SdkworkSessionAuthBrowserRoot/u);
  assert.match(pcIamRuntime, /createSdkworkAppbasePcAuthRuntime/u);
  assert.doesNotMatch(pcIamRuntime, /sessionAuth:\s*false/u);
});
