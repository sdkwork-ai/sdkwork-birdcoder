import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildLocalStoreKey } from '../packages/sdkwork-birdcoder-commons/src/storage/localStore.ts';
import {
  buildTerminalGovernanceDiagnosticBundle,
  buildTerminalGovernanceReleaseNoteTemplate,
  buildTerminalGovernanceRecoveryDescription,
  listStoredTerminalGovernanceAuditRecords,
  resolveTerminalGovernanceRecoveryAction,
} from '../packages/sdkwork-birdcoder-commons/src/terminal/auditStore.ts';
import {
  buildTerminalCommandAuditEvent,
  classifyTerminalCommandRisk,
  evaluateTerminalCommandGovernance,
  executeTerminalCommand,
  normalizeTerminalApprovalPolicy,
} from '../packages/sdkwork-birdcoder-commons/src/terminal/runtime.ts';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

interface TerminalGovernanceTestWindow {
  __TAURI__?: unknown;
  localStorage: Storage;
}

const runtimeGlobals = globalThis as unknown as {
  window?: TerminalGovernanceTestWindow;
};
const originalWindow = runtimeGlobals.window;
const localStorage = new MemoryStorage() as Storage;
runtimeGlobals.window = {
  __TAURI__: undefined,
  localStorage,
};

localStorage.setItem(
  buildLocalStoreKey('settings', 'app'),
  JSON.stringify({
    approvalPolicy: 'Restricted',
    sandboxSettings: 'Read only',
  }),
);

assert.equal(normalizeTerminalApprovalPolicy('On request'), 'OnRequest');
assert.equal(normalizeTerminalApprovalPolicy('Restricted'), 'Restricted');

assert.equal(
  classifyTerminalCommandRisk('Get-ChildItem'),
  'P0',
  'read-only shell commands should classify as the lowest governance risk.',
);

assert.equal(
  classifyTerminalCommandRisk('rm -rf .'),
  'P3',
  'destructive shell commands should classify as the highest governance risk.',
);

const blockedDecision = await evaluateTerminalCommandGovernance('rm -rf .');
assert.equal(blockedDecision.allowed, false);
assert.equal(blockedDecision.riskLevel, 'P3');
assert.equal(blockedDecision.approvalPolicy, 'Restricted');
assert.match(
  blockedDecision.reason ?? '',
  /Restricted policy blocked high-risk terminal command/i,
);

const blockedAuditEvent = buildTerminalCommandAuditEvent(
  {
    profileId: 'powershell',
    cwd: '/workspace/demo',
    command: 'rm -rf .',
    decision: blockedDecision,
  },
  1700000000000,
);

assert.equal(blockedAuditEvent.category, 'dangerous.command');
assert.equal(blockedAuditEvent.tool, 'terminal.exec');
assert.equal(blockedAuditEvent.riskLevel, 'P3');
assert.equal(blockedAuditEvent.approvalDecision, 'blocked');
assert.equal(blockedAuditEvent.operator, 'terminal:powershell');
assert.equal(blockedAuditEvent.artifactRefs[0], 'cwd:/workspace/demo');

const blockedExecution = await executeTerminalCommand('powershell', 'rm -rf .', '/workspace/demo');
assert.equal(blockedExecution.exitCode, 130);
assert.equal(blockedExecution.executedVia, 'mock');
assert.match(blockedExecution.stderr, /Blocked by governance policy/i);
assert.match(blockedExecution.stderr, /traceId=/i);

const storedBlockedAudits = await listStoredTerminalGovernanceAuditRecords();
assert.equal(storedBlockedAudits.length, 1);
assert.equal(storedBlockedAudits[0].command, 'rm -rf .');
assert.equal(storedBlockedAudits[0].cwd, '/workspace/demo');
assert.equal(storedBlockedAudits[0].profileId, 'powershell');
assert.equal(storedBlockedAudits[0].approvalPolicy, 'Restricted');
assert.equal(storedBlockedAudits[0].approvalDecision, 'blocked');
assert.equal(storedBlockedAudits[0].category, 'dangerous.command');
assert.equal(resolveTerminalGovernanceRecoveryAction(storedBlockedAudits[0]).actionId, 'open-settings');
assert.equal(
  resolveTerminalGovernanceRecoveryAction(storedBlockedAudits[0]).actionLabel,
  'Open Settings',
);
assert.match(
  buildTerminalGovernanceRecoveryDescription(storedBlockedAudits[0]),
  /Review terminal approval settings or rerun a safer command/i,
);
const diagnosticBundle = buildTerminalGovernanceDiagnosticBundle(storedBlockedAudits, {
  generatedAt: 1700000005000,
});
assert.equal(diagnosticBundle.scope, 'terminal-governance');
assert.equal(diagnosticBundle.summary.totalRecords, 1);
assert.equal(diagnosticBundle.summary.blockedRecords, 1);
assert.deepEqual(diagnosticBundle.summary.riskLevels, ['P3']);
assert.deepEqual(diagnosticBundle.summary.approvalPolicies, ['Restricted']);
assert.equal(diagnosticBundle.records[0].recoveryActionId, 'open-settings');
assert.match(diagnosticBundle.records[0].recoveryDescription, /Review terminal approval settings/i);
assert.match(diagnosticBundle.content, /"scope": "terminal-governance"/i);
assert.match(diagnosticBundle.content, /"recoveryActionId": "open-settings"/i);
const governanceReleaseNote = buildTerminalGovernanceReleaseNoteTemplate(storedBlockedAudits, {
  generatedAt: 1700000005000,
});
assert.match(governanceReleaseNote.content, /## Highlights/);
assert.match(governanceReleaseNote.content, /Visible Records: 1/);
assert.match(governanceReleaseNote.content, /Restricted/);
assert.match(governanceReleaseNote.content, /P3/);
assert.match(governanceReleaseNote.content, /rm -rf \./);
assert.match(governanceReleaseNote.content, /Source: Terminal Governance Recovery/);
assert.equal(
  localStorage.getItem(buildLocalStoreKey('terminal-governance', 'audit-log.v1')) !== null,
  true,
);

const allowedExecution = await executeTerminalCommand('powershell', 'Get-ChildItem', '/workspace/demo');
assert.equal(allowedExecution.exitCode, 0);
assert.equal(allowedExecution.stderr, '');

const storedAuditsAfterAllowedCommand = await listStoredTerminalGovernanceAuditRecords();
assert.equal(
  storedAuditsAfterAllowedCommand.length,
  1,
  'read-only commands should not add extra governance audit records in the first persistence slice.',
);

const terminalPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-terminal/src/pages/TerminalPage.tsx', import.meta.url),
  'utf8',
);
assert.match(
  terminalPageSource,
  /buildTerminalGovernanceDiagnosticBundle/,
  'TerminalPage should consume the shared governance diagnostics bundle builder.',
);
assert.match(
  terminalPageSource,
  /buildTerminalGovernanceReleaseNoteTemplate/,
  'TerminalPage should consume the shared governance release-note template builder.',
);
assert.match(
  terminalPageSource,
  /navigator\.clipboard\.writeText\(governanceBundle\.content\)/,
  'TerminalPage should copy the governance diagnostics bundle into the clipboard.',
);
assert.match(
  terminalPageSource,
  /navigator\.clipboard\.writeText\(governanceReleaseNote\.content\)/,
  'TerminalPage should copy the governance release-note template into the clipboard.',
);
assert.match(
  terminalPageSource,
  /Copy Diagnostics/,
  'TerminalPage should expose a copy diagnostics action for governance recovery records.',
);
assert.match(
  terminalPageSource,
  /Copy Release Note/,
  'TerminalPage should expose a copy release-note action for governance recovery records.',
);
assert.doesNotMatch(
  terminalPageSource,
  /void createFile\(target\);/,
  'TerminalPage browser fallback must not mutate files directly for touch commands.',
);
assert.doesNotMatch(
  terminalPageSource,
  /void createFolder\(target\);/,
  'TerminalPage browser fallback must not mutate files directly for mkdir commands.',
);
assert.doesNotMatch(
  terminalPageSource,
  /void deleteFolder\(actualTarget\);/,
  'TerminalPage browser fallback must not mutate folders directly for recursive rm commands.',
);
assert.doesNotMatch(
  terminalPageSource,
  /void deleteFile\(target\);/,
  'TerminalPage browser fallback must not mutate files directly for rm commands.',
);
assert.doesNotMatch(
  terminalPageSource,
  /void renameNode\(parts\[0\], parts\[1\]\);/,
  'TerminalPage browser fallback must not mutate files directly for mv commands.',
);

if (originalWindow) {
  runtimeGlobals.window = originalWindow;
} else {
  delete runtimeGlobals.window;
}

console.log('terminal governance contract passed.');
