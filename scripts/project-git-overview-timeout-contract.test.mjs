import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const hookSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'hooks',
    'useProjectGitOverview.ts',
  ),
  'utf8',
);
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

assert.match(
  hookSource,
  /const PROJECT_GIT_OVERVIEW_LOAD_TIMEOUT_MS = 30_000;/,
  'Project Git overview loading must be bounded so Git controls and drawers cannot stay loading forever.',
);

assert.match(
  hookSource,
  /function loadProjectGitOverviewWithTimeout\([\s\S]*Promise\.race\(\[\s*gitService\.getProjectGitOverview\(projectId\),\s*timeoutBoundary\.promise,\s*\]\)[\s\S]*timeoutBoundary\.clear\(\);/,
  'Project Git overview refresh must race gitService.getProjectGitOverview against a timeout boundary.',
);

assert.match(
  hookSource,
  /const nextOverview = await loadProjectGitOverviewWithTimeout\(\s*gitService,\s*normalizedProjectId,\s*\);/,
  'useProjectGitOverview must use the bounded loader for automatic and manual refreshes.',
);

assert.match(
  hookSource,
  /if \(entry\.requestVersion === requestVersion\) \{\s*entry\.inFlight = null;\s*\}/,
  'useProjectGitOverview must release the current in-flight load after success, failure, or timeout.',
);

assert.match(
  hookSource,
  /loadErrorMessage:[\s\S]*error instanceof Error && error\.message\.trim\(\)[\s\S]*: 'Failed to load project Git overview\.'/,
  'Project Git overview timeout errors must converge to the existing retryable load error state.',
);

assert.match(
  packageJson.scripts['check:code-topbar-git-overview'] ?? '',
  /project-git-overview-timeout-contract\.test\.mjs/,
  'Code topbar Git overview standards must include Git overview loading timeout resilience.',
);

console.log('project git overview timeout contract passed.');
