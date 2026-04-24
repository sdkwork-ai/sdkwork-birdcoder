import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(
  import.meta.dirname,
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
);
const source = fs.readFileSync(sourcePath, 'utf8');

assert.match(
  source,
  /import \{ ApiBackedGitService \} from '\.\/impl\/ApiBackedGitService\.ts';/,
  'defaultIdeServices must compose the shared Git service implementation.',
);

assert.match(
  source,
  /gitService: IGitService;/,
  'BirdCoderDefaultIdeServices must expose a dedicated gitService boundary.',
);

assert.match(
  source,
  /gitService: new ApiBackedGitService\(\{\s*client: appAdminClient,\s*\}\),/s,
  'defaultIdeServices must wire gitService to the authoritative generated app/admin client.',
);

console.log('default IDE services git service contract passed.');
