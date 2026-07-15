import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const topBarSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'components',
  'TopBar.tsx',
);
const codePageSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const codePageSurfacePropsSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'useCodePageSurfaceProps.ts',
);

assert.match(
  codePageSurfacePropsSource,
  /const topBarProps = useMemo<TopBarComponentProps>\(\(\) => \(\{[\s\S]*projectId,[\s\S]*projectName,[\s\S]*projectGitOverviewState,/s,
  'Code page must pass only the current project metadata that the top bar actually renders so transcript updates do not rerender the header through a large project object prop.',
);

assert.match(
  codePageSurfacePropsSource,
  /isEngineBusyCurrentSession,[\s\S]*selectedEngineId,[\s\S]*selectedModelId,[\s\S]*selectedSessionEngineId,[\s\S]*selectedSessionModelId,[\s\S]*selectedSessionTitle,/s,
  'Code page must pass only the active session title and engine metadata that the top bar renders so message list mutations do not bubble a large session object through the header.',
);

assert.match(
  codePageSource,
  /const isSelectedSessionEngineBusy = isBirdCoderCodingSessionEngineBusy\(session\);/,
  'Code page must precompute the selected session engine-busy flag for the top bar so the header does not spin for approval or user-reply waits.',
);

assert.match(
  codePageSource,
  /isEngineBusyCurrentSession:\s*isSelectedSessionEngineBusy,/s,
  'Code page must pass its selected-session engine-busy state through a scalar top-bar prop so the header does not receive a session object.',
);

assert.match(
  topBarSource,
  /projectId\?: string;[\s\S]*projectName\?: string;[\s\S]*isEngineBusyCurrentSession\?: boolean;[\s\S]*selectedSessionEngineId\?: string;[\s\S]*selectedSessionModelId\?: string;[\s\S]*selectedSessionTitle\?: string;/,
  'Code top bar props must contain only scalar remote project metadata and selected-session state so the header stays insulated from object churn and device-local mount details.',
);

assert.doesNotMatch(
  topBarSource,
  /projectPath\?: string/,
  'Code top bar must not accept a device-local project path through remote project presentation props.',
);

assert.match(
  topBarSource,
  /<WorkbenchNewSessionButton[\s\S]*currentSessionEngineId=\{selectedSessionEngineId\}[\s\S]*currentSessionModelId=\{selectedSessionModelId\}/s,
  'Code top bar must pass strict session-aware engine and model metadata into the new-session action without retaining a device-local project path.',
);

assert.match(
  topBarSource,
  /isEngineBusyCurrentSession && \(/,
  'Code top bar must render current-session execution state from the scalar busy flag supplied by the page.',
);

assert.doesNotMatch(
  topBarSource,
  /getWorkbenchCodeEngineSessionSummary|projectPath/,
  'Code top bar must not retain deprecated engine-summary plumbing or a device-local project path prop.',
);

assert.doesNotMatch(
  codePageSource,
  /topBarProps = \{\s*currentProject,\s*selectedCodingSession:/s,
  'Code page must not pass whole project and session objects into the top bar because transcript updates would force unnecessary header rerenders.',
);

console.log('code topbar session engine contract passed.');
