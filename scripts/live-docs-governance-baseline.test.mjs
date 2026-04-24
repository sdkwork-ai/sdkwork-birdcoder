import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { GOVERNANCE_REGRESSION_CHECKS } from './governance-regression-report.mjs';

const rootDir = process.cwd();
const docsDir = path.join(rootDir, 'docs');
const expectedCheckCount = GOVERNANCE_REGRESSION_CHECKS.length;
const releaseAndDeploymentSource = fs.readFileSync(
  path.join(docsDir, 'core', 'release-and-deployment.md'),
  'utf8',
);
const developmentGuideSource = fs.readFileSync(
  path.join(docsDir, 'guide', 'development.md'),
  'utf8',
);
const commandsReferenceSource = fs.readFileSync(
  path.join(docsDir, 'reference', 'commands.md'),
  'utf8',
);
const step17Source = fs.readFileSync(
  path.join(docsDir, 'step', '17-Coding-Server-Core-App-Admin-API与控制台实现.md'),
  'utf8',
);
const step16Source = fs.readFileSync(
  path.join(docsDir, 'step', '16-Prompt-SkillHub-AppTemplate-项目模板体系.md'),
  'utf8',
);
const step18DSource = fs.readFileSync(
  path.join(docsDir, 'step', '18D-Rust-Host-Engine-Route-Parity-Lane.md'),
  'utf8',
);
const step13Source = fs.readFileSync(
  path.join(docsDir, 'step', '13-发布就绪-github-flow-灰度回滚闭环.md'),
  'utf8',
);
const step06Source = fs.readFileSync(
  path.join(docsDir, 'step', '06-code视图-编辑器-文件系统重构.md'),
  'utf8',
);
const architecture03Source = fs.readFileSync(
  path.join(docsDir, '架构', '03-模块规划与边界.md'),
  'utf8',
);
const architecture19Source = fs.readFileSync(
  path.join(docsDir, '架构', '19-统一会话运行时-Prompt-SkillHub-AppTemplate标准.md'),
  'utf8',
);
const architecture20Source = fs.readFileSync(
  path.join(docsDir, '架构', '20-统一Rust-Coding-Server-API-协议标准.md'),
  'utf8',
);
const architecture25Source = fs.readFileSync(
  path.join(docsDir, '架构', '25-Rust-Host-Engine-Route-Parity-Standard.md'),
  'utf8',
);
const architecture09Source = fs.readFileSync(
  path.join(docsDir, '架构', '09-安装-部署-发布标准.md'),
  'utf8',
);
const architectureReadmeSource = fs.readFileSync(
  path.join(docsDir, '架构', 'README.md'),
  'utf8',
);
const architecture11Source = fs.readFileSync(
  path.join(docsDir, '架构', '11-行业对标与能力矩阵.md'),
  'utf8',
);
const architecture22Source = fs.readFileSync(
  path.join(docsDir, '架构', '22-多Code-Engine源码镜像真相补充标准.md'),
  'utf8',
);
const architecture23Source = fs.readFileSync(
  path.join(docsDir, '架构', '23-Coding-Server-Engine-Truth-Promotion-Standard.md'),
  'utf8',
);
const architecture24Source = fs.readFileSync(
  path.join(docsDir, '架构', '24-Rust-Host-Engine-Truth-Artifact-Standard.md'),
  'utf8',
);
const architecture26Source = fs.readFileSync(
  path.join(docsDir, '架构', '26-Step-18-Engine-Governance-Release-Flow-Standard.md'),
  'utf8',
);

const architectureDocsDirName = fs
  .readdirSync(docsDir, { withFileTypes: true })
  .find(
    (entry) =>
      entry.isDirectory() &&
      fs.existsSync(
        path.join(docsDir, entry.name, '26-Step-18-Engine-Governance-Release-Flow-Standard.md'),
      ),
  )?.name;

assert.ok(
  architectureDocsDirName,
  'docs directory must contain the active architecture standards directory.',
);

const architecture27Source = fs.readFileSync(
  path.join(docsDir, architectureDocsDirName, '27-Step-18-Engine-Governance-Score-Surface-Standard.md'),
  'utf8',
);
const architecture28Source = fs.readFileSync(
  path.join(docsDir, architectureDocsDirName, '28-Governance-Regression-Deterministic-Baseline-Standard.md'),
  'utf8',
);
const architecture29Source = fs.readFileSync(
  path.join(docsDir, architectureDocsDirName, '29-Web-Bundle-Segmentation-And-Production-Build-Standard.md'),
  'utf8',
);

const postgresqlHostPassLiveDocs = [
  'docs/架构/09-安装-部署-发布标准.md',
  'docs/架构/10-开发流程-质量门禁-评估标准.md',
  'docs/step/12-测试矩阵-质量门禁-回归自动化.md',
  'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md',
  'docs/step/17D-PostgreSQL-Live-Smoke-Preflight.md',
  'docs/step/17E-Coding-Server-OpenAPI-Export-And-Server-Release-Sidecar.md',
  'docs/step/17F-Coding-Server-Finalized-OpenAPI-Governance-And-Codegen-Input.md',
  'docs/step/17G-Coding-Server-Finalized-OpenAPI-Types-Codegen-Lane.md',
  'docs/step/17H-Coding-Server-Finalized-Typed-Client-Codegen-Lane.md',
  'docs/step/17I-Coding-Server-Shared-Generated-App-Admin-Facade-Lane.md',
  'docs/step/17J-Default-IDE-Services-Shared-Generated-Facade-Adoption-Lane.md',
  'docs/step/17K-App-Admin-Wrapper-Removal-Lane.md',
  'docs/step/17L-Shared-Core-Read-Facade-Lane.md',
  'docs/step/17M-Shared-Core-Projection-Read-Facade-Lane.md',
  'docs/step/17N-App-Team-Surface-Split-Lane.md',
  'docs/step/17O-Default-IDE-Release-Service-Adoption-Lane.md',
  'docs/step/17P-Default-IDE-Core-Read-Adoption-Lane.md',
  'docs/step/17Q-App-Level-Coding-Session-Projection-Consumer-Adoption-Lane.md',
  'docs/step/17R-Shared-Core-Facade-Exclusion-Governance-Lane.md',
  'docs/step/17S-Real-Core-Create-Coding-Session-Route-Lane.md',
  'docs/step/17T-Typed-Core-Create-Coding-Session-Facade-And-Consumer-Adoption-Lane.md',
  'docs/step/17U-Typed-Core-Create-Coding-Session-Turn-Facade-And-Consumer-Adoption-Lane.md',
  'docs/step/17V-Real-Core-Engine-Capability-And-Model-Catalog-Lane.md',
  'docs/step/17W-Real-Core-Approval-Decision-Lane.md',
  'docs/step/17X-Real-App-Document-Catalog-Lane.md',
  'docs/step/17Y-Real-Admin-Audit-Lane.md',
  'docs/step/17Z-Real-App-Deployment-Catalog-Lane.md',
  'docs/step/17ZA-Real-Admin-Deployment-Governance-Lane.md',
  'docs/step/17ZB-Real-Admin-Policy-Governance-Lane.md',
  'docs/step/18A-Engine-Source-Mirror-Truth-Lane.md',
  'docs/step/18B-Coding-Server-Engine-Truth-Promotion.md',
  'docs/step/18C-Rust-Host-Engine-Truth-Artifact-Lane.md',
  'docs/step/18D-Rust-Host-Engine-Route-Parity-Lane.md',
  'docs/step/18E-Engine-Governance-Release-Flow-Promotion-Lane.md',
  'docs/step/18F-Engine-Governance-Score-Surface-Lane.md',
  'docs/step/18G-Engine-Governance-Packaged-Release-Evidence-Lane.md',
  'docs/step/19-Governance-Regression-Deterministic-Baseline-Lane.md',
  'docs/step/19A-Web-Bundle-Segmentation-And-Production-Build-Lane.md',
];

assert.match(
  releaseAndDeploymentSource,
  new RegExp(`aggregates ${expectedCheckCount} existing checks`),
  'core release-and-deployment doc must freeze the current governance baseline count from the governance report.',
);

assert.match(
  releaseAndDeploymentSource,
  /pnpm check:live-docs-governance-baseline/,
  'core release-and-deployment doc must include the live-docs governance baseline command alongside Step 10 governance verification.',
);

assert.match(
  releaseAndDeploymentSource,
  /pnpm check:quality-matrix/,
  'core release-and-deployment doc must include the quality-matrix contract alongside Step 12 quality verification.',
);

assert.match(
  releaseAndDeploymentSource,
  /pnpm check:identity-standard/,
  'core release-and-deployment doc must include the appbase parity command when release-facing changes touch the unified auth, user, and vip boundary.',
);
assert.match(
  releaseAndDeploymentSource,
  /pnpm test:user-center-standard/,
  'core release-and-deployment doc must include the canonical user-center standard command when release-facing changes touch the unified user-center and validation boundary.',
);

assert.match(
  releaseAndDeploymentSource,
  /pnpm check:package-governance/,
  'core release-and-deployment doc must include the package-governance command when release-facing changes touch workspace package ownership or dependency governance.',
);

assert.match(
  releaseAndDeploymentSource,
  /pnpm check:release-flow/,
  'core release-and-deployment doc must include the release-flow command when release automation or release contracts change.',
);

assert.match(
  releaseAndDeploymentSource,
  /pnpm check:ci-flow/,
  'core release-and-deployment doc must include the ci-flow command when release-facing workflow or CI contract changes need the same executable verification path.',
);

assert.match(
  releaseAndDeploymentSource,
  /pnpm check:desktop/,
  'core release-and-deployment doc must include the desktop verification command when the desktop delivery surface is validated in isolation.',
);

assert.match(
  releaseAndDeploymentSource,
  /pnpm check:server/,
  'core release-and-deployment doc must include the server verification command when the server delivery surface is validated in isolation.',
);

assert.match(
  releaseAndDeploymentSource,
  /`pnpm release:rollback:plan` reuses/,
  'core release-and-deployment doc must describe rollback-plan semantics with the full pnpm command, not only the shorthand release entrypoint name.',
);

assert.match(
  releaseAndDeploymentSource,
  /`pnpm release:plan` -> package\/smoke -> `pnpm release:finalize`/,
  'core release-and-deployment doc must express the re-issue path with full pnpm commands, not only shorthand release entrypoint names.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm lint`/,
  'commands reference must describe the lint command in prose, not only list it in the verification command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm dev`/,
  'commands reference must describe the dev command in prose, not only list it in the development command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm tauri:dev`/,
  'commands reference must describe the tauri dev command in prose, not only list it in the development command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm server:dev`/,
  'commands reference must describe the server dev command in prose, not only list it in the development command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm build`/,
  'commands reference must describe the build command in prose, not only list it in the build command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm docs:build`/,
  'commands reference must describe the docs build command in prose, not only list it in the build command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm check:release-flow`/,
  'commands reference must describe the release-flow command in prose, not only list it in the verification command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm check:ci-flow`/,
  'commands reference must describe the ci-flow command in prose, not only list it in the verification command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm check:governance-regression`/,
  'commands reference must describe the governance-regression command in prose, not only list it in the verification command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm check:multi-mode`/,
  'commands reference must describe the multi-mode command in prose, not only list it in the verification command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm check:quality:release`/,
  'commands reference must describe the release quality gate in prose, not only list it in the verification command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm check:quality:fast`/,
  'commands reference must describe the fast quality gate in prose, not only list it in the verification command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm check:quality:standard`/,
  'commands reference must describe the standard quality gate in prose, not only list it in the verification command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm check:desktop`/,
  'commands reference must describe the desktop verification command in prose, not only list it in the verification command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm check:server`/,
  'commands reference must describe the server verification command in prose, not only list it in the verification command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:plan`/,
  'commands reference must describe the release planning command in prose, not only list it in the release command block or examples.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:rollback:plan`/,
  'commands reference must describe the release rollback planning command in prose, not only list it in the release command block, examples, or fallback notes.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:package:desktop`/,
  'commands reference must describe the desktop release packaging command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:package:server`/,
  'commands reference must describe the server release packaging command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:package:container`/,
  'commands reference must describe the container release packaging command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:package:kubernetes`/,
  'commands reference must describe the kubernetes release packaging command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:package:web`/,
  'commands reference must describe the web release packaging command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:finalize` finalizes the governed release asset set/,
  'commands reference must describe the release finalize command in prose, not only list it in the release command block, examples, or quality evidence note.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:smoke:desktop`/,
  'commands reference must describe the desktop release smoke command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:smoke:server`/,
  'commands reference must describe the server release smoke command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:smoke:container`/,
  'commands reference must describe the container release smoke command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:smoke:kubernetes`/,
  'commands reference must describe the kubernetes release smoke command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:smoke:web`/,
  'commands reference must describe the web release smoke command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:smoke:desktop-packaged-launch`/,
  'commands reference must describe the desktop packaged launch smoke command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:smoke:desktop-startup`/,
  'commands reference must describe the desktop startup smoke command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /`pnpm release:smoke:finalized`/,
  'commands reference must describe the finalized release smoke command in prose, not only list it in the release command block.',
);

assert.match(
  commandsReferenceSource,
  /pnpm check:package-governance/,
  'commands reference must list the package-governance command.',
);

assert.match(
  commandsReferenceSource,
  /pnpm check:quality-matrix/,
  'commands reference must list the quality-matrix command.',
);

assert.match(
  commandsReferenceSource,
  /pnpm check:governance-regression/,
  'commands reference must list the governance regression command.',
);

assert.match(
  commandsReferenceSource,
  /pnpm check:live-docs-governance-baseline/,
  'commands reference must list the live-docs governance baseline command.',
);

assert.match(
  commandsReferenceSource,
  /pnpm check:identity-standard/,
  'commands reference must list the appbase parity command.',
);
assert.match(
  commandsReferenceSource,
  /pnpm test:user-center-standard/,
  'commands reference must list the canonical user-center standard command.',
);
assert.match(
  commandsReferenceSource,
  /`pnpm test:user-center-standard`/,
  'commands reference must describe the canonical user-center standard command in prose, not only list it in the verification command block.',
);

assert.match(
  developmentGuideSource,
  /pnpm dev/,
  'development guide must include the shared web dev command in the core development workflow.',
);

assert.match(
  developmentGuideSource,
  /pnpm tauri:dev/,
  'development guide must include the desktop tauri dev command in the core development workflow.',
);

assert.match(
  developmentGuideSource,
  /pnpm server:dev/,
  'development guide must include the server dev command in the core development workflow.',
);

assert.match(
  developmentGuideSource,
  /`pnpm lint`/,
  'development guide must describe the lint command in prose, not only list it in the core commands block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm build`/,
  'development guide must describe the build command in prose, not only list it in the core commands block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm docs:build`/,
  'development guide must describe the docs build command in prose, not only list it in the core commands block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:multi-mode`/,
  'development guide must describe the multi-mode command in prose, not only list it in the core commands block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:desktop`/,
  'development guide must describe the desktop verification command in prose when the targeted desktop delivery surface is validated in isolation.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:server`/,
  'development guide must describe the server verification command in prose when the targeted server delivery surface is validated in isolation.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:package-governance`/,
  'development guide must describe the package-governance command in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:identity-standard`/,
  'development guide must describe the appbase parity command in prose, not only list it in the release-oriented verification block.',
);
assert.match(
  developmentGuideSource,
  /`pnpm test:user-center-standard`/,
  'development guide must describe the canonical user-center standard command in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:quality:fast`/,
  'development guide must describe the fast quality gate in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:quality:standard`/,
  'development guide must describe the standard quality gate in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:quality:release`/,
  'development guide must describe the release quality gate in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm quality:report`/,
  'development guide must describe the quality matrix report command in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm quality:execution-report`/,
  'development guide must describe the quality execution report command in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:release-flow`/,
  'development guide must describe the release-flow command in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:ci-flow`/,
  'development guide must describe the ci-flow command in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:governance-regression`/,
  'development guide must describe the governance-regression command in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:live-docs-governance-baseline`/,
  'development guide must describe the live-docs governance baseline command in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /`pnpm check:quality-matrix`/,
  'development guide must describe the quality-matrix command in prose, not only list it in the release-oriented verification block.',
);

assert.match(
  developmentGuideSource,
  /pnpm check:governance-regression/,
  'development guide must include the governance regression command in the release-oriented verification flow.',
);

assert.match(
  developmentGuideSource,
  /pnpm check:live-docs-governance-baseline/,
  'development guide must include the live-docs governance baseline command in the release-oriented verification flow.',
);

assert.match(
  developmentGuideSource,
  /pnpm check:quality:fast/,
  'development guide must include the fast quality gate in the release-oriented verification flow.',
);

assert.match(
  developmentGuideSource,
  /pnpm check:quality:standard/,
  'development guide must include the standard quality gate in the release-oriented verification flow.',
);

assert.match(
  developmentGuideSource,
  /pnpm check:quality:release/,
  'development guide must include the release quality gate in the release-oriented verification flow.',
);

assert.match(
  developmentGuideSource,
  /pnpm quality:report/,
  'development guide must include the quality matrix report command in the release-oriented verification flow.',
);

assert.match(
  developmentGuideSource,
  /pnpm quality:execution-report/,
  'development guide must include the runtime quality execution report command in the release-oriented verification flow.',
);

assert.match(
  developmentGuideSource,
  /pnpm check:identity-standard/,
  'development guide must include the appbase parity command in the release-oriented verification flow.',
);
assert.match(
  developmentGuideSource,
  /pnpm test:user-center-standard/,
  'development guide must include the canonical user-center standard command in the release-oriented verification flow.',
);

assert.match(
  developmentGuideSource,
  /pnpm check:desktop/,
  'development guide must include the desktop verification command in the release-oriented verification flow.',
);

assert.match(
  developmentGuideSource,
  /pnpm check:server/,
  'development guide must include the server verification command in the release-oriented verification flow.',
);

const staleStep17Patterns = [
  /OpenAPI 自动生成与 SDK 生成流水线/,
  /完整 Rust route parity、真实 SQL Provider\/UoW、控制台、SDK 自动生成仍未闭环。/,
  /The next Step 17 serial gap on this lane is downstream SDK\/codegen/,
  /The next Step 17 serial gap on this lane is producing the first real generated SDK\/codegen artifact/,
  /The next Step 17 serial gap on this lane is generating a typed client\/helper surface/,
  /The next Step 17 serial gap on this lane is moving representative generated-client adoption behind shared high-level facades/,
  /The next Step 17 serial gap on this lane is broadening the same shared-facade pattern/,
  /The next Step 17 serial gap on this lane is extending the same direct shared-facade adoption/,
  /The next Step 17 serial gap on this lane is repeating the same hard cutover/,
  /PostgreSQL live smoke remains an environment gate\./,
  /PostgreSQL live smoke remains the only Step 17 serial environment gate\./,
  /Step 17 still has one environment gate only: DSN-backed `pnpm\.cmd run release:smoke:postgresql-live` must return `passed` before PostgreSQL closure can be claimed\./,
];

for (const pattern of staleStep17Patterns) {
  assert.doesNotMatch(
    step17Source,
    pattern,
    `Step 17 docs must not preserve stale closure drift: ${pattern}`,
  );
}

assert.match(
  step17Source,
  /Remaining representative placeholder routes are now:\s*\r?\n\s*- none/,
  'Step 17 docs must record that representative placeholder routes are fully closed.',
);

assert.match(
  step17Source,
  /Step 17 no longer has a remaining non-environmental representative route gap\./,
  'Step 17 docs must record that non-environmental representative route closure is complete.',
);

assert.match(
  step17Source,
  /PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`\./,
  'Step 17 docs must record the host-real PostgreSQL closure and rerun semantics.',
);

const staleArchitecture20Patterns = [
  /Next gap: downstream SDK\/codegen and finalized release governance must consume the canonical exported snapshot/,
  /Next gap: implement the first real SDK\/codegen generation lane on top of this finalized manifest summary/,
  /Next gap: build a second-stage typed SDK\/client generation lane that consumes `packages\/sdkwork-birdcoder-types\/src\/generated\/coding-server-openapi\.ts`/,
  /Next gap: move representative generated-client adoption behind shared high-level facades for the remaining `core \/ app \/ admin` consumers/,
  /Next gap: broaden the same shared-facade pattern across the remaining shared `core \/ app \/ admin` consumers/,
  /Next gap: extend the same direct shared-facade composition rule to the remaining shared `core \/ app \/ admin` transport consumers/,
  /Next gap: repeat the same .*transport only in infrastructure, high-level facade in types.* hard cutover/,
  /Next gap: extend the same shared-facade rule to the next batch of already implemented core projection reads/,
  /Next gap: broaden shared-facade adoption across the remaining `core \/ app \/ admin` transport consumers/,
  /Next gap: continue shared-facade adoption on the remaining real transport consumers/,
  /next non-environmental serial slice is the first representative app\/admin route still returning `not_implemented`/,
  /Remaining representative placeholder routes are now:\s*\r?\n\s*- `GET \/api\/app\/v1\/deployments`/,
  /Remaining representative placeholder routes are now:\s*\r?\n\s*- `GET \/api\/admin\/v1\/policies`/,
  /keep PostgreSQL live smoke blocked until a DSN-backed environment exists/,
  /The only remaining Step 17 serial blocker is PostgreSQL live smoke in a DSN-backed environment; do not fabricate that closure in blocked environments\./,
];

for (const pattern of staleArchitecture20Patterns) {
  assert.doesNotMatch(
    architecture20Source,
    pattern,
    `architecture 20 docs must not preserve stale Step 17 closure drift: ${pattern}`,
  );
}

assert.match(
  architecture20Source,
  /Remaining representative placeholder routes are now:\s*\r?\n\s*- none/,
  'architecture 20 docs must record that representative placeholder routes are fully closed.',
);

assert.match(
  architecture20Source,
  /PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`\./,
  'architecture 20 docs must record the host-real PostgreSQL closure and rerun semantics.',
);

const staleStep16Patterns = [
  /`CP16-3`：下一串行目标。/,
];

for (const pattern of staleStep16Patterns) {
  assert.doesNotMatch(
    step16Source,
    pattern,
    `Step 16 docs must not preserve stale closure drift: ${pattern}`,
  );
}

assert.match(
  step16Source,
  /`CP16-3`：已关闭。/,
  'Step 16 docs must record that CP16-3 is now closed in the current-status summary.',
);

assert.match(
  step16Source,
  /Step 16 `CP16-3` is now fully closed\./,
  'Step 16 docs must record that the coding-server consumer slice closed the final CP16-3 gap.',
);

const staleArchitecture19Patterns = [
  /remaining Step 16 work stays on coding-server and service consumer adoption\./,
];

for (const pattern of staleArchitecture19Patterns) {
  assert.doesNotMatch(
    architecture19Source,
    pattern,
    `architecture 19 docs must not preserve stale Step 16 closure drift: ${pattern}`,
  );
}

assert.match(
  architecture19Source,
  /Step 16 `CP16-3` is now fully closed\./,
  'architecture 19 docs must record that Step 16 CP16-3 is fully closed.',
);

const staleStep18DPatterns = [
  /The next non-environmental Step 18 target is promoting existing `engine-runtime-adapter`, `engine-conformance`, `tool-protocol-contract`, and `engine-resume-recovery-contract` checks into release-flow governance\./,
];

for (const pattern of staleStep18DPatterns) {
  assert.doesNotMatch(
    step18DSource,
    pattern,
    `Step 18D docs must not preserve stale closure drift: ${pattern}`,
  );
}

assert.match(
  step18DSource,
  /future loops must not reopen Step 18 route parity without fresh failing evidence\./,
  'Step 18D docs must record that future loops must not reopen route parity without fresh failing evidence.',
);

const staleArchitecture25Patterns = [
  /Promote the remaining Step 18 executable governance commands for engine runtime adapter, tool protocol, resume\/recovery, and conformance into `check:release-flow` so the full engine-adapter lane stops depending on ad hoc root-command runs\./,
];

for (const pattern of staleArchitecture25Patterns) {
  assert.doesNotMatch(
    architecture25Source,
    pattern,
    `architecture 25 docs must not preserve stale Step 18 closure drift: ${pattern}`,
  );
}

assert.match(
  architecture25Source,
  /This standard is now fully closed; future loops should select the next lowest-score non-environmental slice instead of reopening Step 18 route parity governance promotion\./,
  'architecture 25 docs must record that route-parity governance promotion is fully closed.',
);

const staleArchitecture09NextTargetPatterns = [
  /`packages\/sdkwork-birdcoder-server\/src-host\/src\/main\.rs` 仍是最小 Rust host，仅暴露 `\/health`；完整 `core \/ app \/ admin` 服务面仍属于后续实现项。/,
  /`coding-server` 的协议标准已冻结，但 Rust host 尚未完成 OpenAPI、SSE、鉴权中间件与资源路由全量落地。/,
];

for (const pattern of staleArchitecture09NextTargetPatterns) {
  assert.doesNotMatch(
    architecture09Source,
    pattern,
    `architecture 09 docs must not preserve stale coding-server maturity drift: ${pattern}`,
  );
}

assert.match(
  architecture09Source,
  /Rust host 已在统一 `coding-server` 协议面上落地代表性 `core \/ app \/ admin` 路由、canonical OpenAPI 导出与发布侧证据链；Representative placeholder routes 当前真相为 `none`。/,
  'architecture 09 docs must record the representative core/app/admin route and OpenAPI release-evidence closure.',
);

assert.match(
  architecture09Source,
  /`coding-server` 的协议标准、代表性资源路由、OpenAPI 发布证据链与 PostgreSQL host-pass 当前真相已经闭环；未来循环只应在 fresh failing evidence 下重开该成熟度摘要。/,
  'architecture 09 docs must record the current coding-server maturity summary instead of the earlier minimal-host placeholder state.',
);

const staleArchitectureReadmePatterns = [
  /`coding-server` 协议标准已冻结，但 Rust 宿主当前仍处在最小 host 骨架阶段，`core \/ app \/ admin` 真实实现仍是后续主线。/,
];

for (const pattern of staleArchitectureReadmePatterns) {
  assert.doesNotMatch(
    architectureReadmeSource,
    pattern,
    `architecture README must not preserve stale coding-server maturity drift: ${pattern}`,
  );
}

assert.match(
  architectureReadmeSource,
  /`coding-server` 协议标准、代表性 `core \/ app \/ admin` 路由、canonical OpenAPI 导出与发布侧证据链已闭环；Rust host 不再处于最小 host 骨架阶段，Representative placeholder routes 当前真相为 `none`。/,
  'architecture README must record the closed coding-server route and OpenAPI maturity truth.',
);

assert.match(
  architectureReadmeSource,
  /PostgreSQL live smoke 已在当前主机记录 DSN-backed `passed` 报告；未来缺失 DSN\/driver 时保持 `blocked`，未来 DSN-backed 运行时连通性回归时保持结构化 `failed`。/,
  'architecture README must record the host-real PostgreSQL live-smoke truth.',
);

const staleArchitecture11Patterns = [
  /`coding-server` 仍是最小 host 骨架，真实多引擎 adapter、统一工具协议与服务端编排尚未全量落地。/,
];

for (const pattern of staleArchitecture11Patterns) {
  assert.doesNotMatch(
    architecture11Source,
    pattern,
    `architecture 11 docs must not preserve stale coding-server or engine-maturity drift: ${pattern}`,
  );
}

assert.match(
  architecture11Source,
  /`coding-server` 代表性 `core \/ app \/ admin` 路由、canonical OpenAPI 发布证据与多引擎 canonical runtime 已闭环；Step 18 当前主线只在新增引擎接入或 fresh failing evidence 下重开。/,
  'architecture 11 docs must record the closed coding-server and Step 18 maturity truth.',
);

const staleArchitecture22Patterns = [
  /下一步不是重复修镜像文案，而是把同一份共享 engine descriptor \/ model-catalog 真相继续下沉到 `coding-server`，减少 workbench 与 server 的重复定义。/,
];

for (const pattern of staleArchitecture22Patterns) {
  assert.doesNotMatch(
    architecture22Source,
    pattern,
    `architecture 22 docs must not preserve stale Step 18B next-target drift: ${pattern}`,
  );
}

assert.match(
  architecture22Source,
  /共享 engine descriptor \/ model-catalog 向 `coding-server` 的真相下沉已在后续 Step 18B 闭环；当前镜像标准只在源码镜像真相本身出现 fresh failing evidence 时重开。/,
  'architecture 22 docs must record that the coding-server engine-truth promotion lane already closed.',
);

const staleArchitecture23Patterns = [
  /Reduce Rust host duplication by proving `\/api\/core\/v1\/engines`, `\/api\/core\/v1\/engines\/:engineKey\/capabilities`, and `\/api\/core\/v1\/models` stay aligned with the promoted `coding-server` engine truth\./,
];

for (const pattern of staleArchitecture23Patterns) {
  assert.doesNotMatch(
    architecture23Source,
    pattern,
    `architecture 23 docs must not preserve stale Step 18C\/18D next-target drift: ${pattern}`,
  );
}

assert.match(
  architecture23Source,
  /The later Rust host artifact-adoption and route-parity lanes are already closed historical follow-ons; future loops must not reopen this standard as an active next target without fresh failing evidence on the promoted engine truth itself\./,
  'architecture 23 docs must record that the later Rust host follow-on lanes are already closed.',
);

const staleArchitecture24Patterns = [
  /Promote HTTP-level parity so actual Rust route responses for engine descriptors, capabilities, and models are compared end-to-end against the generated shared artifact under executable governance\./,
];

for (const pattern of staleArchitecture24Patterns) {
  assert.doesNotMatch(
    architecture24Source,
    pattern,
    `architecture 24 docs must not preserve stale Step 18D next-target drift: ${pattern}`,
  );
}

assert.match(
  architecture24Source,
  /The later HTTP-level route-parity lane is already a closed historical follow-on; future loops must not reopen this standard as an active next target without fresh failing evidence on the generated Rust engine artifact itself\./,
  'architecture 24 docs must record that the later HTTP-level route-parity lane is already closed.',
);

const staleArchitecture26Patterns = [
  /Promote the same Step 18 governance quartet into governance regression and quality-matrix reporting so score-based loop decisions can see engine-adapter risk directly, not only through raw release-flow failures\./,
];

for (const pattern of staleArchitecture26Patterns) {
  assert.doesNotMatch(
    architecture26Source,
    pattern,
    `architecture 26 docs must not preserve stale Step 18F next-target drift: ${pattern}`,
  );
}

assert.match(
  architecture26Source,
  /The later governance-regression and quality-matrix score-surface lane is already a closed historical follow-on; future loops must not reopen this standard as an active next target without fresh failing evidence on the release-flow-governed Step 18 quartet itself\./,
  'architecture 26 docs must record that the later governance-regression and score-surface lane is already closed.',
);

const staleArchitecture27Patterns = [
  /This standard is now fully closed; after PostgreSQL live-smoke recheck, move to the next lowest-score non-environmental slice instead of reopening Step 18 score-surface or packaged-evidence promotion\./,
];

for (const pattern of staleArchitecture27Patterns) {
  assert.doesNotMatch(
    architecture27Source,
    pattern,
    `architecture 27 docs must not preserve stale PostgreSQL-recheck next-target drift: ${pattern}`,
  );
}

assert.match(
  architecture27Source,
  /This standard is now fully closed; PostgreSQL live smoke already has a recorded DSN-backed `passed` report on this host, so future loops must select the next lowest-score non-environmental slice instead of reopening Step 18 score-surface or packaged-evidence promotion\./,
  'architecture 27 docs must record that PostgreSQL host-pass is already closed on this host.',
);

const staleArchitecture28Patterns = [
  /The Step 18 packaged release-evidence promotion is now closed; after PostgreSQL live-smoke recheck, select the next lowest-score non-environmental slice instead of reopening this packaged-evidence work\./,
];

for (const pattern of staleArchitecture28Patterns) {
  assert.doesNotMatch(
    architecture28Source,
    pattern,
    `architecture 28 docs must not preserve stale PostgreSQL-recheck next-target drift: ${pattern}`,
  );
}

assert.match(
  architecture28Source,
  /The Step 18 packaged release-evidence promotion is now closed; PostgreSQL live smoke already has a recorded DSN-backed `passed` report on this host, so future loops must select the next lowest-score non-environmental slice instead of reopening this packaged-evidence work\./,
  'architecture 28 docs must record that PostgreSQL host-pass is already closed on this host.',
);

const staleArchitecture29Patterns = [
  /The Step 18 packaged release-evidence promotion is now closed; do not reopen bundle-boundary work to carry engine-governance context into packaged evidence because that handoff is already frozen in finalized `qualityEvidence`\./,
];

for (const pattern of staleArchitecture29Patterns) {
  assert.doesNotMatch(
    architecture29Source,
    pattern,
    `architecture 29 docs must not preserve stale packaged-evidence next-target drift: ${pattern}`,
  );
}

assert.match(
  architecture29Source,
  /The Step 18 packaged release-evidence promotion is already a closed historical follow-on; future loops must select the next lowest-score non-environmental slice instead of reopening bundle-boundary work unless fresh failing evidence appears on the governed bundle boundary or finalized `qualityEvidence` handoff itself\./,
  'architecture 29 docs must record that the packaged-evidence handoff is already a closed historical follow-on.',
);

const staleStep13RuntimeBlockerPatterns = [
  /This loop closes release-evidence truthfulness only; the next non-environmental runtime blocker is the remaining nested `pnpm run` lane inside `check:release-flow`, which still prevents a fully green `check:quality:fast`\./,
];

for (const pattern of staleStep13RuntimeBlockerPatterns) {
  assert.doesNotMatch(
    step13Source,
    pattern,
    `Step 13 docs must not preserve stale nested-wrapper runtime blocker truth: ${pattern}`,
  );
}

assert.match(
  step13Source,
  /This loop closes release-evidence truthfulness only; at that checkpoint, the next non-environmental runtime blocker was the remaining nested `pnpm run` lane inside `check:release-flow`, and the later closure is recorded in `docs\/release\/release-2026-04-13-02\.md`\./,
  'Step 13 docs must keep the nested-wrapper runtime blocker note as superseded checkpoint history only.',
);

const staleStep06MainlineReturnPatterns = [
  /Step 06 is now fully closed on `CP06-1`, `CP06-2`, and all three `CP06-3` slices; the next serial closure must return to the `09 -> 17` mainline\./,
];

for (const pattern of staleStep06MainlineReturnPatterns) {
  assert.doesNotMatch(
    step06Source,
    pattern,
    `Step 06 docs must not preserve stale 09->17 mainline next-target truth: ${pattern}`,
  );
}

assert.match(
  step06Source,
  /Step 06 is now fully closed on `CP06-1`, `CP06-2`, and all three `CP06-3` slices; at that checkpoint, the next serial closure had to return to the `09 -> 17` mainline, and the later Step 17, Step 18, and Step `20` follow-on closures are recorded in `docs\/release\/release-2026-04-13-04\.md`, `docs\/release\/release-2026-04-13-05\.md`, and `docs\/release\/release-2026-04-13-08\.md`\./,
  'Step 06 docs must keep the 09->17 mainline return note as superseded checkpoint history only.',
);

const staleArchitecture03MainlineReturnPatterns = [
  /Step 06 is now fully closed; the next serial closure must return to the `09 -> 17` mainline instead of reopening the Code page shell\./,
];

for (const pattern of staleArchitecture03MainlineReturnPatterns) {
  assert.doesNotMatch(
    architecture03Source,
    pattern,
    `architecture 03 docs must not preserve stale 09->17 mainline next-target truth: ${pattern}`,
  );
}

assert.match(
  architecture03Source,
  /Step 06 is now fully closed; at that checkpoint, the next serial closure had to return to the `09 -> 17` mainline instead of reopening the Code page shell, and the later Step 17, Step 18, and Step `20` follow-on closures are recorded in `docs\/release\/release-2026-04-13-04\.md`, `docs\/release\/release-2026-04-13-05\.md`, and `docs\/release\/release-2026-04-13-08\.md`\./,
  'architecture 03 docs must keep the 09->17 mainline return note as superseded checkpoint history only.',
);

const staleArchitecture09Patterns = [
  /the next non-environmental serial slice is real `engineCapabilities` \/ `models` server truth, not reopening already-closed session\/turn write work/,
];

for (const pattern of staleArchitecture09Patterns) {
  assert.doesNotMatch(
    architecture09Source,
    pattern,
    `architecture 09 docs must not preserve stale engine/model next-target drift: ${pattern}`,
  );
}

assert.match(
  architecture09Source,
  /at that checkpoint, the next non-environmental serial slice was real `engineCapabilities` \/ `models` server truth instead of reopening already-closed session\/turn write work, and the later closure is recorded in `docs\/release\/release-2026-04-11-12\.md`\./,
  'architecture 09 docs must keep the engine/model next-target note as superseded checkpoint history only.',
);

const staleArchitecture20NextTargetPatterns = [
  /the next non-environmental serial slice is closing real `core\.getEngineCapabilities` \/ `core\.listModels` behavior plus shared-facade adoption while `core\.submitApprovalDecision` stays blocked until approvals are real/,
];

for (const pattern of staleArchitecture20NextTargetPatterns) {
  assert.doesNotMatch(
    architecture20Source,
    pattern,
    `architecture 20 docs must not preserve stale engine/model next-target drift: ${pattern}`,
  );
}

assert.match(
  architecture20Source,
  /at that checkpoint, the next non-environmental serial slice was closing real `core\.getEngineCapabilities` \/ `core\.listModels` behavior plus shared-facade adoption while `core\.submitApprovalDecision` was still blocked until approvals became real, and the later closure is recorded in `docs\/release\/release-2026-04-11-12\.md`\./,
  'architecture 20 docs must keep the engine/model next-target note as superseded checkpoint history only.',
);

const postgresqlHostPassTruthPattern =
  /PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`\./;

const stalePostgresqlHostPassPatterns = [
  /Keep PostgreSQL live smoke blocked until/,
  /Keep PostgreSQL live smoke environment-blocked until/,
  /Keep PostgreSQL live smoke as environment-blocked unless/,
  /remains environment-gated/,
  /remains the sole Step 17 environment gate/,
  /PostgreSQL live smoke remains an independent environment gate/,
  /PostgreSQL live smoke remains independently blocked/,
  /PostgreSQL live smoke remains environment-blocked/,
  /PostgreSQL live smoke remains explicitly blocked when no real DSN is configured/,
  /PostgreSQL live smoke was re-run in the current loop and remains explicitly blocked/,
  /PostgreSQL live smoke was not reopened; it remains environment-blocked/,
  /DSN-backed PostgreSQL live smoke remains the active environment gate/,
  /PostgreSQL live smoke remains the active environment gate/,
];

for (const relativePath of postgresqlHostPassLiveDocs) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

  assert.match(
    source,
    postgresqlHostPassTruthPattern,
    `${relativePath} must record the host-real PostgreSQL live-smoke passed truth.`,
  );

  for (const pattern of stalePostgresqlHostPassPatterns) {
    assert.doesNotMatch(
      source,
      pattern,
      `${relativePath} must not preserve stale PostgreSQL blocked-state current truth: ${pattern}`,
    );
  }
}

const stalePatterns = [
  /72 contract-first checks/,
  /74 checks/,
  /72\/72/,
  /74\/74/,
  /76\s*项(?:既有)?(?:合同)?检查/,
];

const staleMatches = [];
const stack = [docsDir];
while (stack.length > 0) {
  const currentPath = stack.pop();
  const stat = fs.statSync(currentPath);

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      stack.push(path.join(currentPath, entry.name));
    }
    continue;
  }

  if (!currentPath.endsWith('.md')) {
    continue;
  }

  const relativePath = path.relative(rootDir, currentPath).split(path.sep).join('/');
  if (relativePath.startsWith('docs/release/')) {
    continue;
  }

  const source = fs.readFileSync(currentPath, 'utf8');
  const countMentions = Array.from(
    source.matchAll(/\b(\d+)(?: contract-first)? checks\b/g),
    (match) => Number(match[1]),
  );
  for (const count of countMentions) {
    if (count !== expectedCheckCount) {
      staleMatches.push(`${relativePath}: ${count} checks`);
    }
  }

  const chineseCountMentions = Array.from(
    source.matchAll(/(\d+)\s*项(?:既有)?(?:合同)?检查/g),
    (match) => Number(match[1]),
  );
  for (const count of chineseCountMentions) {
    if (count !== expectedCheckCount) {
      staleMatches.push(`${relativePath}: ${count} 项检查`);
    }
  }

  const ratioMentions = Array.from(
    source.matchAll(/\b(\d+)\/(\d+)\b/g),
    (match) => [Number(match[1]), Number(match[2])],
  );
  for (const [lhs, rhs] of ratioMentions) {
    if (lhs === rhs && lhs !== expectedCheckCount) {
      staleMatches.push(`${relativePath}: ${lhs}/${rhs}`);
    }
  }

  for (const pattern of stalePatterns) {
    const match = source.match(pattern);
    if (match) {
      staleMatches.push(`${relativePath}: ${match[0]}`);
    }
  }
}

assert.deepEqual(
  staleMatches,
  [],
  `live docs must not keep stale governance baseline counts:\n${staleMatches.join('\n')}`,
);

console.log('live docs governance baseline contract passed.');
