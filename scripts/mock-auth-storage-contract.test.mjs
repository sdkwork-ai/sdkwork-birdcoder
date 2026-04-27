import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const authContextPath = path.join(
  workspaceRoot,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'context',
  'AuthContext.ts',
);
const runtimeAuthServicePath = path.join(
  workspaceRoot,
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'services',
  'impl',
  'RuntimeAuthService.ts',
);
const runtimeServerSessionPath = path.join(
  workspaceRoot,
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'services',
  'runtimeServerSession.ts',
);

const authContextSource = fs.readFileSync(authContextPath, 'utf8');
const runtimeAuthServiceSource = fs.readFileSync(runtimeAuthServicePath, 'utf8');
const runtimeServerSessionSource = fs.readFileSync(runtimeServerSessionPath, 'utf8');

assert.match(
  authContextSource,
  /const\s+\{\s*authService\s*\}\s*=\s*useIDEServices\(\);/u,
  'auth context must resolve authentication through the IDE service container.',
);
assert.match(
  authContextSource,
  /authService\.getCurrentUser\(\)/u,
  'auth context must load the current user through the runtime auth service.',
);
assert.match(
  authContextSource,
  /runAuthenticatedUserMutation\(\(\) => authService\.login\(request,\s*password\)\)/u,
  'auth context login must delegate to the runtime auth service through the canonical auth mutation boundary.',
);
assert.match(
  authContextSource,
  /runAuthenticatedUserMutation\(\(\) => authService\.register\(request,\s*password,\s*name\)\)/u,
  'auth context registration must delegate to the runtime auth service through the canonical auth mutation boundary.',
);
assert.match(
  authContextSource,
  /authService\.logout\(\)/u,
  'auth context logout must delegate to the runtime auth service.',
);

assert.match(
  runtimeAuthServiceSource,
  /createBirdCoderRuntimeUserCenterClient/u,
  'runtime auth service must build BirdCoder auth flows on top of the canonical appbase runtime client bridge.',
);
assert.match(
  runtimeAuthServiceSource,
  /login:\s*async\s*\(request\)\s*=>\s*requireClient\(\)\.login\(request\)/u,
  'runtime auth service login must delegate to the generated user-center API client instead of embedding local credential handling.',
);
assert.match(
  runtimeAuthServiceSource,
  /requireRuntimeClient\(\)\.bootstrapSession\(request\)/u,
  'runtime auth service external session exchange must delegate to the canonical user-center runtime client.',
);
assert.match(
  runtimeAuthServiceSource,
  /requireRuntimeClient\(\)\.getProfile\(\)/u,
  'runtime auth service must hydrate identity through the canonical user-center runtime client profile endpoint.',
);
assert.match(
  runtimeAuthServiceSource,
  /requireRuntimeClient\(\)\.logoutSession\(\)/u,
  'runtime auth service logout must delegate to the canonical user-center runtime client.',
);
assert.doesNotMatch(
  runtimeAuthServiceSource,
  /\bmock\b/iu,
  'runtime auth service must not embed mock authentication behavior.',
);

assert.match(
  runtimeServerSessionSource,
  /const\s+RUNTIME_SERVER_SESSION_STORAGE_KEY\s*=\s*BIRDCODER_USER_CENTER_STORAGE_PLAN\.sessionTokenKey;/u,
  'runtime auth storage must source the canonical server session identifier key from the shared user-center bridge.',
);
assert.match(
  runtimeServerSessionSource,
  /const\s+RUNTIME_SERVER_SESSION_HEADER_NAME\s*=\s*BIRDCODER_USER_CENTER_SESSION_HEADER_NAME;/u,
  'runtime auth storage must source the canonical user-center session header from the shared user-center bridge.',
);
assert.match(
  runtimeServerSessionSource,
  /resolveBirdCoderProtectedToken/u,
  'runtime auth storage must resolve protected runtime session transport through the validation bridge.',
);
assert.doesNotMatch(
  runtimeServerSessionSource,
  /currentUser|mockUser|mockSession/u,
  'runtime auth storage must not persist mock identities or duplicate user payloads locally.',
);
assert.doesNotMatch(
  runtimeServerSessionSource,
  /sdkwork-birdcoder\.user-center\.session-token|x-sdkwork-user-center-session-id/u,
  'runtime auth storage must not hardcode canonical user-center storage or header names.',
);

console.log('mock auth storage contract passed.');
