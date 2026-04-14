import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const topBarSource = read('packages/sdkwork-birdcoder-code/src/components/TopBar.tsx');
const studioPageSource = read('packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx');
const studioDialogsSource = read('packages/sdkwork-birdcoder-studio/src/pages/StudioPageDialogs.tsx');
const appCollaborationLocaleSource = read('packages/sdkwork-birdcoder-i18n/src/locales/en/app/collaboration.ts');
const studioDialogsLocaleSource = read('packages/sdkwork-birdcoder-i18n/src/locales/en/studio/dialogs.ts');
const codeTopBarLocaleSource = read('packages/sdkwork-birdcoder-i18n/src/locales/en/code/topbar.ts');
const codeActionsLocaleSource = read('packages/sdkwork-birdcoder-i18n/src/locales/en/code/actions.ts');
const appToolsLocaleSource = read('packages/sdkwork-birdcoder-i18n/src/locales/en/app/tools.ts');

assert.doesNotMatch(
  topBarSource,
  /addToast\(t\('code\.deploymentStarted'\), 'info'\)/,
  'Code TopBar publish flow must not claim deployment started before a runtime-backed publish path exists.',
);
assert.doesNotMatch(
  studioPageSource,
  /addToast\(t\('studio\.deploymentStarted'\), 'info'\)/,
  'Studio publish flow must not claim deployment started before a runtime-backed publish path exists.',
);
assert.doesNotMatch(
  topBarSource,
  /t\('app\.(publishToProduction|deployToVercel|deployToVercelDesc|projectName|environmentVariables|noEnvVars|deployProject)'\)/,
  'Code TopBar publish modal must not render simulated deployment controls while publishing is unavailable.',
);
assert.doesNotMatch(
  studioDialogsSource,
  /t\('studio\.(publishToProduction|deployToVercel|deployDesc|projectName|environmentVariables|noEnvVars|deployProject)'\)/,
  'Studio publish modal must not render simulated deployment controls while publishing is unavailable.',
);
assert.doesNotMatch(
  studioPageSource,
  /addToast\(t\('studio\.debugConfigurationSaved'\), 'success'\)/,
  'Studio debug flow must not claim a debug configuration was saved while the runtime-backed debugger host is unavailable.',
);
assert.match(
  studioPageSource,
  /addToast\(t\('studio\.debugConfigurationUnavailable'\), 'error'\)/,
  'Studio debug flow must raise an explicit unavailable error until the runtime-backed debugger host is wired.',
);
for (const [source, description] of [
  [appCollaborationLocaleSource, 'App collaboration locale'],
  [studioDialogsLocaleSource, 'Studio dialogs locale'],
  [codeTopBarLocaleSource, 'Code topbar locale'],
  [codeActionsLocaleSource, 'Code actions locale'],
  [appToolsLocaleSource, 'App tools locale'],
]) {
  assert.doesNotMatch(
    source,
    /publishToProduction|deployToVercel|deployToVercelDesc|deployDesc|deployProject|deploymentStarted|changesCommittedMock|pushedToRemoteMock|createdAndSwitchedBranchMock|switchedToBranchMock|debuggerAttachedMock/,
    `${description} must not retain stale fake-success or simulated deployment copy after runtime-truth repair.`,
  );
}

console.log('publish runtime truth contract passed.');
