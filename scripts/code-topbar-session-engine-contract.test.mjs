import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const topBarSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'components',
  'TopBar.tsx',
);
const codePageSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const codePageSurfacePropsSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
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
  /selectedSessionTitle,[\s\S]*selectedSessionEngineId,[\s\S]*selectedSessionModelId,[\s\S]*isSelectedSessionEngineBusy,/s,
  'Code page must pass only the active session title and engine metadata that the top bar renders so message list mutations do not bubble a large session object through the header.',
);

assert.match(
  codePageSource,
  /const isSelectedSessionEngineBusy = isBirdCoderCodingSessionEngineBusy\(session\);/,
  'Code page must precompute the selected session engine-busy flag for the top bar so the header does not spin for approval or user-reply waits.',
);

assert.match(
  codePageSource,
  /isSelectedSessionEngineBusy,\s*selectedEngineId,\s*selectedModelId,/s,
  'Code page must pass the preferred engine and model selection separately from scalar session metadata so the top bar can keep session truth for display and preferences truth for new-session flows.',
);

assert.match(
  topBarSource,
  /projectId\?: string;[\s\S]*projectName\?: string;[\s\S]*projectPath\?: string;[\s\S]*selectedSessionTitle\?: string;[\s\S]*selectedSessionEngineId\?: string;[\s\S]*selectedSessionModelId\?: string;[\s\S]*isSelectedSessionEngineBusy: boolean;/,
  'Code top bar props must be scalar metadata so the header stays insulated from full project and session object churn.',
);

assert.match(
  topBarSource,
  /const headerEngineSummary = selectedSessionEngineId\?\.trim\(\)\s*\?\s*getWorkbenchCodeEngineSessionSummary\(/s,
  'Code top bar must resolve its displayed engine summary from strict session-aware metadata when a session exists.',
);

assert.match(
  topBarSource,
  /selectedSessionModelId,\s*preferences,\s*\)\s*:\s*getWorkbenchCodeEngineSessionSummary\(selectedEngineId,\s*selectedModelId,\s*preferences\);/s,
  'Code top bar must fall back to the preferred engine summary only when there is no selected session.',
);

assert.match(
  topBarSource,
  /getWorkbenchCodeEngineSessionSummary/,
  'Code top bar must use the strict session summary helper instead of the default-model fallback path.',
);

assert.doesNotMatch(
  topBarSource,
  /<WorkbenchCodeEngineIcon engineId=\{headerEngine\.id\} \/>/,
  'Code top bar should not render an engine icon once the engine is shown as a fixed single-line label.',
);

assert.match(
  topBarSource,
  /<span className="truncate whitespace-nowrap font-medium text-gray-200">\s*\{headerEngineSummary\}\s*<\/span>/,
  'Code top bar should render the session-aware engine summary as a single-line truncated label.',
);

assert.doesNotMatch(
  codePageSource,
  /topBarProps = \{\s*currentProject,\s*selectedCodingSession:/s,
  'Code page must not pass whole project and session objects into the top bar because transcript updates would force unnecessary header rerenders.',
);

console.log('code topbar session engine contract passed.');
