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
  /gitService: new ApiBackedGitService\(\{\s*appClient,[\s\S]*resolveLocalWorkingDirectory:[\s\S]*runtime\.fileSystemService\.resolveLocalWorkingDirectory\(projectId\),[\s\S]*\}\),/s,
  'defaultIdeServices must wire gitService to the active Tauri mount before the generated app SDK fallback.',
);

console.log('default IDE services git service contract passed.');
