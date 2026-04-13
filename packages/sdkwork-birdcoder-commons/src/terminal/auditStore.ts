import { getStoredJson, setStoredJson } from '../storage/localStore.ts';
import { getTerminalProfile, type TerminalProfileId } from './profiles.ts';
import type {
  BirdcoderApprovalDecision,
  BirdcoderApprovalPolicy,
  BirdcoderAuditEventCategory,
  BirdcoderRiskLevel,
} from '@sdkwork/birdcoder-types';

const TERMINAL_GOVERNANCE_AUDIT_SCOPE = 'terminal-governance';
const TERMINAL_GOVERNANCE_AUDIT_KEY = 'audit-log.v1';
const MAX_STORED_TERMINAL_GOVERNANCE_AUDIT_RECORDS = 100;

interface TerminalGovernanceAuditPersistedEntry {
  traceId?: string;
  recordedAt?: number;
  profileId?: string;
  cwd?: string;
  command?: string;
  reason?: string | null;
  approvalPolicy?: string;
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

export interface TerminalGovernanceAuditRecord {
  traceId: string;
  recordedAt: number;
  profileId: TerminalProfileId;
  cwd: string;
  command: string;
  reason: string | null;
  approvalPolicy: BirdcoderApprovalPolicy;
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
  extends TerminalGovernanceAuditRecord {
  recoveryActionId: TerminalGovernanceRecoveryAction['actionId'];
  recoveryActionLabel: TerminalGovernanceRecoveryAction['actionLabel'];
  recoveryDescription: string;
}

export interface TerminalGovernanceDiagnosticsBundleSummary {
  totalRecords: number;
  blockedRecords: number;
  riskLevels: BirdcoderRiskLevel[];
  approvalPolicies: BirdcoderApprovalPolicy[];
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

function normalizeArtifactRefs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function normalizeTerminalGovernanceAuditRecord(
  value: TerminalGovernanceAuditPersistedEntry | null | undefined,
): TerminalGovernanceAuditRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const traceId = value.traceId?.trim();
  const cwd = value.cwd?.trim();
  const command = value.command?.trim();
  const tool = value.tool?.trim();
  const engine = value.engine?.trim();
  const inputDigest = value.inputDigest?.trim();
  const outputDigest = value.outputDigest?.trim();
  const operator = value.operator?.trim();

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

  return {
    traceId,
    recordedAt: typeof value.recordedAt === 'number' ? value.recordedAt : 0,
    profileId,
    cwd,
    command,
    reason: typeof value.reason === 'string' ? value.reason : null,
    approvalPolicy,
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
  record: Pick<TerminalGovernanceAuditRecord, 'approvalDecision'>,
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
  record: Pick<TerminalGovernanceAuditRecord, 'approvalPolicy' | 'command' | 'reason'>,
): string {
  const reason = record.reason?.trim();
  if (reason) {
    return `${reason} Review terminal approval settings or rerun a safer command: ${record.command}.`;
  }

  return `${record.approvalPolicy} policy requires recovery review before rerunning: ${record.command}.`;
}

export function buildTerminalGovernanceDiagnosticBundle(
  records: TerminalGovernanceAuditRecord[],
  options: BuildTerminalGovernanceDiagnosticBundleOptions = {},
): TerminalGovernanceDiagnosticsBundle {
  const generatedAtTimestamp = options.generatedAt ?? Date.now();
  const normalizedRecords = records.map((record) => {
    const recoveryAction = resolveTerminalGovernanceRecoveryAction(record);

    return {
      ...record,
      recoveryActionId: recoveryAction.actionId,
      recoveryActionLabel: recoveryAction.actionLabel,
      recoveryDescription: buildTerminalGovernanceRecoveryDescription(record),
    };
  });

  const summary: TerminalGovernanceDiagnosticsBundleSummary = {
    totalRecords: normalizedRecords.length,
    blockedRecords: normalizedRecords.filter((record) => record.approvalDecision === 'blocked')
      .length,
    riskLevels: Array.from(new Set(normalizedRecords.map((record) => record.riskLevel))),
    approvalPolicies: Array.from(
      new Set(normalizedRecords.map((record) => record.approvalPolicy)),
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
  records: TerminalGovernanceAuditRecord[],
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
    `- Captures ${summary.totalRecords} blocked terminal governance records for release-note triage.`,
    '- Reuses the shared governance audit contract so runtime blocking, recovery, and collaboration stay aligned.',
    '',
    '## Scope',
    '',
    `- Generated At: ${new Date(generatedAtTimestamp).toISOString()}`,
    `- Visible Records: ${summary.totalRecords}`,
    `- Blocked Records: ${summary.blockedRecords}`,
    `- Approval Policies: ${summary.approvalPolicies.join(', ') || 'none'}`,
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

export async function listStoredTerminalGovernanceAuditRecords(): Promise<
  TerminalGovernanceAuditRecord[]
> {
  const storedEntries = await getStoredJson<TerminalGovernanceAuditPersistedEntry[]>(
    TERMINAL_GOVERNANCE_AUDIT_SCOPE,
    TERMINAL_GOVERNANCE_AUDIT_KEY,
    [],
  );

  return storedEntries
    .map((entry) => normalizeTerminalGovernanceAuditRecord(entry))
    .filter((entry): entry is TerminalGovernanceAuditRecord => entry !== null)
    .sort((left, right) => right.recordedAt - left.recordedAt);
}

export async function saveStoredTerminalGovernanceAuditRecord(
  record: TerminalGovernanceAuditRecord,
): Promise<TerminalGovernanceAuditRecord[]> {
  const normalizedRecord = normalizeTerminalGovernanceAuditRecord(record);
  if (!normalizedRecord) {
    return [];
  }

  const existingRecords = await listStoredTerminalGovernanceAuditRecords();
  const nextRecords = [
    normalizedRecord,
    ...existingRecords.filter((entry) => entry.traceId !== normalizedRecord.traceId),
  ]
    .sort((left, right) => right.recordedAt - left.recordedAt)
    .slice(0, MAX_STORED_TERMINAL_GOVERNANCE_AUDIT_RECORDS);

  await setStoredJson(
    TERMINAL_GOVERNANCE_AUDIT_SCOPE,
    TERMINAL_GOVERNANCE_AUDIT_KEY,
    nextRecords,
  );

  return nextRecords;
}
