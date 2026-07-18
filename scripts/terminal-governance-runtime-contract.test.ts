import assert from 'node:assert/strict';

import {
  buildTerminalCommandAuditEvent,
  classifyTerminalCommandRisk,
  evaluateTerminalCommandGovernance,
  sanitizeTerminalCommandForAudit,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runtime.ts';
import {
  resolveBirdcoderTerminalLaunchRequest,
  type BirdcoderTerminalGovernanceRuntime,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/sdkworkTerminalLaunch.ts';
import type { TerminalGovernanceAuditRecord } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/auditStore.ts';

assert.equal(classifyTerminalCommandRisk('git status'), 'P0');
assert.equal(classifyTerminalCommandRisk('git status && npm install'), 'P2');
assert.equal(classifyTerminalCommandRisk('echo ok > output.txt'), 'P2');
assert.equal(classifyTerminalCommandRisk('rm -rf build'), 'P3');
assert.equal(classifyTerminalCommandRisk('Remove-Item build -Recurse -Force'), 'P3');
assert.equal(
  classifyTerminalCommandRisk('Write-Output @(Remove-Item -Recurse -Force C:/tmp/example)'),
  'P3',
);
assert.equal(classifyTerminalCommandRisk('echo ok; rm -rf build'), 'P3');
assert.equal(classifyTerminalCommandRisk('rg "rm -rf" docs'), 'P0');
assert.equal(classifyTerminalCommandRisk('pnpm run format'), 'P2');

const safeDecision = await evaluateTerminalCommandGovernance('git status', {
  approvalPolicy: 'OnRequest',
  sandboxSettings: 'ReadOnly',
});
assert.equal(safeDecision.allowed, true);
assert.equal(safeDecision.approvalDecision, 'auto_allowed');
const repeatedSafeDecision = await evaluateTerminalCommandGovernance('git status', {
  approvalPolicy: 'OnRequest',
  sandboxSettings: 'ReadOnly',
});
assert.notEqual(repeatedSafeDecision.traceId, safeDecision.traceId);

const approvalRequiredDecision = await evaluateTerminalCommandGovernance('npm test', {
  approvalPolicy: 'OnRequest',
  sandboxSettings: 'FullAccess',
});
assert.equal(approvalRequiredDecision.allowed, false);
assert.match(approvalRequiredDecision.reason ?? '', /approval is not available/iu);

const readOnlyDecision = await evaluateTerminalCommandGovernance('npm test', {
  approvalPolicy: 'AutoAllow',
  sandboxSettings: 'ReadOnly',
});
assert.equal(readOnlyDecision.allowed, false);
assert.match(readOnlyDecision.reason ?? '', /read-only command guard/iu);

const destructiveDecision = await evaluateTerminalCommandGovernance('git reset --hard HEAD', {
  approvalPolicy: 'AutoAllow',
  sandboxSettings: 'ReadWrite',
});
assert.equal(destructiveDecision.allowed, false);
assert.equal(destructiveDecision.riskLevel, 'P3');
const wrappedDestructiveDecision = await evaluateTerminalCommandGovernance(
  'Write-Output @(Remove-Item -Recurse -Force C:/tmp/example)',
  {
    approvalPolicy: 'OnRequest',
    sandboxSettings: 'ReadOnly',
  },
);
assert.equal(wrappedDestructiveDecision.allowed, false);
assert.equal(wrappedDestructiveDecision.riskLevel, 'P3');

assert.equal(
  sanitizeTerminalCommandForAudit(
    'TOKEN=plain curl --api-key secret -H "Authorization: Bearer bearer-secret"',
  ),
  'TOKEN=<redacted> curl --api-key <redacted> -H "Authorization: Bearer <redacted>"',
);
assert.equal(
  sanitizeTerminalCommandForAudit(
    'curl --password "secret with spaces" https://user:password@example.com',
  ),
  'curl --password <redacted> https://<redacted>@example.com',
);

const auditDecision = await evaluateTerminalCommandGovernance('git status', {
  approvalPolicy: 'AutoAllow',
  sandboxSettings: 'ReadOnly',
});
const firstSecretAudit = buildTerminalCommandAuditEvent({
  profileId: 'powershell',
  cwd: 'C:\\workspace',
  command: 'TOKEN=first git status',
  decision: auditDecision,
});
const secondSecretAudit = buildTerminalCommandAuditEvent({
  profileId: 'powershell',
  cwd: 'C:\\workspace',
  command: 'TOKEN=second git status',
  decision: auditDecision,
});
assert.equal(firstSecretAudit.inputDigest, secondSecretAudit.inputDigest);

function createGovernanceRuntime(
  settings: Parameters<typeof evaluateTerminalCommandGovernance>[1],
  auditRecords: TerminalGovernanceAuditRecord[],
): BirdcoderTerminalGovernanceRuntime {
  return {
    evaluateCommand: (command) => evaluateTerminalCommandGovernance(command, settings),
    saveAuditRecord: async (record) => {
      auditRecords.push(record);
    },
    now: () => 1_700_000_000_000,
  };
}

const blockedAuditRecords: TerminalGovernanceAuditRecord[] = [];
const blockedResolution = await resolveBirdcoderTerminalLaunchRequest(
  {
    surface: 'embedded',
    path: 'C:\\workspace',
    command: 'npm test',
    profileId: 'powershell',
    timestamp: 1,
  },
  {},
  createGovernanceRuntime(
    {
      approvalPolicy: 'AutoAllow',
      sandboxSettings: 'ReadOnly',
    },
    blockedAuditRecords,
  ),
);
assert.equal(blockedResolution.plan, null);
assert.match(blockedResolution.blockedMessage ?? '', /read-only command guard/iu);
assert.equal(blockedAuditRecords.length, 1);
assert.equal(blockedAuditRecords[0]?.approvalDecision, 'blocked');
assert.equal(blockedAuditRecords[0]?.sandboxSettings, 'ReadOnly');

const allowedAuditRecords: TerminalGovernanceAuditRecord[] = [];
const allowedResolution = await resolveBirdcoderTerminalLaunchRequest(
  {
    surface: 'embedded',
    path: 'C:\\workspace',
    command: 'TOKEN=secret npm test',
    profileId: 'powershell',
    timestamp: 2,
  },
  {},
  createGovernanceRuntime(
    {
      approvalPolicy: 'AutoAllow',
      sandboxSettings: 'ReadWrite',
    },
    allowedAuditRecords,
  ),
);
assert.equal(allowedResolution.blockedMessage, null);
assert.equal(allowedResolution.plan?.kind, 'local-process');
assert.equal(allowedAuditRecords.length, 1);
assert.equal(allowedAuditRecords[0]?.command, 'TOKEN=<redacted> npm test');
assert.equal(allowedAuditRecords[0]?.approvalDecision, 'auto_allowed');

const auditFailureResolution = await resolveBirdcoderTerminalLaunchRequest(
  {
    surface: 'embedded',
    path: 'C:\\workspace',
    command: 'git status',
    profileId: 'powershell',
    timestamp: 3,
  },
  {},
  {
    evaluateCommand: (command) =>
      evaluateTerminalCommandGovernance(command, {
        approvalPolicy: 'AutoAllow',
        sandboxSettings: 'FullAccess',
      }),
    saveAuditRecord: async () => {
      throw new Error('storage unavailable');
    },
    now: () => 1_700_000_000_000,
  },
);
assert.equal(auditFailureResolution.plan, null);
assert.match(auditFailureResolution.blockedMessage ?? '', /could not be evaluated or audited/iu);

console.log('terminal governance runtime contract passed.');
