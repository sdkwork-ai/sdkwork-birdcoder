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
  /selectedCodingSession=\{selectedCodingSession\}/,
  'Code page must pass the active coding session into the top bar so engine display can stay session-aware.',
);

assert.match(
  topBarSource,
  /const headerEngineId = selectedCodingSession\?\.engineId \?\? selectedEngineId;/,
  'Code top bar must prefer the active session engine over the global selection.',
);

assert.match(
  topBarSource,
  /const headerModelId = selectedCodingSession\?\.modelId \?\? selectedModelId;/,
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

assert.match(
  topBarSource,
  /\{headerEngineSummary\}/,
  'Code top bar must render the de-duplicated session-aware engine summary.',
);

assert.match(
  topBarSource,
  /const isExecutingCurrentSession = isBirdCoderCodingSessionExecuting\(selectedCodingSession\);/,
  'Code top bar must derive execution state from the selected session runtime state.',
);

assert.match(
  topBarSource,
  /isExecutingCurrentSession && \(\s*<div className="hidden items-center gap-1\.5 text-xs text-emerald-400 xl:flex">\s*<RefreshCw size=\{12\} className="animate-spin" \/>\s*<span>\{t\('code\.executingSession'\)\}<\/span>\s*<\/div>\s*\)/s,
  'Code top bar should surface an executing label while the active session is running.',
);

assert.doesNotMatch(
  topBarSource,
  /Boolean\(selectedCodingSession && isSending\)/,
  'Code top bar must not use the transient send flag as the source of truth for execution state.',
);

console.log('code topbar session engine contract passed.');
