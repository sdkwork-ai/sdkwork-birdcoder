import { APP_SESSION_CHANGE_EVENT_NAME } from '@sdkwork/birdcoder-pc-infrastructure/services/appSessionEvents';
import type {
  BirdcoderApprovalDecision,
  BirdcoderApprovalPolicy,
  BirdcoderAuditEventCategory,
  BirdcoderRiskLevel,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import {
  parseTerminalCommandGuardSetting,
  type TerminalCommandGuardSetting,
} from '../settings/appSettings.ts';
import { getTerminalProfile, type TerminalProfileId } from './profiles.ts';
import { sanitizeTerminalCommandForAudit } from './runtime.ts';

const MAX_TRANSIENT_TERMINAL_GOVERNANCE_DIAGNOSTICS = 100;
const MAX_TRACE_ID_LENGTH = 256;
const MAX_WORKING_DIRECTORY_LENGTH = 4_096;
const MAX_COMMAND_LENGTH = 16_384;
const MAX_REASON_LENGTH = 4_096;
const MAX_IDENTITY_FIELD_LENGTH = 256;
const MAX_DIGEST_LENGTH = 256;
const MAX_ARTIFACT_REFS = 32;
const MAX_ARTIFACT_REF_LENGTH = 2_048;

export interface TerminalGovernanceDiagnosticInput {
  traceId?: string;
  recordedAt?: number;
  profileId?: string;
  cwd?: string;
  command?: string;
  reason?: string | null;
  approvalPolicy?: string;
  sandboxSettings?: string;
  category?: string;
  engine?: string;
  tool?: string;
  riskLevel?: string;
  approvalDecision?: string;
  inputDigest?: string;
  outputDigest?: string;
  artifactRefs?: unknown;
  operator?: string;
}

export interface TerminalGovernanceDiagnosticRecord {
  traceId: string;
  recordedAt: number;
  profileId: TerminalProfileId;
  cwd: string;
  command: string;
  reason: string | null;
  approvalPolicy: BirdcoderApprovalPolicy;
  sandboxSettings: TerminalCommandGuardSetting | 'Unspecified';
  category: BirdcoderAuditEventCategory;
  engine: string;
  tool: string;
  riskLevel: BirdcoderRiskLevel;
  approvalDecision: BirdcoderApprovalDecision;
  inputDigest: string;
  outputDigest: string;
  artifactRefs: string[];
  operator: string;
}

export interface TerminalGovernanceRecoveryAction {
  actionId: 'open-settings' | null;
  actionLabel: 'Open Settings' | null;
}

export interface TerminalGovernanceDiagnosticsBundleRecord
  extends TerminalGovernanceDiagnosticRecord {
  recoveryActionId: TerminalGovernanceRecoveryAction['actionId'];
  recoveryActionLabel: TerminalGovernanceRecoveryAction['actionLabel'];
  recoveryDescription: string;
}

export interface TerminalGovernanceDiagnosticsBundleSummary {
  totalRecords: number;
  blockedRecords: number;
  riskLevels: BirdcoderRiskLevel[];
  approvalPolicies: BirdcoderApprovalPolicy[];
  sandboxSettings: Array<TerminalCommandGuardSetting | 'Unspecified'>;
}

export interface TerminalGovernanceDiagnosticsBundle {
  scope: 'terminal-governance';
  generatedAt: string;
  filename: string;
  summary: TerminalGovernanceDiagnosticsBundleSummary;
  records: TerminalGovernanceDiagnosticsBundleRecord[];
  content: string;
}

export interface BuildTerminalGovernanceDiagnosticBundleOptions {
  generatedAt?: number;
}

export interface TerminalGovernanceReleaseNoteTemplate {
  content: string;
}

export interface BuildTerminalGovernanceReleaseNoteTemplateOptions {
  generatedAt?: number;
}

let terminalGovernanceDiagnostics: TerminalGovernanceDiagnosticRecord[] = [];

function normalizeRequiredText(
  value: string | undefined,
  maximumLength: number,
): string | null {
  const normalized = value?.trim();
  if (!normalized || normalized.length > maximumLength) {
    return null;
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
  maximumLength: number,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maximumLength);
}

function normalizeArtifactRefs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, MAX_ARTIFACT_REFS)
    .map((item) => item.slice(0, MAX_ARTIFACT_REF_LENGTH));
}

function cloneTerminalGovernanceDiagnostic(
  record: TerminalGovernanceDiagnosticRecord,
): TerminalGovernanceDiagnosticRecord {
  return {
    ...record,
    artifactRefs: [...record.artifactRefs],
  };
}

export function normalizeTerminalGovernanceDiagnostic(
  value: TerminalGovernanceDiagnosticInput | null | undefined,
): TerminalGovernanceDiagnosticRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const traceId = normalizeRequiredText(value.traceId, MAX_TRACE_ID_LENGTH);
  const cwd = normalizeRequiredText(value.cwd, MAX_WORKING_DIRECTORY_LENGTH);
  const command = normalizeRequiredText(
    sanitizeTerminalCommandForAudit(value.command ?? ''),
    MAX_COMMAND_LENGTH,
  );
  const tool = normalizeRequiredText(value.tool, MAX_IDENTITY_FIELD_LENGTH);
  const engine = normalizeRequiredText(value.engine, MAX_IDENTITY_FIELD_LENGTH);
  const inputDigest = normalizeRequiredText(value.inputDigest, MAX_DIGEST_LENGTH);
  const outputDigest = normalizeRequiredText(value.outputDigest, MAX_DIGEST_LENGTH);
  const operator = normalizeRequiredText(value.operator, MAX_IDENTITY_FIELD_LENGTH);

  if (
    !traceId ||
    !cwd ||
    !command ||
    !tool ||
    !engine ||
    !inputDigest ||
    !outputDigest ||
    !operator
  ) {
    return null;
  }

  const profileId = getTerminalProfile(value.profileId ?? 'powershell').id;
  const approvalPolicy =
    value.approvalPolicy === 'AutoAllow' ||
    value.approvalPolicy === 'OnRequest' ||
    value.approvalPolicy === 'Restricted' ||
    value.approvalPolicy === 'ReleaseOnly'
      ? value.approvalPolicy
      : 'OnRequest';
  const sandboxSettings =
    parseTerminalCommandGuardSetting(value.sandboxSettings) ?? 'Unspecified';
  const category =
    value.category === 'tool.call' ||
    value.category === 'engine.switch' ||
    value.category === 'approval.policy.change' ||
    value.category === 'release.action' ||
    value.category === 'dangerous.command' ||
    value.category === 'secret.access'
      ? value.category
      : 'tool.call';
  const riskLevel =
    value.riskLevel === 'P0' ||
    value.riskLevel === 'P1' ||
    value.riskLevel === 'P2' ||
    value.riskLevel === 'P3'
      ? value.riskLevel
      : 'P0';
  const approvalDecision =
    value.approvalDecision === 'auto_allowed' ||
    value.approvalDecision === 'approved' ||
    value.approvalDecision === 'denied' ||
    value.approvalDecision === 'blocked'
      ? value.approvalDecision
      : 'blocked';
  const recordedAt =
    typeof value.recordedAt === 'number' &&
    Number.isSafeInteger(value.recordedAt) &&
    value.recordedAt >= 0
      ? value.recordedAt
      : 0;

  return {
    traceId,
    recordedAt,
    profileId,
    cwd,
    command,
    reason: normalizeOptionalText(value.reason, MAX_REASON_LENGTH),
    approvalPolicy,
    sandboxSettings,
    category,
    engine,
    tool,
    riskLevel,
    approvalDecision,
    inputDigest,
    outputDigest,
    artifactRefs: normalizeArtifactRefs(value.artifactRefs),
    operator,
  };
}

export function resolveTerminalGovernanceRecoveryAction(
  record: Pick<TerminalGovernanceDiagnosticRecord, 'approvalDecision'>,
): TerminalGovernanceRecoveryAction {
  if (record.approvalDecision === 'blocked') {
    return {
      actionId: 'open-settings',
      actionLabel: 'Open Settings',
    };
  }

  return {
    actionId: null,
    actionLabel: null,
  };
}

export function buildTerminalGovernanceRecoveryDescription(
  record: Pick<
    TerminalGovernanceDiagnosticRecord,
    'approvalPolicy' | 'command' | 'reason'
  >,
): string {
  const reason = record.reason?.trim();
  if (reason) {
    return `${reason} Review terminal approval settings or rerun a safer command: ${record.command}.`;
  }

  return `${record.approvalPolicy} policy requires recovery review before rerunning: ${record.command}.`;
}

export function buildTerminalGovernanceDiagnosticBundle(
  records: TerminalGovernanceDiagnosticRecord[],
  options: BuildTerminalGovernanceDiagnosticBundleOptions = {},
): TerminalGovernanceDiagnosticsBundle {
  const generatedAtTimestamp = options.generatedAt ?? Date.now();
  const normalizedRecords = records.map((record) => {
    const recoveryAction = resolveTerminalGovernanceRecoveryAction(record);

    return {
      ...cloneTerminalGovernanceDiagnostic(record),
      recoveryActionId: recoveryAction.actionId,
      recoveryActionLabel: recoveryAction.actionLabel,
      recoveryDescription: buildTerminalGovernanceRecoveryDescription(record),
    };
  });

  const summary: TerminalGovernanceDiagnosticsBundleSummary = {
    totalRecords: normalizedRecords.length,
    blockedRecords: normalizedRecords.filter(
      (record) => record.approvalDecision === 'blocked',
    ).length,
    riskLevels: Array.from(new Set(normalizedRecords.map((record) => record.riskLevel))),
    approvalPolicies: Array.from(
      new Set(normalizedRecords.map((record) => record.approvalPolicy)),
    ),
    sandboxSettings: Array.from(
      new Set(normalizedRecords.map((record) => record.sandboxSettings)),
    ),
  };

  const payload = {
    scope: 'terminal-governance' as const,
    generatedAt: new Date(generatedAtTimestamp).toISOString(),
    summary,
    records: normalizedRecords,
  };

  return {
    ...payload,
    filename: `terminal-governance-diagnostics-${generatedAtTimestamp}.json`,
    content: JSON.stringify(payload, null, 2),
  };
}

export function buildTerminalGovernanceReleaseNoteTemplate(
  records: TerminalGovernanceDiagnosticRecord[],
  options: BuildTerminalGovernanceReleaseNoteTemplateOptions = {},
): TerminalGovernanceReleaseNoteTemplate {
  const generatedAtTimestamp = options.generatedAt ?? Date.now();
  const summary = buildTerminalGovernanceDiagnosticBundle(records, {
    generatedAt: generatedAtTimestamp,
  }).summary;
  const commands = records.map((record) => record.command);
  const lines = [
    '## Highlights',
    '',
    `- Captures ${summary.totalRecords} transient terminal governance diagnostics for release-note triage.`,
    '- Reuses the shared governance event contract so runtime blocking and recovery stay aligned.',
    '',
    '## Scope',
    '',
    `- Generated At: ${new Date(generatedAtTimestamp).toISOString()}`,
    `- Visible Records: ${summary.totalRecords}`,
    `- Blocked Records: ${summary.blockedRecords}`,
    `- Approval Policies: ${summary.approvalPolicies.join(', ') || 'none'}`,
    `- Command Guards: ${summary.sandboxSettings.join(', ') || 'none'}`,
    `- Risk Levels: ${summary.riskLevels.join(', ') || 'none'}`,
    '',
    '## Verification',
    '',
    '- [ ] Confirm the blocked command and recovery guidance match the intended policy.',
    '- [ ] Attach the copied governance diagnostics bundle if deeper triage is required.',
    '',
    '## Notes',
    `- Commands: ${commands.join(', ') || 'none'}`,
    '- Source: Terminal Governance Recovery',
  ];

  return {
    content: lines.join('\n').trim(),
  };
}

export function listTerminalGovernanceDiagnostics(): TerminalGovernanceDiagnosticRecord[] {
  return terminalGovernanceDiagnostics.map(cloneTerminalGovernanceDiagnostic);
}

export function clearTerminalGovernanceDiagnostics(): void {
  terminalGovernanceDiagnostics = [];
}

export async function recordTerminalGovernanceDiagnostic(
  record: TerminalGovernanceDiagnosticRecord,
): Promise<TerminalGovernanceDiagnosticRecord[]> {
  const normalizedRecord = normalizeTerminalGovernanceDiagnostic(record);
  if (!normalizedRecord) {
    throw new Error('Invalid terminal governance diagnostic record.');
  }

  terminalGovernanceDiagnostics = [
    normalizedRecord,
    ...terminalGovernanceDiagnostics.filter(
      (entry) => entry.traceId !== normalizedRecord.traceId,
    ),
  ]
    .sort((left, right) => right.recordedAt - left.recordedAt)
    .slice(0, MAX_TRANSIENT_TERMINAL_GOVERNANCE_DIAGNOSTICS);

  return listTerminalGovernanceDiagnostics();
}

globalThis.addEventListener?.(
  APP_SESSION_CHANGE_EVENT_NAME,
  clearTerminalGovernanceDiagnostics,
);
