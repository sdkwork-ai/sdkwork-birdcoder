import assert from 'node:assert/strict';
import fs from 'node:fs';

const appRootSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/AppRoot.tsx', import.meta.url),
  'utf8',
);
const shellRuntimeProvidersSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/providers/ShellRuntimeProviders.tsx', import.meta.url),
  'utf8',
);
const authGateSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/AuthGate.tsx', import.meta.url),
  'utf8',
);
const birdcoderAppSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/BirdcoderApp.tsx', import.meta.url),
  'utf8',
);
const iamRuntimeSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts', import.meta.url),
  'utf8',
);
const nativeSessionHandlersSource = fs.readFileSync(
  new URL('../crates/sdkwork-router-engine-catalog-app-api/src/handlers.rs', import.meta.url),
  'utf8',
);
const membershipHandlersSource = fs.readFileSync(
  new URL('../crates/sdkwork-router-membership-app-api/src/handlers.rs', import.meta.url),
  'utf8',
);

assert.match(
  shellRuntimeProvidersSource,
  /<IDEProvider>[\s\S]*<AuthProvider>[\s\S]*<AuthStateBridge>/u,
  'Shell runtime providers must mount IDEProvider and AuthProvider before auth bridge children.',
);

assert.match(
  appRootSource,
  /<ShellRuntimeProviders>[\s\S]*<BirdCoderAuthGate>[\s\S]*<LazyBirdcoderApp/u,
  'AppRoot must mount BirdCoderAuthGate inside ShellRuntimeProviders so useAuth has an AuthProvider ancestor.',
);

assert.doesNotMatch(
  birdcoderAppSource,
  /<AuthProvider>/u,
  'BirdcoderApp must not mount a nested AuthProvider after shell-level auth composition.',
);

assert.doesNotMatch(
  birdcoderAppSource,
  /<IDEProvider>/u,
  'BirdcoderApp must not mount a nested IDEProvider after shell-level runtime composition.',
);

assert.match(
  authGateSource,
  /useAuth\(\)/u,
  'AuthGate must read auth state from the shell AuthProvider.',
);

assert.match(
  authGateSource,
  /shouldBootIntoAuthSurface\(\)/u,
  'AuthGate must render the IAM auth surface for direct /auth entry without blocking guest routes.',
);
assert.match(
  authGateSource,
  /getRuntime/u,
  'AuthGate must accept IAM runtime injection from the shell composition layer.',
);

assert.doesNotMatch(
  iamRuntimeSource,
  /getBirdCoderGeneratedBackendSdkClient/u,
  'App IAM runtime composition must not construct backend SDK clients for the user-facing renderer.',
);

assert.match(
  nativeSessionHandlersSource,
  /workspaceId and projectId are required to list native sessions/u,
  'Native session list API must require scoped workspace/project query parameters.',
);

assert.match(
  membershipHandlersSource,
  /Membership lookup is limited to the authenticated user/u,
  'Membership lookup must reject cross-user owner_user_id overrides.',
);

console.log('auth gate provider order contract passed.');
