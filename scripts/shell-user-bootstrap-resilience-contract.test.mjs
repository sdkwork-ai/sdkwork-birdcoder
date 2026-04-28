import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrapUserStatePath = new URL(
  '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapShellUserState.ts',
  import.meta.url,
);
const packageJsonPath = new URL('../package.json', import.meta.url);
const ciFlowPath = new URL('./ci-flow-contract.test.mjs', import.meta.url);

const bootstrapUserStateSource = fs.readFileSync(bootstrapUserStatePath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const ciFlowSource = fs.readFileSync(ciFlowPath, 'utf8');

assert.match(
  bootstrapUserStateSource,
  /const SHELL_USER_STATE_BOOTSTRAP_TIMEOUT_MS = 30_000;/,
  'Shell user-state bootstrap must have a bounded timeout so local persistence cannot leave startup permanently blocked.',
);

assert.match(
  bootstrapUserStateSource,
  /const MODEL_CONFIG_SYNC_BOOTSTRAP_TIMEOUT_MS = 15_000;/,
  'Model-config startup synchronization must be independently bounded so remote authority slowness falls back to local-first startup.',
);

assert.match(
  bootstrapUserStateSource,
  /const PROJECT_WORKBENCH_BOOTSTRAP_TIMEOUT_MS = 15_000;/,
  'Project workbench bootstrap must be bounded so a stuck run-configuration write cannot poison future project selections.',
);

assert.match(
  bootstrapUserStateSource,
  /function runBootstrapTaskWithTimeout<T>\([\s\S]*Promise\.race\(\[\s*task,\s*timeoutBoundary\.promise,\s*\]\)[\s\S]*timeoutBoundary\.clear\(\);/,
  'Shell user-state bootstrap must use one canonical timeout race helper for all persisted bootstrap tasks.',
);

assert.match(
  bootstrapUserStateSource,
  /await runBootstrapTaskWithTimeout\([\s\S]*'code engine model config synchronization'[\s\S]*syncWorkbenchCodeEngineModelConfig\(/,
  'Code-engine model-config synchronization must run through the bounded bootstrap helper.',
);

assert.match(
  bootstrapUserStateSource,
  /bootstrapShellLocalUserStatePromise = runBootstrapTaskWithTimeout\([\s\S]*'shell local user state bootstrap'[\s\S]*persistLocalUserState\(\)/,
  'Local user-state persistence must run through the bounded bootstrap helper before its promise is cached.',
);

assert.match(
  bootstrapUserStateSource,
  /ensureCodeEngineModelConfigSynchronized\(options\)[\s\S]*\.then\(\(\) => persistLocalUserState\(\)\)[\s\S]*SHELL_USER_STATE_BOOTSTRAP_TIMEOUT_MS/,
  'The combined model-config plus local-state startup path must also be bounded by the user-state bootstrap timeout.',
);

assert.match(
  bootstrapUserStateSource,
  /const bootstrapPromise: Promise<RunConfigurationRecord\[\]> =\s*runBootstrapTaskWithTimeout\([\s\S]*'project workbench state bootstrap'[\s\S]*ensureStoredRunConfigurations\(normalizedProjectId\)[\s\S]*PROJECT_WORKBENCH_BOOTSTRAP_TIMEOUT_MS[\s\S]*\.finally\(\(\) => \{[\s\S]*if \(projectBootstrapPromises\.get\(normalizedProjectId\) === bootstrapPromise\) \{[\s\S]*projectBootstrapPromises\.delete\(normalizedProjectId\);/,
  'Project workbench bootstrap must clear only the current bounded in-flight task after success, failure, or timeout.',
);

assert.match(
  packageJson.scripts['check:workbench-activity-performance'] ?? '',
  /shell-user-bootstrap-resilience-contract\.test\.mjs/,
  'Root workbench activity performance checks must cover shell user-state bootstrap resilience.',
);

assert.match(
  ciFlowSource,
  /shell-user-bootstrap-resilience-contract\.test\.mjs/,
  'CI flow governance must keep shell user-state bootstrap resilience in the first-class performance standard.',
);

console.log('shell user bootstrap resilience contract passed.');
