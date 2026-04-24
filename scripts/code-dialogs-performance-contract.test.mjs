import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const codePagePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const codePageDialogsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePageDialogs.tsx',
);

const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const codePageDialogsSource = fs.readFileSync(codePageDialogsPath, 'utf8');

assert.match(
  codePageSource,
  /const handleCloseRunConfig = useCallback\(/,
  'CodePage must stabilize the run configuration close handler so dialog props do not churn on every render.',
);

assert.match(
  codePageSource,
  /const handleSubmitRunConfigurationAction = useCallback\(/,
  'CodePage must stabilize the run configuration submit handler so dialog props do not churn on every render.',
);

assert.match(
  codePageSource,
  /const handleCloseDebugConfig = useCallback\(/,
  'CodePage must stabilize the debug configuration close handler so dialog props do not churn on every render.',
);

assert.match(
  codePageSource,
  /const handleCloseRunTask = useCallback\(/,
  'CodePage must stabilize the run task close handler so dialog props do not churn on every render.',
);

assert.match(
  codePageSource,
  /const handleCancelDelete = useCallback\(/,
  'CodePage must stabilize the delete dialog cancel handler so dialog props do not churn on every render.',
);

assert.match(
  codePageSource,
  /const handleConfirmDelete = useCallback\(/,
  'CodePage must stabilize the delete dialog confirm handler so dialog props do not churn on every render.',
);

assert.match(
  codePageDialogsSource,
  /export const CodePageDialogs = memo\(function CodePageDialogs\(/,
  'CodePageDialogs must be memoized so chat typing and other high-frequency page updates do not rerender all dialog orchestration.',
);

console.log('code dialogs performance contract passed.');
