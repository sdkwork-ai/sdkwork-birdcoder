import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function assertNoMatch(source, forbiddenPattern, label) {
  assert.doesNotMatch(
    source,
    forbiddenPattern,
    `${label} must not expose retired user-center compatibility surface ${forbiddenPattern}.`,
  );
}

function assertNoLegacyUserCenterText(relativePath, label = relativePath) {
  const source = readText(relativePath);
  for (const forbiddenPattern of [
    /SDKWORK_USER_CENTER_/u,
    /VITE_SDKWORK_USER_CENTER_/u,
    /--user-center-provider/u,
    /external-user-center/u,
    /appbase\.user-center/u,
    /sdkwork-user-center/u,
    /@sdkwork\/user-center-/u,
    /\bBirdCoderUserCenter/u,
    /\bBIRDCODER_USER_CENTER_/u,
    /\bUserCenter/u,
    /\buserCenter/u,
    /\buser_center/u,
    /\bUserCenterPage\b/u,
    /\bloadUserCenterPage\b/u,
    /\bbirdcoder-user-center/u,
  ]) {
    assertNoMatch(source, forbiddenPattern, label);
  }
}

function assertNoRetiredAppbaseIamText(relativePath, label = relativePath) {
  const source = readText(relativePath);
  for (const forbiddenPattern of [
    /17-appbase-auth-user-vip/u,
    /14-appbase-auth-user-vip/u,
    /Appbase Auth\/User\/VIP|appbase Auth\/User\/VIP/u,
    /Appbase 主边界|appbase 主边界/u,
    /appbase 接入|appbase 边界|appbase 对接点/u,
    /auth\s*\/\s*user\s*\/\s*vip[\s\S]{0,120}appbase/iu,
    /appbase[\s\S]{0,120}auth\s*\/\s*user\s*\/\s*vip/iu,
    /sdkwork-appbase[\s\S]{0,120}(?:身份|用户中心|会员|IAM|Auth|User|VIP)/u,
    /appbase[\s\S]{0,120}(?:身份|用户中心|会员|IAM|Auth|User|VIP|薄适配)/iu,
    /(?:身份|用户中心|会员|IAM|Auth|User|VIP|薄适配)[\s\S]{0,120}appbase/iu,
    /appbase parity/u,
    /test:user-center-standard/u,
    /iam_vip_membership|iam_account|iam_membership/u,
  ]) {
    assertNoMatch(source, forbiddenPattern, label);
  }
}

const rootPackageJson = readJson('package.json');
for (const [scriptName, command] of Object.entries(rootPackageJson.scripts ?? {})) {
  assertNoMatch(scriptName, /user-center|external/u, `root script name ${scriptName}`);
  assertNoMatch(command, /user-center|external-user-center|--user-center-provider/u, `root script ${scriptName}`);
  assertNoMatch(scriptName, /appbase/i, `root script name ${scriptName}`);
  assertNoMatch(
    command,
    /appbase-package-boundary-contract|birdcoder-iam-appbase-parity-contract/u,
    `root script ${scriptName}`,
  );
}

for (const relativePath of [
  '.env.example',
  'README.md',
  'README.zh-CN.md',
  'docs/superpowers/plans/2026-04-09-birdcoder-data-kernel-implementation.md',
  'docs/架构/17-sdkwork-iam-auth-user-standard.md',
  'docs/step/14-sdkwork-iam-integration.md',
  'docs/step/04-workspace-project-auth-settings治理.md',
  'docs/step/90-架构能力-Step-目录-证据映射矩阵.md',
  'scripts/birdcoder-command-options.mjs',
  'scripts/birdcoder-iam-command-matrix.mjs',
  'scripts/birdcoder-iam-env.mjs',
  'scripts/provider-dialect-contract.test.mjs',
  'scripts/rust-long-id-standard-contract.test.mjs',
  'scripts/shell-user-bootstrap-contract.test.mjs',
  'scripts/show-birdcoder-iam-env.mjs',
  'scripts/run-birdcoder-dev-stack.mjs',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/Cargo.toml',
  'Cargo.lock',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/server-api.ts',
  'deployments/server-windows/x64/openapi/coding-server-v1.json',
  'apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-app-v3.openapi.json',
  'apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-backend-v3.openapi.json',
  'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/types/index.ts',
  'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/sdk.ts',
  'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript/src/types/index.ts',
]) {
  assertNoLegacyUserCenterText(relativePath);
}

for (const relativePath of [
  'docs/guide/development.md',
  'docs/架构/02-架构标准与总体设计.md',
  'docs/架构/03-模块规划与边界.md',
  'docs/架构/07-数据模型-状态模型-接口契约.md',
  'docs/架构/18-多数据库抽象-Provider-迁移标准.md',
  'docs/step/README.md',
  'docs/step/04-workspace-project-auth-settings治理.md',
  'docs/step/90-架构能力-Step-目录-证据映射矩阵.md',
  'docs/step/94-Step并行执行编排与多子Agent车道.md',
  'docs/step/97-Step完成后的架构回写与能力兑现清单.md',
  'docs/step/99-Step总执行矩阵与最短路径总表.md',
]) {
  assertNoRetiredAppbaseIamText(relativePath);
}

for (const retiredPath of [
  '.github/workflows/user-center-upstream-sync.yml',
  'docs/superpowers/plans/2026-04-24-user-vip-account-java-entity-parity.md',
  'docs/superpowers/specs/2026-04-24-user-vip-account-java-entity-parity-design.md',
  'scripts/run-user-center-standard.mjs',
  'scripts/run-user-center-standard.test.mjs',
  'scripts/user-center-standard.test.mjs',
  'scripts/user-center-plugin-contract.test.ts',
  'scripts/user-center-plus-entity-standard-contract.test.mjs',
  'scripts/birdcoder-rust-user-center-validation-contract.test.mjs',
  'scripts/runtime-user-center-bridge-contract.test.mjs',
  'scripts/birdcoder-user-center-runtime-bridge-contract.test.ts',
  'scripts/user-center-upstream-sync-payload.mjs',
  'scripts/user-center-upstream-sync-payload.test.mjs',
  'scripts/user-center-upstream-sync-workflow.test.mjs',
  'scripts/appbase-package-boundary-contract.test.mjs',
  'scripts/birdcoder-iam-appbase-parity-contract.test.mjs',
  'docs/架构/17-appbase-auth-user-vip-统一接入标准.md',
  'docs/step/14-appbase-auth-user-vip-统一接入实施.md',
  'apps/sdkwork-birdcoder-pc/sdks/server',
]) {
  assert.equal(
    fs.existsSync(path.join(rootDir, retiredPath)),
    false,
    `${retiredPath} must be deleted; BirdCoder IAM is not a local user-center compatibility layer.`,
  );
}

const iamIntegrationPlanSource = readText(
  'docs/superpowers/plans/2026-05-25-birdcoder-iam-integration.md',
);
assert.doesNotMatch(
  iamIntegrationPlanSource,
  /^- \[ \]/mu,
  'BirdCoder IAM integration plan must not leave open implementation checklist items after the standard IAM migration lands.',
);

console.log('birdcoder iam no legacy identity contract passed.');
