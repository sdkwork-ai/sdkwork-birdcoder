import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const frameworkRef = 'b1bdb5887f0f9e5683a46a02eaeb818c042b8a33';
const packageWorkflowPath = '.github/workflows/package.yml';
const workflowConfigPath = 'sdkwork.workflow.json';
const lifecyclePath = 'scripts/release/sdkwork-workflow-lifecycle.mjs';

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8').replaceAll('\r\n', '\n');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertFileExists(relativePath) {
  assert.equal(fs.existsSync(path.join(rootDir, relativePath)), true, `Expected file to exist: ${relativePath}`);
}

function assertFileMissing(relativePath) {
  assert.equal(fs.existsSync(path.join(rootDir, relativePath)), false, `Legacy release workflow must be removed: ${relativePath}`);
}

function lifecycleRunForPhase(config, phase) {
  const steps = config.lifecycle?.[phase];
  assert.ok(Array.isArray(steps), `sdkwork.workflow.json must declare lifecycle.${phase}.`);
  assert.equal(steps.length, 1, `lifecycle.${phase} must delegate through one governed dispatcher step.`);
  return String(steps[0]?.run ?? '');
}

function findTarget(config, targetId) {
  const target = config.targets.find((candidate) => candidate.id === targetId);
  assert.ok(target, `sdkwork.workflow.json must include standard target ${targetId}.`);
  return target;
}

function assertTarget(config, targetId, expected) {
  const target = findTarget(config, targetId);
  for (const [key, value] of Object.entries(expected)) {
    if (Array.isArray(value)) {
      assert.deepEqual(target[key], value, `${targetId}.${key}`);
      continue;
    }

    assert.equal(target[key], value, `${targetId}.${key}`);
  }
}

function assertSourceIncludes(source, pattern, message) {
  assert.match(source, pattern instanceof RegExp ? pattern : new RegExp(escapeRegex(pattern), 'u'), message);
}

assertFileExists(packageWorkflowPath);
assertFileExists(workflowConfigPath);
assertFileExists(lifecyclePath);
assertFileMissing('.github/workflows/release.yml');
assertFileMissing('.github/workflows/release-reusable.yml');

const packageWorkflow = read(packageWorkflowPath);
const workflowConfig = readJson(workflowConfigPath);
const lifecycleSource = read(lifecyclePath);
const rootPackageJson = readJson('package.json');
const dockerfileSource = read('deployments/docker/Dockerfile');
const releaseFlowRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-release-flow-check.mjs')).href
);
const lifecycleModule = await import(
  pathToFileURL(path.join(rootDir, lifecyclePath)).href
);

function commandPlanText(commands) {
  return commands.map((command) => `${command.program} ${command.args.join(' ')}`).join('\n');
}

function writeJsonFixture(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

assert.match(packageWorkflow, /name:\s*Package Application/u);
assert.match(packageWorkflow, /push:\s*[\s\S]*tags:\s*[\s\S]*-\s*'release-\*'/u);
assert.match(
  packageWorkflow,
  new RegExp(`uses:\\s*Sdkwork-Cloud/sdkwork-github-workflow/\\.github/workflows/sdkwork-package\\.yml@${frameworkRef}`, 'u'),
  'package workflow must call the pinned shared sdkwork-github-workflow reusable workflow.',
);
assert.match(packageWorkflow, new RegExp(`framework_ref:\\s*${frameworkRef}`, 'u'));
assert.match(packageWorkflow, /secrets:\s*inherit/u);
for (const permission of ['contents: write', 'actions: read', 'id-token: write', 'attestations: write', 'packages: write']) {
  assert.match(packageWorkflow, new RegExp(escapeRegex(permission), 'u'), `package workflow must declare ${permission}.`);
}
for (const forwardedInput of ['tag', 'package_version', 'platform', 'architecture', 'profile', 'variant', 'format']) {
  assert.match(packageWorkflow, new RegExp(`${forwardedInput}:\\s*\\$\\{\\{`, 'u'), `package workflow must forward ${forwardedInput}.`);
}
assert.match(packageWorkflow, /publish_release:\s*true/u);
assert.match(packageWorkflow, /upload_artifact:\s*true/u);
assert.match(packageWorkflow, /dependency_refs_json:\s*'\{\}'/u);

for (const forbiddenLocalAction of [
  'softprops/action-gh-release',
  'actions/upload-artifact',
  'actions/download-artifact',
  'docker/build-push-action',
  'azure/setup-helm',
  'azure/setup-kubectl',
  'webfactory/ssh-agent',
]) {
  assert.doesNotMatch(
    packageWorkflow,
    new RegExp(escapeRegex(forbiddenLocalAction), 'u'),
    `BirdCoder must not copy ${forbiddenLocalAction} into its local package workflow.`,
  );
}

assert.equal(workflowConfig.schemaVersion, '2026-06-06.sdkwork.workflow.v1');
assert.deepEqual(workflowConfig.app, {
  id: 'sdkwork-birdcoder',
  name: 'SDKWork BirdCoder',
  repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
  sourcePath: '.',
  configPath: 'sdkwork.app.config.json',
});
assert.equal(workflowConfig.release.artifactPrefix, 'sdkwork-birdcoder');
assert.equal(workflowConfig.release.defaultVersion, '0.1.0');
assert.equal(workflowConfig.release.changelog.source, 'auto');
assert.equal(workflowConfig.publish.workflowArtifact, true);
assert.equal(workflowConfig.publish.githubRelease, true);
assert.equal(workflowConfig.publish.aggregateRelease, true);
assert.equal(workflowConfig.publish.aggregateArtifactPath, 'release-assets');
assert.deepEqual(workflowConfig.publish.aggregateUploadGlobs, ['release-assets/**/*']);
assert.equal(workflowConfig.security.artifactAttestations, true);

for (const phase of ['preflight', 'install', 'build', 'package', 'validate', 'publish']) {
  assertSourceIncludes(
    lifecycleRunForPhase(workflowConfig, phase),
    `node scripts/release/sdkwork-workflow-lifecycle.mjs ${phase}`,
    `lifecycle.${phase} must route through the governed BirdCoder lifecycle dispatcher.`,
  );
}

for (const targetId of [
  'windows-x64-desktop-exe',
  'windows-x64-desktop-msi',
  'windows-arm64-desktop-exe',
  'linux-debian-x64-desktop-deb',
  'linux-rhel-x64-desktop-rpm',
  'linux-x64-desktop-appimage',
  'linux-debian-arm64-desktop-deb',
  'linux-arm64-desktop-appimage',
  'macos-x64-desktop-tar-gz',
  'macos-x64-desktop-dmg',
  'macos-arm64-desktop-tar-gz',
  'macos-arm64-desktop-dmg',
  'windows-x64-server-tar-gz',
  'windows-arm64-server-tar-gz',
  'linux-x64-server-tar-gz',
  'linux-arm64-server-tar-gz',
  'macos-x64-server-tar-gz',
  'macos-arm64-server-tar-gz',
  'web-noarch-web-tar-gz',
  'container-x64-server-cpu-tar-gz',
  'container-x64-server-nvidia-cuda-tar-gz',
  'container-x64-server-amd-rocm-tar-gz',
  'container-arm64-server-cpu-tar-gz',
  'container-x64-server-cpu-helm',
  'container-x64-server-nvidia-cuda-helm',
  'container-x64-server-amd-rocm-helm',
  'container-arm64-server-cpu-helm',
]) {
  findTarget(workflowConfig, targetId);
}

assertTarget(workflowConfig, 'windows-x64-desktop-exe', {
  profile: 'desktop',
  platform: 'windows',
  architecture: 'x64',
  formats: ['exe'],
  runner: 'windows-2022',
});
assertTarget(workflowConfig, 'windows-x64-desktop-msi', {
  profile: 'desktop',
  platform: 'windows',
  architecture: 'x64',
  formats: ['msi'],
  runner: 'windows-2022',
});
assertTarget(workflowConfig, 'linux-rhel-x64-desktop-rpm', {
  profile: 'desktop',
  platform: 'linux',
  distribution: 'rhel',
  architecture: 'x64',
  formats: ['rpm'],
  runner: 'ubuntu-24.04',
});
assertTarget(workflowConfig, 'web-noarch-web-tar-gz', {
  profile: 'web',
  platform: 'web',
  architecture: 'noarch',
  formats: ['tar.gz'],
  runner: 'ubuntu-24.04',
});
assertTarget(workflowConfig, 'container-x64-server-nvidia-cuda-tar-gz', {
  profile: 'server',
  platform: 'container',
  architecture: 'x64',
  variant: 'nvidia-cuda',
  formats: ['tar.gz'],
  runner: 'ubuntu-24.04',
});
assertTarget(workflowConfig, 'container-x64-server-cpu-helm', {
  profile: 'server',
  platform: 'container',
  architecture: 'x64',
  variant: 'cpu',
  formats: ['helm'],
  runner: 'ubuntu-24.04',
});

assertSourceIncludes(
  lifecycleSource,
  /windows-x64-desktop-exe[\s\S]*bundle:\s*'nsis'/u,
  'desktop EXE target must map to the NSIS bundle so Windows EXE and MSI are independently packageable.',
);
assertSourceIncludes(
  lifecycleSource,
  /windows-x64-desktop-msi[\s\S]*bundle:\s*'msi'/u,
  'desktop MSI target must map to the MSI bundle.',
);
assertSourceIncludes(lifecycleSource, /run-desktop-release-build\.mjs[\s\S]*--phase[\s\S]*bundle[\s\S]*--bundles/u);
assertSourceIncludes(lifecycleSource, /package-release-assets\.mjs[\s\S]*desktop[\s\S]*--bundles/u);
assertSourceIncludes(lifecycleSource, /preflight-desktop-signing-environment\.mjs/u);
assertSourceIncludes(lifecycleSource, /verify-desktop-installer-trust\.mjs/u);
assertSourceIncludes(lifecycleSource, /smoke-desktop-installers\.mjs/u);
assertSourceIncludes(lifecycleSource, /smoke-desktop-packaged-launch\.mjs/u);
assertSourceIncludes(lifecycleSource, /run-claw-server-build\.mjs/u);
assertSourceIncludes(lifecycleSource, /coding-server-openapi-export\.ts/u);
assertSourceIncludes(lifecycleSource, /package-release-assets\.mjs[\s\S]*server/u);
assertSourceIncludes(lifecycleSource, /smoke-server-release-assets\.mjs/u);
assertSourceIncludes(lifecycleSource, /pnpm[\s\S]*docs:build/u);
assertSourceIncludes(lifecycleSource, /package-release-assets\.mjs[\s\S]*web/u);
assertSourceIncludes(lifecycleSource, /smoke-web-release-assets\.mjs/u);
assertSourceIncludes(lifecycleSource, /container-image-metadata/u);
assertSourceIncludes(lifecycleSource, /package-release-assets\.mjs[\s\S]*container/u);
assertSourceIncludes(lifecycleSource, /package-release-assets\.mjs[\s\S]*kubernetes[\s\S]*--image-repository[\s\S]*--image-tag[\s\S]*--image-digest/u);
assertSourceIncludes(lifecycleSource, /render-release-notes\.mjs[\s\S]*release-notes\.md/u);
assertSourceIncludes(lifecycleSource, /smoke-finalized-release-assets\.mjs/u);
assertSourceIncludes(lifecycleSource, /write-attestation-evidence\.mjs/u);
assertSourceIncludes(lifecycleSource, /assert-release-readiness\.mjs/u);

const desktopExePackagePlan = commandPlanText(lifecycleModule.buildLifecycleCommands('package', {
  SDKWORK_PACKAGE_TARGET_ID: 'windows-x64-desktop-exe',
  SDKWORK_RELEASE_TAG: 'release-0.1.0',
}));
assert.match(desktopExePackagePlan, /package-release-assets\.mjs desktop[\s\S]*--bundles nsis/u);

const desktopMsiPackagePlan = commandPlanText(lifecycleModule.buildLifecycleCommands('package', {
  SDKWORK_PACKAGE_TARGET_ID: 'windows-x64-desktop-msi',
  SDKWORK_RELEASE_TAG: 'release-0.1.0',
}));
assert.match(desktopMsiPackagePlan, /package-release-assets\.mjs desktop[\s\S]*--bundles msi/u);

const cpuContainerPackagePlan = commandPlanText(lifecycleModule.buildLifecycleCommands('package', {
  SDKWORK_PACKAGE_TARGET_ID: 'container-x64-server-cpu-tar-gz',
  SDKWORK_RELEASE_TAG: 'release-0.1.0',
  GITHUB_REPOSITORY: 'Sdkwork-Cloud/sdkwork-birdcoder',
  GITHUB_SHA: '0123456789abcdef',
}));
assert.match(cpuContainerPackagePlan, /package-release-assets\.mjs container/u);
assert.match(cpuContainerPackagePlan, /docker buildx build/u);
assert.match(cpuContainerPackagePlan, /docker login ghcr\.io/u);
assert.match(cpuContainerPackagePlan, /tar -xzf/u);
assert.match(cpuContainerPackagePlan, /--strip-components 1/u);
assert.match(cpuContainerPackagePlan, /--metadata-file/u);
assert.match(cpuContainerPackagePlan, /\.sdkwork\/release\/container-image-context\/x64/u);
assert.match(cpuContainerPackagePlan, /ghcr\.io\/sdkwork-cloud\/sdkwork-birdcoder-pc-server:release-0\.1\.0-linux-x64/u);
assert.match(cpuContainerPackagePlan, /container-image-metadata[\\/]x64[\\/]published-image\.json/u);

const kubernetesPackagePlan = commandPlanText(lifecycleModule.buildLifecycleCommands('package', {
  SDKWORK_PACKAGE_TARGET_ID: 'container-x64-server-cpu-helm',
  SDKWORK_RELEASE_TAG: 'release-0.1.0',
}));
assert.match(kubernetesPackagePlan, /package-release-assets\.mjs kubernetes/u);
assert.match(kubernetesPackagePlan, /--image-repository ghcr\.io\/sdkwork-cloud\/sdkwork-birdcoder-pc-server/u);
assert.match(kubernetesPackagePlan, /--image-tag release-0\.1\.0-linux-x64/u);

const containerValidatePlan = commandPlanText(lifecycleModule.buildLifecycleCommands('validate', {
  SDKWORK_PACKAGE_TARGET_ID: 'container-x64-server-cpu-tar-gz',
  SDKWORK_RELEASE_TAG: 'release-0.1.0',
}));
assert.match(containerValidatePlan, /smoke-deployment-release-assets\.mjs[\s\S]*--family container/u);

const kubernetesValidatePlan = commandPlanText(lifecycleModule.buildLifecycleCommands('validate', {
  SDKWORK_PACKAGE_TARGET_ID: 'container-x64-server-cpu-helm',
  SDKWORK_RELEASE_TAG: 'release-0.1.0',
}));
assert.match(kubernetesValidatePlan, /smoke-deployment-release-assets\.mjs[\s\S]*--family kubernetes/u);

const aggregateFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-aggregate-release-'));
try {
  const aggregateReleaseAssetsDir = path.join(aggregateFixtureRoot, 'release-assets');
  writeJsonFixture(path.join(aggregateReleaseAssetsDir, 'container-image-metadata', 'x64', 'published-image.json'), {
    imageRepository: 'ghcr.io/sdkwork-cloud/sdkwork-birdcoder-pc-server',
    imageTag: 'release-0.1.0-linux-x64',
    imageDigest: 'sha256:x64digest',
    imageReference: 'ghcr.io/sdkwork-cloud/sdkwork-birdcoder-pc-server@sha256:x64digest',
  });
  writeJsonFixture(path.join(aggregateReleaseAssetsDir, 'container-image-metadata', 'arm64', 'published-image.json'), {
    imageRepository: 'ghcr.io/sdkwork-cloud/sdkwork-birdcoder-pc-server',
    imageTag: 'release-0.1.0-linux-arm64',
    imageDigest: 'sha256:arm64digest',
    imageReference: 'ghcr.io/sdkwork-cloud/sdkwork-birdcoder-pc-server@sha256:arm64digest',
  });

  const aggregatePublishPlan = commandPlanText(lifecycleModule.buildLifecycleCommands('publish', {
    SDKWORK_RELEASE_AGGREGATE: 'true',
    SDKWORK_AGGREGATE_ARTIFACT_PATH: aggregateReleaseAssetsDir,
    SDKWORK_RELEASE_TAG: 'release-0.1.0',
    GITHUB_REPOSITORY: 'Sdkwork-Cloud/sdkwork-birdcoder',
  }));
  assert.match(aggregatePublishPlan, /package-release-assets\.mjs kubernetes[\s\S]*--image-digest sha256:x64digest/u);
  assert.match(aggregatePublishPlan, /package-release-assets\.mjs kubernetes[\s\S]*--image-digest sha256:arm64digest/u);
  assert.match(aggregatePublishPlan, /smoke-deployment-release-assets\.mjs[\s\S]*--family kubernetes/u);
  assert.match(aggregatePublishPlan, /finalize-release-assets\.mjs[\s\S]*--release-kind formal[\s\S]*--rollout-stage general-availability/u);
  assert.ok(
    aggregatePublishPlan.indexOf('package-release-assets.mjs kubernetes') < aggregatePublishPlan.indexOf('finalize-release-assets.mjs'),
    'aggregate publish must regenerate Kubernetes bundles with published OCI digests before finalizing release assets.',
  );
} finally {
  fs.rmSync(aggregateFixtureRoot, { recursive: true, force: true });
}

assert.match(
  dockerfileSource,
  /COPY deploy\/docker\/profiles\/default\.env \/opt\/sdkwork-birdcoder\/deploy\/profiles\/default\.env/u,
  'Container Dockerfile must copy default.env from the packaged bundle-root context used by docker buildx.',
);
assert.match(
  dockerfileSource,
  /COPY --chown=birdcoder:birdcoder server \/opt\/sdkwork-birdcoder\/server/u,
  'Container Dockerfile must copy the packaged server runtime from the extracted bundle-root context.',
);
assert.match(
  dockerfileSource,
  /COPY --chown=birdcoder:birdcoder web \/opt\/sdkwork-birdcoder\/web/u,
  'Container Dockerfile must copy the packaged web runtime from the extracted bundle-root context.',
);
assert.doesNotMatch(
  dockerfileSource,
  /artifacts\/release\/server-binary/u,
  'Container Dockerfile must not depend on the old workflow-only artifacts/release/server-binary context layout.',
);

const releaseFlowCommandsJoined = releaseFlowRunnerModule.RELEASE_FLOW_CHECK_COMMANDS.join(' && ');
assert.match(releaseFlowCommandsJoined, /release-flow-contract\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /package-release-assets\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /release-profiles\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /write-attestation-evidence\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /assert-release-readiness\.test\.mjs/);
assert.doesNotMatch(
  releaseFlowCommandsJoined,
  /claw-release-parity-contract\.test\.mjs/,
  'release-flow must not keep the retired copied Claw workflow parity contract after sdkwork-github-workflow integration.',
);

assert.equal(rootPackageJson.scripts['check:release-flow'], 'node scripts/run-release-flow-check.mjs');
assert.equal(rootPackageJson.scripts['check:quality-matrix'], 'node scripts/quality-gate-matrix-contract.test.mjs');
assert.equal(rootPackageJson.scripts['release:preflight:desktop-signing'], 'node scripts/release/preflight-desktop-signing-environment.mjs');
assert.equal(
  rootPackageJson.scripts['release:write-attestation-evidence'],
  'node scripts/release/write-attestation-evidence.mjs --release-assets-dir artifacts/release',
);
assert.match(rootPackageJson.scripts['release:finalize'], /--quality-execution-report-path artifacts\/quality\/quality-gate-execution-report\.json/);
assert.match(rootPackageJson.scripts['release:assert-ready'], /local-release-command\.mjs assert-ready --release-assets-dir artifacts\/release/);
assert.doesNotMatch(
  rootPackageJson.scripts['check:release-flow'],
  /&&|pnpm run/u,
  'release-flow must delegate to a bounded runner script so Windows command-line length stays stable.',
);

console.log('release flow contract passed.');
