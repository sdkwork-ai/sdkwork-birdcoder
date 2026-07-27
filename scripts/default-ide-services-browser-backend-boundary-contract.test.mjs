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

assert.doesNotMatch(
  source,
  /BackendSdk|backendClient|createBirdCoderBackend/iu,
  'Browser user-facing IDE bootstrap must not import or compose backend SDK clients.',
);

for (const appSdkBoundary of [
  'createBirdCoderAgentsAppSdkClient',
  'createBirdCoderDocumentsAppSdkClient',
  'createBirdCoderSkillsAppSdkClient',
  'SdkworkPromptsAppClient',
]) {
  assert.match(
    source,
    new RegExp(`\\b${appSdkBoundary}\\b`, 'u'),
    `Browser user-facing IDE bootstrap must retain the ${appSdkBoundary} App SDK boundary.`,
  );
}

console.log('default IDE services browser backend boundary contract passed.');
