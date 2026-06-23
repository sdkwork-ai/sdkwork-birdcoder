import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fs.readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
  ),
  'utf8',
);

assert.match(
  source,
  /if \(\s*!isBrowserRuntime\(\)\s*&&\s*!hasConfiguredRemoteBackendAccess\(runtimeConfig, options\)\s*\)/u,
  'Browser user-facing IDE bootstrap must not require backend SDK bindings; backend-admin surfaces own backend SDK composition.',
);

console.log('default IDE services browser backend boundary contract passed.');
