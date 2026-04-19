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
  /authService\.login\(email,\s*password\)/u,
  'auth context login must delegate to the runtime auth service.',
);
assert.match(
  authContextSource,
  /authService\.register\(email,\s*password,\s*name\)/u,
  'auth context registration must delegate to the runtime auth service.',
);
assert.match(
  authContextSource,
  /authService\.logout\(\)/u,
  'auth context logout must delegate to the runtime auth service.',
);

assert.match(
  runtimeAuthServiceSource,
  /this\.requireClient\(\)\.login\(\{\s*email,\s*password\s*\}\)/u,
  'runtime auth service must call the user-center API client for login.',
);
assert.match(
  runtimeAuthServiceSource,
  /this\.requireClient\(\)\.register\(\{\s*email,\s*name,\s*password\s*\}\)/u,
  'runtime auth service must call the user-center API client for registration.',
);
assert.match(
  runtimeAuthServiceSource,
  /this\.requireClient\(\)\.exchangeSession\(request\)/u,
  'runtime auth service must call the user-center API client for external session exchange.',
);
assert.match(
  runtimeAuthServiceSource,
  /await\s+this\.client\.getCurrentSession\(\)/u,
  'runtime auth service must hydrate identity from the server session endpoint.',
);
assert.doesNotMatch(
  runtimeAuthServiceSource,
  /\bmock\b/iu,
  'runtime auth service must not embed mock authentication behavior.',
);

assert.match(
  runtimeServerSessionSource,
  /const\s+RUNTIME_SERVER_SESSION_STORAGE_KEY\s*=\s*'birdcoder\.server\.user-center\.session\.v1';/u,
  'runtime auth storage must persist only the canonical server session identifier key.',
);
assert.doesNotMatch(
  runtimeServerSessionSource,
  /currentUser|mockUser|mockSession/u,
  'runtime auth storage must not persist mock identities or duplicate user payloads locally.',
);

console.log('mock auth storage contract passed.');
