import assert from 'node:assert/strict';
import path from 'node:path';

import { createBirdcoderVitePlugins } from './create-birdcoder-vite-plugins.mjs';

const workspaceRootDir = path.resolve(import.meta.dirname, '..');
const webAppRootDir = path.resolve(workspaceRootDir, 'packages', 'sdkwork-birdcoder-web');

const plugins = createBirdcoderVitePlugins({
  appRootDir: webAppRootDir,
  mode: 'production',
  namespace: 'sdkwork-birdcoder-web',
});

const nodeEnvGuardPlugin = plugins.find(
  (candidate) => candidate?.name === 'sdkwork-birdcoder-web-node-env-guard',
);

assert.ok(
  nodeEnvGuardPlugin,
  'BirdCoder Vite plugins must include a dedicated node env guard before Vite define handling.',
);
assert.equal(
  nodeEnvGuardPlugin.enforce,
  'pre',
  'BirdCoder node env guard must run in the pre phase so Vite define never falls back to esbuild for NODE_ENV replacement.',
);
assert.equal(
  typeof nodeEnvGuardPlugin.transform,
  'function',
  'BirdCoder node env guard must expose a transform hook.',
);

const transformed = await nodeEnvGuardPlugin.transform(
  [
    'if (process.env.NODE_ENV !== "production") {',
    '  console.warn("dev");',
    '}',
    'export const env = process.env.NODE_ENV;',
    '',
  ].join('\n'),
  '/virtual/node_modules/@tanstack/table-core/build/lib/index.mjs',
);

assert.ok(
  transformed && typeof transformed === 'object' && typeof transformed.code === 'string',
  'BirdCoder node env guard must rewrite matching modules instead of returning null.',
);
assert.doesNotMatch(
  transformed.code,
  /process\.env\.NODE_ENV/u,
  'BirdCoder node env guard must remove raw process.env.NODE_ENV expressions from transformed module code.',
);
assert.match(
  transformed.code,
  /"production"/u,
  'BirdCoder node env guard must inline the active build mode as a string literal.',
);

console.log('vite node env guard contract passed.');
