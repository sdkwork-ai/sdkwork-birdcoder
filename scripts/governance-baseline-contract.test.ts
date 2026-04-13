import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BIRDCODER_AUDIT_EVENT_CATEGORIES,
  BIRDCODER_AUDIT_EVENT_FIELDS,
  BIRDCODER_APPROVAL_POLICIES,
  BIRDCODER_PERFORMANCE_BUDGETS,
  BIRDCODER_RISK_LEVELS,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

assert.deepEqual(
  BIRDCODER_PERFORMANCE_BUDGETS,
  {
    webInteractiveMs: 3_000,
    webEntryJsBytes: 500 * 1024,
    webAnyJsAssetBytes: 700 * 1024,
    desktopColdStartMs: 5_000,
    firstTokenMs: 2_000,
    previewRefreshMs: 1_500,
    largeRepoRequiresAsync: true,
  },
  'Step 10 governance should freeze the shared performance budget baseline from docs/架构/08 and docs/step/10.',
);

assert.deepEqual(
  BIRDCODER_RISK_LEVELS,
  ['P0', 'P1', 'P2', 'P3'],
  'Step 10 governance should freeze the shared risk classification baseline from docs/架构/12.',
);

assert.deepEqual(
  BIRDCODER_APPROVAL_POLICIES,
  ['AutoAllow', 'OnRequest', 'Restricted', 'ReleaseOnly'],
  'Step 10 governance should freeze the shared approval policy baseline from docs/架构/12.',
);

assert.deepEqual(
  BIRDCODER_AUDIT_EVENT_FIELDS,
  [
    'traceId',
    'engine',
    'tool',
    'riskLevel',
    'approvalDecision',
    'inputDigest',
    'outputDigest',
    'artifactRefs',
    'operator',
  ],
  'Step 10 governance should freeze the shared audit event field model from docs/架构/12.',
);

assert.deepEqual(
  BIRDCODER_AUDIT_EVENT_CATEGORIES,
  [
    'tool.call',
    'engine.switch',
    'approval.policy.change',
    'release.action',
    'dangerous.command',
    'secret.access',
  ],
  'Step 10 governance should freeze the shared audit event category baseline for release, engine, permission, command, and secret actions.',
);

const webBudgetScriptSource = readFileSync(new URL('./web-bundle-budget.test.mjs', import.meta.url), 'utf8');

assert.equal(
  webBudgetScriptSource.includes('BIRDCODER_PERFORMANCE_BUDGETS'),
  true,
  'web bundle budget gate should read thresholds from the shared governance contract instead of local hard-coded constants.',
);

assert.equal(
  webBudgetScriptSource.includes('BIRDCODER_PERFORMANCE_BUDGETS.webEntryJsBytes'),
  true,
  'web bundle budget gate should consume the shared entry bundle threshold.',
);

assert.equal(
  webBudgetScriptSource.includes('BIRDCODER_PERFORMANCE_BUDGETS.webAnyJsAssetBytes'),
  true,
  'web bundle budget gate should consume the shared largest-asset threshold.',
);

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(
  packageJson.scripts['check:governance-baseline'],
  'node scripts/governance-baseline-contract.test.ts',
  'root scripts should expose a dedicated Step 10 governance baseline gate.',
);

assert.equal(
  packageJson.scripts.lint.includes('pnpm check:governance-baseline'),
  true,
  'root lint gate should include the Step 10 governance baseline contract.',
);

console.log('governance baseline contract passed.');
