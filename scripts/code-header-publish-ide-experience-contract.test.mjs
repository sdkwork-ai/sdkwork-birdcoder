import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const componentRoot = path.join(
  process.cwd(),
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components',
);

function readComponent(relativePath) {
  return fs.readFileSync(path.join(componentRoot, relativePath), 'utf8');
}

const topBarSource = readComponent('TopBar.tsx');
const dialogSource = readComponent('publish/ApplicationPublishDialog.tsx');
const appListSource = readComponent('publish/ApplicationPublishAppList.tsx');
const targetPanelSource = readComponent('publish/ApplicationPublishTargetPanel.tsx');
const progressSource = readComponent('publish/ApplicationPublishProgress.tsx');
const presentationSource = readComponent('publish/applicationPublishPresentation.ts');

assert.match(
  topBarSource,
  /import \{ ApplicationPublishDialog \} from '\.\/publish\/ApplicationPublishDialog\.tsx';/u,
  'The Code header must compose the real application publish dialog.',
);
assert.match(
  topBarSource,
  /const \[showApplicationPublishDialog, setShowApplicationPublishDialog\] = useState\(false\);/u,
  'The Code header must own explicit publish-dialog visibility state.',
);
assert.match(
  topBarSource,
  /title=\{t\('code\.publish\.action'\)\}[\s\S]*?aria-haspopup="dialog"[\s\S]*?disabled=\{!projectId\?\.trim\(\)\}[\s\S]*?onClick=\{\(\) => setShowApplicationPublishDialog\(true\)\}[\s\S]*?<Rocket size=\{14\}/u,
  'The publish icon must be accessible, project-scoped, and open the real workflow.',
);
assert.match(
  topBarSource,
  /<ApplicationPublishDialog[\s\S]*?isOpen=\{showApplicationPublishDialog\}[\s\S]*?projectId=\{projectId\}[\s\S]*?projectName=\{projectName\}/u,
  'The publish dialog must receive the active project identity from the Code header.',
);

assert.match(
  dialogSource,
  /const \{ applicationPublishService \} = useIDEServices\(\);/u,
  'The publish dialog must consume the injected application publishing service.',
);
for (const operation of [
  'discoverApplications',
  'preflightApplication',
  'publishApplication',
]) {
  assert.match(
    dialogSource,
    new RegExp(`applicationPublishService\\.${operation}\\(`, 'u'),
    `The publish dialog must execute ${operation} through the service port.`,
  );
}
assert.match(dialogSource, /role="dialog"/u);
assert.match(dialogSource, /aria-modal="true"/u);
assert.match(dialogSource, /<ApplicationPublishAppList/u);
assert.match(dialogSource, /<ApplicationPublishTargetPanel/u);
assert.match(dialogSource, /<ApplicationPublishProgress/u);
for (const phase of [
  'discovering',
  'discovery_error',
  'publish_error',
  'publishing',
  'success',
]) {
  assert.match(
    dialogSource,
    new RegExp(`phase === '${phase}'`, 'u'),
    `The workflow must render an explicit ${phase} state.`,
  );
}
assert.match(
  dialogSource,
  /<EvidenceRow label=\{t\('code\.publish\.release'\)\} value=\{evidence\.releaseId\}/u,
  'Successful publication must expose immutable release evidence.',
);
assert.match(
  dialogSource,
  /<EvidenceRow label=\{t\('code\.publish\.checksum'\)\} value=\{evidence\.checksumSha256\}/u,
  'Successful publication must expose artifact checksum evidence.',
);

assert.match(
  appListSource,
  /applications\.map\(\(application\) =>/u,
  'SDKWork workspaces must render every discovered application as a selectable list item.',
);
assert.match(appListSource, /application\.readiness === 'ready'/u);
assert.match(appListSource, /application\.readiness === 'unsupported'/u);
assert.match(
  targetPanelSource,
  /const isTargetReady = application\.readiness === 'ready' && target\?\.readiness === 'ready';[\s\S]*?!isTargetReady \? \([\s\S]*?<ReadinessNotice/u,
  'Incomplete manifests must stay in a setup-required presentation instead of appearing publishable.',
);
assert.match(targetPanelSource, /onClick=\{onPreflight\}/u);
assert.match(targetPanelSource, /onClick=\{onPublish\}/u);
assert.match(targetPanelSource, /disabled=\{!canPublish/u);
assert.match(
  targetPanelSource,
  /code\.publish\.buildCommand[\s\S]*?preflight\.command[\s\S]*?code\.publish\.workingDirectory[\s\S]*?preflight\.cwd/u,
  'The publish confirmation must show the preflight-frozen command and working directory before execution.',
);
assert.match(
  targetPanelSource,
  /getApplicationPublishPreflightCheckTranslationKey\([\s\S]*?check\.code,[\s\S]*?check\.status,[\s\S]*?translationKey \? t\(translationKey\) : check\.message/u,
  'Known preflight checks must be localized while unknown host checks retain their evidence message.',
);
for (const [code, translationKey] of [
  ['application_identity', 'code.publish.checkApplicationIdentityStable'],
  ['manifest_valid', 'code.publish.checkManifestValid'],
  ['single_release_artifact', 'code.publish.checkSingleReleaseArtifactRequired'],
  ['target_ready', 'code.publish.checkTargetReady'],
]) {
  assert.match(presentationSource, new RegExp(`${code}:`, 'u'));
  assert.match(
    presentationSource,
    new RegExp(`'${translationKey.replaceAll('.', '\\.')}'`, 'u'),
    `Preflight check ${code} must have a stable localization key.`,
  );
}
assert.match(
  presentationSource,
  /application\.framework !== 'flutter'[\s\S]*?supportsAutomaticDeployment\(application, target\)/u,
  'Flutter publication must default to release-only instead of automatic deployment.',
);
for (const outputType of ['android-aab', 'android-apk', 'ios-ipa', 'mini-program']) {
  assert.match(
    presentationSource,
    new RegExp(`'${outputType}'`, 'u'),
    `Mobile artifact type ${outputType} must disable unsupported automatic deployment.`,
  );
}
assert.doesNotMatch(dialogSource, /releaseNotes/u);
assert.doesNotMatch(targetPanelSource, /releaseNotes|<textarea/u);

assert.match(progressSource, /role="progressbar"/u);
for (const stage of [
  'building',
  'packaging',
  'uploading',
  'registering',
  'releasing',
  'deploying',
  'completed',
]) {
  assert.match(
    presentationSource,
    new RegExp(`'${stage}'`, 'u'),
    `The commercial publish workflow must retain the ${stage} stage.`,
  );
}
assert.match(
  presentationSource,
  /applications\.find\(\(application\) => application\.readiness === 'ready'\)/u,
  'Initial workspace selection must prefer an application that is actually ready to publish.',
);

assert.doesNotMatch(topBarSource, /One-click publish from the IDE/u);
assert.doesNotMatch(topBarSource, /resolveDefaultPublishTargetName/u);
assert.doesNotMatch(topBarSource, /SDKWORK Cloud Web/u);

console.log('code header application publish IDE experience contract passed.');
