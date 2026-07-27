import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const hookSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    
    
    
    'sdkwork-birdcoder-pc-workbench',
    'src',
    'hooks',
    'useProjectGitOverview.ts',
  ),
  'utf8',
);
const subscriptionSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-workbench',
    'src',
    'workbench',
    'projectGitOverviewSubscription.ts',
  ),
  'utf8',
);
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

assert.match(
  subscriptionSource,
  /export const PROJECT_GIT_OVERVIEW_LOAD_TIMEOUT_MS = 30_000;/,
  'Project Git overview loading must be bounded so Git controls and drawers cannot stay loading forever.',
);

assert.match(
  subscriptionSource,
  /async function loadWithTimeout\([\s\S]*Promise\.race\(\[\s*source\.getProjectGitOverview\(projectId\),\s*timeoutBoundary\.promise,\s*\]\)[\s\S]*timeoutBoundary\.clear\(\);/,
  'The Git overview subscription must race its injected source against a timeout boundary.',
);

assert.match(
  subscriptionSource,
  /const overview = await loadWithTimeout\(source, normalizedProjectId, timeoutMs\);/,
  'The Git overview subscription must use the bounded loader for refreshes.',
);

assert.match(
  subscriptionSource,
  /if \(entry\.requestVersion === requestVersion\) \{\s*entry\.inFlight = null;\s*\}/,
  'The Git overview subscription must release the current in-flight load after success, failure, or timeout.',
);

assert.match(
  subscriptionSource,
  /function loadErrorMessage\(error: unknown\): string \{[\s\S]*error instanceof Error && error\.message\.trim\(\)[\s\S]*: 'Failed to load project Git overview\.'/,
  'Project Git overview timeout errors must converge to the existing retryable load error state.',
);

assert.match(
  hookSource,
  /function shouldReportProjectGitOverviewLoadError\(error: unknown\): boolean \{[\s\S]*error instanceof ProjectRuntimeLocationExecutionUnavailableError[\s\S]*error\.code === 'missing_runtime_location_id'/,
  'A missing Git runtime-location preference must be treated as an expected selection state.',
);

assert.match(
  hookSource,
  /errorCode === 'tauri_project_git_runtime_unavailable'/,
  'Browser mode must treat an unavailable Tauri Git host as an expected capability state.',
);

assert.match(
  hookSource,
  /if \(shouldReportProjectGitOverviewLoadError\(error\)\) \{\s*console\.error\('Failed to load project Git overview', error\);\s*\}/,
  'Project Git overview loading must log real failures without logging the expected runtime-selection state.',
);

assert.match(
  packageJson.scripts['check:code-topbar-git-overview'] ?? '',
  /project-git-overview-timeout-contract\.test\.mjs/,
  'Code topbar Git overview standards must include Git overview loading timeout resilience.',
);

console.log('project git overview timeout contract passed.');
