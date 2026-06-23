import assert from 'node:assert/strict';
import fs from 'node:fs';

const authContextSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/context/AuthContext.ts', import.meta.url),
  'utf8',
);
const authServiceSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IAuthService.ts', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  authContextSource,
  /getUserCenterConfig|exchangeUserCenterSession|auth\/config|session_exchanges/u,
  'Auth bootstrap must not keep retired local identity config or session-exchange hooks.',
);

assert.match(
  authContextSource,
  /authService\.getCurrentUser\(\)/,
  'Auth bootstrap must resolve the current user through the SDKWork IAM runtime auth service.',
);

assert.match(
  authContextSource,
  /globalThis\.addEventListener\?\.\('sdkwork:birdcoder:app-session-change', handleAppSessionChange\)/u,
  'Auth bootstrap must refresh from SDKWork IAM storage when the app-session token changes.',
);

assert.match(
  authContextSource,
  /globalThis\.removeEventListener\?\.\('sdkwork:birdcoder:app-session-change', handleAppSessionChange\)/u,
  'Auth bootstrap must detach the app-session listener during provider cleanup.',
);

assert.match(
  authServiceSource,
  /export interface IAuthService \{\s*getCurrentUser\(\): Promise<User \| null>;\s*hasStoredSession\(\): Promise<boolean>;\s*logout\(\): Promise<void>;\s*\}/u,
  'BirdCoder auth service must expose current-user, stored-session, and logout methods; sign-in is owned by SdkworkIamAuthRoutes over @sdkwork/iam-runtime.',
);

assert.match(
  authContextSource,
  /authService\.hasStoredSession\(\)/u,
  'Auth refresh must consult validated IAM session state through the auth service.',
);

assert.match(
  authContextSource,
  /if \(currentUser !== null\) \{[\s\S]*return currentUser;[\s\S]*\}[\s\S]*if \(!sessionPresent\) \{[\s\S]*return null;[\s\S]*\}[\s\S]*return resolveFallbackAwareCurrentUser\(null, previousUser/u,
  'Auth refresh must fail closed when no validated IAM session remains and only preserve a just-confirmed auth-surface user during active session hydration.',
);

assert.doesNotMatch(
  authServiceSource,
  /login\(|register\(|getUserCenterConfig|exchangeUserCenterSession/u,
  'BirdCoder auth service must not preserve app-local login/register/config compatibility methods.',
);

console.log('auth bootstrap gating contract passed.');
