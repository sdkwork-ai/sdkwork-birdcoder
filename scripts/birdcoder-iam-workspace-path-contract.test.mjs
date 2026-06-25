import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildRetiredAppbaseIamRegexes } from '../../sdkwork-specs/tools/iam-legacy-path-fragments.mjs';
import {
  IAM_APP_SDK_REL,
  IAM_AUTH_PC_REACT_ROOT_REL,
  IAM_AUTH_RUNTIME_PC_REACT_INDEX_REL,
  IAM_BACKEND_SDK_REL,
  IAM_CONTRACTS_INDEX_REL,
  IAM_RUNTIME_INDEX_REL,
  IAM_SDK_PORTS_INDEX_REL,
  IAM_SERVICE_INDEX_REL,
  SDKWORK_IAM_WORKSPACE_REL,
  joinIamWorkspacePath,
} from './birdcoder-iam-workspace-paths.mjs';

const rootDir = process.cwd();
const iamRootDir = path.resolve(rootDir, SDKWORK_IAM_WORKSPACE_REL);

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const retiredIamSourcePatterns = buildRetiredAppbaseIamRegexes();

const governedFiles = [
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'tsconfig.runtime.json',
  'apps/sdkwork-birdcoder-pc/tsconfig.json',
  'apps/sdkwork-birdcoder-pc/tsconfig.runtime.json',
  'apps/sdkwork-birdcoder-pc/pnpm-workspace.yaml',
  'apps/sdkwork-birdcoder-h5/pnpm-workspace.yaml',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/styles/index.css',
  'apps/sdkwork-birdcoder-pc/src/index.css',
  'scripts/create-birdcoder-vite-plugins.mjs',
];

for (const relativePath of governedFiles) {
  const source = readText(relativePath);
  for (const pattern of retiredIamSourcePatterns) {
    assert.doesNotMatch(
      source,
      pattern,
      `${relativePath} must not reference IAM packages under retired sdkwork-appbase package paths.`,
    );
  }
}

for (const relativePath of [
  IAM_CONTRACTS_INDEX_REL,
  IAM_RUNTIME_INDEX_REL,
  IAM_SERVICE_INDEX_REL,
  IAM_SDK_PORTS_INDEX_REL,
  IAM_AUTH_RUNTIME_PC_REACT_INDEX_REL,
  IAM_APP_SDK_REL,
  IAM_BACKEND_SDK_REL,
  path.join(IAM_AUTH_PC_REACT_ROOT_REL, 'src/pages/IamAuthRoutes.tsx'),
]) {
  assert.equal(
    fs.existsSync(path.join(iamRootDir, relativePath)),
    true,
    `sdkwork-iam must provide ${relativePath} for BirdCoder IAM integration.`,
  );
}

assert.match(
  readText('scripts/create-birdcoder-vite-plugins.mjs'),
  /resolveDependencyPath\('sdkwork-iam', 'apps\/sdkwork-iam-pc\/packages\/sdkwork-auth-pc-react\/src\/index\.ts'\)/u,
  'BirdCoder Vite aliases must resolve auth UI from sdkwork-iam.',
);
assert.match(
  readText('tsconfig.json'),
  new RegExp(joinIamWorkspacePath(IAM_AUTH_RUNTIME_PC_REACT_INDEX_REL).replaceAll('/', '[\\\\/]')),
  'Root tsconfig must map @sdkwork/auth-runtime-pc-react to sdkwork-iam.',
);

console.log('birdcoder iam workspace path contract passed.');
