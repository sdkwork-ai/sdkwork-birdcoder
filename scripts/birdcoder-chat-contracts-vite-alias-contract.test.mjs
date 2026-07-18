import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vitePluginsSource = fs.readFileSync(
  path.join(workspaceRootDir, 'scripts/create-birdcoder-vite-plugins.mjs'),
  'utf8',
);
const pcViteConfigSource = fs.readFileSync(
  path.join(workspaceRootDir, 'apps/sdkwork-birdcoder-pc/vite.config.ts'),
  'utf8',
);
const h5ViteConfigSource = fs.readFileSync(
  path.join(workspaceRootDir, 'apps/sdkwork-birdcoder-h5/vite.config.ts'),
  'utf8',
);
const chatContractsEntry = path.join(
  workspaceRootDir,
  'apps/sdkwork-birdcoder-common/packages/sdkwork-birdcoder-chat-contracts/src/index.ts',
);

assert.ok(
  fs.existsSync(chatContractsEntry),
  'Root shared chat contracts package must exist for cross-surface alignment.',
);

assert.match(
  vitePluginsSource,
  /@sdkwork\/birdcoder-chat-contracts['"][\s\S]*apps\/sdkwork-birdcoder-common\/packages\/sdkwork-birdcoder-chat-contracts\/src\/index\.ts/u,
  'Vite workspace aliases must resolve @sdkwork/birdcoder-chat-contracts to the BirdCoder common shared package.',
);

assert.doesNotMatch(
  pcViteConfigSource,
  /['"]process\.env\.SDKWORK_ACCESS_TOKEN['"]\s*:/u,
  'PC Vite config must not compile SDKWORK_ACCESS_TOKEN into browser bundles.',
);

assert.doesNotMatch(
  h5ViteConfigSource,
  /['"]process\.env\.SDKWORK_ACCESS_TOKEN['"]\s*:/u,
  'H5 Vite config must not compile SDKWORK_ACCESS_TOKEN into browser bundles.',
);

console.log('birdcoder chat contracts vite alias contract passed.');
