import assert from 'node:assert/strict';
import fs from 'node:fs';

const userIndexPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/index.ts',
  import.meta.url,
);
const userPagePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/pages/UserPage.tsx',
  import.meta.url,
);
const vipPagePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/pages/VipPage.tsx',
  import.meta.url,
);
const tokenPlanPagePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/token-plan/BirdCoderTokenPlanPage.tsx',
  import.meta.url,
);
const tokenPlanMemberSummaryPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/token-plan/tokenPlanMemberSummary.ts',
  import.meta.url,
);
const vipSurfacePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/vip-surface.ts',
  import.meta.url,
);
const retiredPaths = [
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/storage.ts',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/profileStorage.ts',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/user-center.ts',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/user-center-runtime.ts',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/validation.ts',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/pages/UserCenterPage.tsx',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench-state/src/userProfileState.ts',
];

for (const retiredPath of retiredPaths) {
  assert.equal(
    fs.existsSync(new URL(retiredPath, import.meta.url)),
    false,
    `${retiredPath} must stay deleted; BirdCoder user/VIP state comes from SDKWork IAM and the generated app SDK.`,
  );
}

const userIndexSource = fs.readFileSync(userIndexPath, 'utf8');
const userPageSource = fs.readFileSync(userPagePath, 'utf8');
const vipPageSource = fs.readFileSync(vipPagePath, 'utf8');
const tokenPlanPageSource = fs.readFileSync(tokenPlanPagePath, 'utf8');
const tokenPlanMemberSummarySource = fs.readFileSync(tokenPlanMemberSummaryPath, 'utf8');
const vipSurfaceSource = fs.readFileSync(vipSurfacePath, 'utf8');

for (const [label, source] of [
  ['user index', userIndexSource],
  ['user page', userPageSource],
  ['vip page', vipPageSource],
  ['token plan page', tokenPlanPageSource],
  ['token plan member summary', tokenPlanMemberSummarySource],
]) {
  assert.doesNotMatch(
    source,
    /createBirdCoderRuntimeUserCenterClient|profileStorage|getBirdCoderUserProfileRepository|getBirdCoderVipMembershipRepository|readBirdCoderUserProfile|writeBirdCoderUserProfile|readBirdCoderVipMembership|writeBirdCoderVipMembership|@sdkwork\/vip-pc-react/u,
    `${label} must not expose retired local profile/VIP storage APIs.`,
  );
}

assert.match(
  userPageSource,
  /useAuth\(\)/u,
  'BirdCoder user page must read the authenticated user from the SDKWork IAM-backed AuthContext.',
);
assert.match(
  vipPageSource,
  /const\s+\{\s*user\s*\}\s*=\s*useAuth\(\)/u,
  'BirdCoder VIP page must guard the Token Plan with the authenticated SDKWork IAM user context.',
);
assert.match(
  vipPageSource,
  /<BirdCoderTokenPlanPage[\s\S]*onAuthenticationRequired=\{onAuthenticationRequired\}/u,
  'BirdCoder VIP page must delegate the authenticated surface to the shared Token Plan integration.',
);
assert.match(
  tokenPlanPageSource,
  /from\s+['"]@sdkwork\/membership-pc-subscription\/catalog['"]/u,
  'BirdCoder Token Plan must consume the controlled Membership subscription catalog subpath.',
);
assert.match(
  tokenPlanPageSource,
  /<SdkworkSubscriptionCatalogPage\b/u,
  'BirdCoder Token Plan must render the shared Membership subscription catalog component.',
);
assert.match(
  tokenPlanMemberSummarySource,
  /hasSdkworkMembershipSession/u,
  'BirdCoder Token Plan member state must use the shared Membership session boundary.',
);
assert.match(
  tokenPlanMemberSummarySource,
  /useSdkworkMembershipController\(\)/u,
  'BirdCoder Token Plan member state must use the shared Membership controller.',
);
assert.doesNotMatch(
  `${tokenPlanPageSource}\n${tokenPlanMemberSummarySource}`,
  /fetch\s*\(|axios\.|Authorization|Access-Token|getBirdCoderGeneratedAppSdkClient\(\)\.commerce\.memberships/u,
  'BirdCoder Token Plan must not bypass Membership packages with raw HTTP, manual auth headers, or direct generated commerce calls.',
);
assert.match(
  vipSurfaceSource,
  /vipMembershipService\.loadMembershipState\(\)/u,
  'BirdCoder VIP surface must load membership state through the IDE VIP membership service boundary.',
);
assert.doesNotMatch(
  vipSurfaceSource,
  /getBirdCoderGeneratedAppSdkClient\(\)\.commerce\.memberships/u,
  'BirdCoder VIP surface must not call the generated commerce SDK directly.',
);
assert.doesNotMatch(
  vipSurfaceSource,
  /createSdkworkVipService\(\)|getEmptyDashboard|authToken:\s*user\s*\?\s*user\.id|\/billing\/vip|@sdkwork\/vip-pc-react/u,
  'BirdCoder VIP service must not keep the retired local empty VIP surface or billing/vip alias.',
);

console.log('birdcoder retired user storage contract passed.');
