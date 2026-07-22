import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(
  import.meta.dirname,
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
);
const sharedSourcePath = path.resolve(
  import.meta.dirname,
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
);
const source = fs.readFileSync(sourcePath, 'utf8');
const sharedSource = fs.readFileSync(sharedSourcePath, 'utf8');

assert.match(
  source,
  /import \{ ApiBackedGitService \} from '\.\/impl\/ApiBackedGitService\.ts';/,
  'defaultIdeServices must compose the shared Git service implementation.',
);

assert.match(
  sharedSource,
  /gitService: IGitService;/,
  'BirdCoderDefaultIdeServices must expose a dedicated gitService boundary.',
);

assert.match(
  source,
  /gitService: new ApiBackedGitService\(\{\s*appClient,[\s\S]*resolveProjectRuntimeLocation:[\s\S]*resolveProjectRuntimeLocation\(projectId,[\s\S]*resolveRemoteRuntimeLocationId:[\s\S]*resolveRemoteProjectRuntimeLocationId\([\s\S]*'git',[\s\S]*\}\),/s,
  'defaultIdeServices must wire Git to the active Tauri mount and the selected remote Git runtime location.',
);

console.log('default IDE services git service contract passed.');
