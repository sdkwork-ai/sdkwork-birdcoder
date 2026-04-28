import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeImplPath = new URL(
  '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapShellRuntimeImpl.ts',
  import.meta.url,
);
const packageJsonPath = new URL('../package.json', import.meta.url);
const ciFlowPath = new URL('./ci-flow-contract.test.mjs', import.meta.url);

const runtimeImplSource = fs.readFileSync(runtimeImplPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const ciFlowSource = fs.readFileSync(ciFlowPath, 'utf8');

assert.match(
  runtimeImplSource,
  /let bootstrapShellRuntimePromise: Promise<void> \| null = null;/,
  'Shell runtime bootstrap must keep an in-flight promise so remounts and concurrent startup callers cannot duplicate expensive service loading, model sync, and local-state writes.',
);

assert.match(
  runtimeImplSource,
  /const SHELL_RUNTIME_BOOTSTRAP_TIMEOUT_MS = 30_000;/,
  'Shell runtime bootstrap must have its own bounded timeout so BootstrapGate retry does not depend on a still-hung lower-level promise.',
);

assert.match(
  runtimeImplSource,
  /let bootstrapShellRuntimeAttemptId = 0;/,
  'Shell runtime bootstrap must track attempt identity so stale work cannot mark a later retry as bootstrapped.',
);

assert.match(
  runtimeImplSource,
  /const abandonedBootstrapAttemptIds = new Set<number>\(\);/,
  'Shell runtime bootstrap must remember timed-out attempts until their underlying work settles.',
);

assert.match(
  runtimeImplSource,
  /function createShellRuntimeBootstrapTimeoutPromise\([\s\S]*abandonedBootstrapAttemptIds\.add\(attemptId\);[\s\S]*Startup shell runtime did not complete within/,
  'Shell runtime bootstrap must abandon a timed-out attempt before rejecting, allowing the retry path to create fresh work.',
);

assert.match(
  runtimeImplSource,
  /function runBootstrapShellRuntimeWithTimeout\([\s\S]*Promise\.race\(\[\s*runBootstrapShellRuntimeOnce\(attemptId\),\s*timeoutBoundary\.promise,\s*\]\)[\s\S]*timeoutBoundary\.clear\(\);/,
  'Shell runtime bootstrap must race service loading and user-state hydration against the lower-level timeout.',
);

assert.match(
  runtimeImplSource,
  /if \(bootstrapShellRuntimePromise\) \{\s*return bootstrapShellRuntimePromise;\s*\}/,
  'Shell runtime bootstrap must return the current in-flight bootstrap promise when startup is already running.',
);

assert.match(
  runtimeImplSource,
  /const attemptId = bootstrapShellRuntimeAttemptId \+ 1;[\s\S]*bootstrapShellRuntimeAttemptId = attemptId;/,
  'Shell runtime bootstrap must allocate a new attempt id for each fresh startup run.',
);

assert.match(
  runtimeImplSource,
  /const nextBootstrapPromise = runBootstrapShellRuntimeWithTimeout\([\s\S]*\.finally\(\(\) => \{[\s\S]*if \(bootstrapShellRuntimePromise === nextBootstrapPromise\) \{[\s\S]*bootstrapShellRuntimePromise = null;/,
  'Shell runtime bootstrap must clear only the current in-flight promise after settle so a timed-out startup can be retried cleanly.',
);

assert.match(
  runtimeImplSource,
  /if \(\s*attemptId === bootstrapShellRuntimeAttemptId &&\s*!abandonedBootstrapAttemptIds\.has\(attemptId\)\s*\) \{\s*bootstrapped = true;\s*\}/,
  'Shell runtime bootstrap must mark successful completion only for the active, non-abandoned attempt after required shell user state has been persisted.',
);

assert.match(
  packageJson.scripts['check:workbench-activity-performance'] ?? '',
  /shell-runtime-bootstrap-concurrency-contract\.test\.mjs/,
  'Root workbench activity performance checks must cover startup bootstrap concurrency.',
);

assert.match(
  ciFlowSource,
  /shell-runtime-bootstrap-concurrency-contract\.test\.mjs/,
  'CI flow governance must keep startup bootstrap concurrency in the first-class performance standard.',
);

console.log('shell runtime bootstrap concurrency contract passed.');
