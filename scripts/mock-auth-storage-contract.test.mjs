import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const authContextPath = path.join(
  workspaceRoot,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  
  
  'sdkwork-birdcoder-pc-commons',
  'src',
  'context',
  'AuthContext.ts',
);
const runtimeAuthServicePath = path.join(
  workspaceRoot,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  
  
  'sdkwork-birdcoder-pc-infrastructure',
  'src',
  'services',
  'impl',
  'RuntimeAuthService.ts',
);
const runtimeServerSessionPath = path.join(
  workspaceRoot,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  
  
  'sdkwork-birdcoder-pc-infrastructure',
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
  /authService\.logout\(\)/u,
  'auth context logout must delegate to the runtime auth service.',
);
assert.doesNotMatch(
  authContextSource,
  /login\(|register\(|exchangeUserCenterSession|getUserCenterConfig/u,
  'auth context must not expose app-local login/register/config compatibility methods.',
);

assert.match(
  runtimeAuthServiceSource,
  /getBirdCoderIamRuntime/u,
  'runtime auth service must build BirdCoder auth flows on top of the canonical SDKWork IAM runtime.',
);
assert.match(
  runtimeAuthServiceSource,
  /runtime\.service\.iam\.users\.current\.retrieve\(\)/u,
  'runtime auth service must hydrate identity through the generated SDKWork IAM current-user endpoint.',
);
assert.match(
  runtimeAuthServiceSource,
  /runtime\.service\.auth\.sessions\.current\.delete\(\)/u,
  'runtime auth service logout must revoke the SDKWork IAM current session.',
);
assert.doesNotMatch(
  runtimeAuthServiceSource,
  /createBirdCoderRuntimeUserCenterClient|bootstrapSession|logoutSession|\bmock\b/iu,
  'runtime auth service must not embed mock auth behavior or retired identity bridge calls.',
);

assert.match(
  runtimeServerSessionSource,
  /RUNTIME_SERVER_ACCESS_TOKEN_HEADER_NAME = 'Access-Token'/u,
  'runtime auth storage must expose the canonical SDKWork access-token header.',
);
assert.match(
  runtimeServerSessionSource,
  /RUNTIME_SERVER_AUTHORIZATION_HEADER_NAME = 'Authorization'/u,
  'runtime auth storage must expose the canonical SDKWork auth-token header.',
);
assert.match(
  runtimeServerSessionSource,
  /RUNTIME_SERVER_SESSION_HEADER_NAME = 'X-SDKWork-Session-Id'/u,
  'runtime auth storage must expose the canonical SDKWork app-session id header.',
);
assert.doesNotMatch(
  runtimeServerSessionSource,
  /currentUser|mockUser|mockSession|BIRDCODER_USER_CENTER|USER_CENTER/u,
  'runtime auth storage must not persist mock identities or retired identity storage constants.',
);
assert.doesNotMatch(
  runtimeServerSessionSource,
  /sdkwork-birdcoder\.user-center\.session-token|x-sdkwork-user-center-session-id/u,
  'runtime auth storage must not hardcode retired identity storage or header names.',
);

console.log('mock auth storage contract passed.');
