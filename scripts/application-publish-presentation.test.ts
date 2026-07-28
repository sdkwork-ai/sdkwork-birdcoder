import assert from 'node:assert/strict';

import {
  APPLICATION_PUBLISH_STAGE_ORDER,
  getApplicationPublishErrorTranslationKey,
  getApplicationPublishPreflightCheckTranslationKey,
  isValidApplicationPublishVersion,
  resolveApplicationPublishPercent,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/publish/applicationPublishPresentation.ts';

assert.equal(
  getApplicationPublishErrorTranslationKey('desktop_runtime_required'),
  'code.publish.errorDesktopRuntimeRequired',
);
assert.equal(getApplicationPublishErrorTranslationKey('future_error'), undefined);

assert.equal(
  getApplicationPublishPreflightCheckTranslationKey('application_identity', 'warning'),
  'code.publish.checkApplicationIdentityLegacy',
);
assert.equal(
  getApplicationPublishPreflightCheckTranslationKey('single_release_artifact', 'failed'),
  'code.publish.checkSingleReleaseArtifactRequired',
);
assert.equal(
  getApplicationPublishPreflightCheckTranslationKey('future_check', 'passed'),
  undefined,
);

for (const version of [
  '0.1.0',
  '1.0.0',
  '1.2.3-alpha.1',
  '1.2.3+build.7',
  '1.2.3-rc.1+build.7',
]) {
  assert.equal(isValidApplicationPublishVersion(version), true, `${version} should be valid`);
}

for (const version of [
  '',
  '1',
  '1.2',
  '01.2.3',
  '1.02.3',
  '1.2.03',
  '1.2.3-01',
  '1.2.3-..',
  'v1.2.3',
]) {
  assert.equal(isValidApplicationPublishVersion(version), false, `${version} should be invalid`);
}

const fullFlow = [
  { percent: 0, stage: 'building' as const },
  { percent: 100, stage: 'packaging' as const },
  { percent: 0, stage: 'uploading' as const },
  { percent: 50, stage: 'uploading' as const },
  { percent: 100, stage: 'uploading' as const },
  { stage: 'registering' as const },
  { stage: 'releasing' as const },
  { stage: 'deploying' as const },
  { percent: 100, stage: 'completed' as const },
];
const fullFlowPercentages = fullFlow.map((_, index) =>
  resolveApplicationPublishPercent(fullFlow.slice(0, index + 1)));
assert.deepEqual(fullFlowPercentages, [0, 33, 33, 42, 50, 50, 67, 83, 100]);

const releaseOnlyStages = APPLICATION_PUBLISH_STAGE_ORDER.filter((stage) => stage !== 'deploying');
assert.equal(
  resolveApplicationPublishPercent(
    [{ percent: 50, stage: 'uploading' }],
    releaseOnlyStages,
  ),
  50,
);
assert.equal(
  resolveApplicationPublishPercent(
    [{ percent: 100, stage: 'completed' }],
    releaseOnlyStages,
  ),
  100,
);

console.log('application publish presentation tests passed.');
