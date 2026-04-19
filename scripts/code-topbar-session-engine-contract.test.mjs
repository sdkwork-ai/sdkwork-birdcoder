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

assert.match(
  codePageSource,
  /projectId:\s*currentProject\?\.id,\s*projectName:\s*currentProject\?\.name,\s*projectPath:\s*currentProject\?\.path,/s,
  'Code page must pass only the current project metadata that the top bar actually renders so transcript updates do not rerender the header through a large project object prop.',
);

assert.match(
  codePageSource,
  /selectedSessionTitle:\s*session\?\.title,\s*selectedSessionEngineId:\s*session\?\.engineId,\s*selectedSessionModelId:\s*session\?\.modelId,/s,
  'Code page must pass only the active session title and engine metadata that the top bar renders so message list mutations do not bubble a large session object through the header.',
);

assert.match(
  codePageSource,
  /isSelectedSessionExecuting:\s*isBirdCoderCodingSessionExecuting\(session\),/,
  'Code page must precompute the selected session execution flag for the top bar so the header does not depend on the full session object.',
);

assert.match(
  topBarSource,
  /projectId\?: string;\s*projectName\?: string;\s*projectPath\?: string;\s*selectedSessionTitle\?: string;\s*selectedSessionEngineId\?: string;\s*selectedSessionModelId\?: string;\s*isSelectedSessionExecuting: boolean;/s,
  'Code top bar props must be scalar metadata so the header stays insulated from full project and session object churn.',
);

assert.match(
  topBarSource,
  /const headerEngineId = selectedSessionEngineId \?\? selectedEngineId;/,
  'Code top bar must prefer the active session engine over the global selection.',
);

assert.match(
  topBarSource,
  /const headerModelId = selectedSessionModelId \?\? selectedModelId;/,
  'Code top bar must prefer the active session model over the global selection.',
);

assert.match(
  topBarSource,
  /const headerEngine = getWorkbenchCodeEngineDefinition\(headerEngineId, preferences\);/,
  'Code top bar must resolve the displayed engine from the session-aware engine id.',
);

assert.match(
  topBarSource,
  /const headerModelIdNormalized = normalizeWorkbenchCodeModelId\(\s*headerEngineId,\s*headerModelId,\s*preferences,\s*\);/s,
  'Code top bar must normalize the displayed model against the session-aware engine id.',
);

assert.match(
  topBarSource,
  /const headerModelLabel = getWorkbenchCodeModelLabel\(\s*headerEngineId,\s*headerModelIdNormalized,\s*preferences,\s*\);/s,
  'Code top bar must resolve the displayed model label from the session-aware engine and normalized model id.',
);

assert.match(
  topBarSource,
  /const headerEngineSummary =\s*headerModelLabel\.trim\(\)\.toLowerCase\(\) === headerEngine\.label\.trim\(\)\.toLowerCase\(\)\s*\?\s*headerEngine\.label\s*:\s*`\$\{headerEngine\.label\} \/ \$\{headerModelLabel\}`;/s,
  'Code top bar should collapse duplicate engine and model labels into a single visible summary.',
);

assert.match(
  topBarSource,
  /<WorkbenchCodeEngineIcon engineId=\{headerEngine\.id\} \/>/,
  'Code top bar must render the engine icon for the session-aware engine.',
);

assert.doesNotMatch(
  codePageSource,
  /topBarProps = \{\s*currentProject,\s*selectedCodingSession:/s,
  'Code page must not pass whole project and session objects into the top bar because transcript updates would force unnecessary header rerenders.',
);

console.log('code topbar session engine contract passed.');
