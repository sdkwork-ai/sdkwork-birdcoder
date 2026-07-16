import type { TerminalExecutionPlan, TerminalProfileId } from './profiles.ts';
import { getStoredJson } from '../storage/localStore.ts';
import {
  normalizeTerminalApprovalPolicySetting,
  normalizeTerminalCommandGuardSetting,
  type TerminalApprovalPolicySetting,
  type TerminalCommandGuardSetting,
} from '../settings/appSettings.ts';
export * from './profileAvailability.ts';
export {
  areTerminalCommandRequestsEqual,
  buildDefaultTerminalCommandRequest,
  emitOpenTerminalRequest,
  emitOpenTerminalVisibility,
  type TerminalCommandRequest,
  type TerminalCommandSurface,
} from './requests.ts';
import type {
  BirdcoderApprovalDecision,
  BirdcoderApprovalPolicy,
  BirdcoderAuditEvent,
  BirdcoderAuditEventCategory,
  BirdcoderRiskLevel,
} from '@sdkwork/birdcoder-pc-types';

export interface TerminalExecutionResult {
  profileId: TerminalProfileId;
  kind: TerminalExecutionPlan['kind'];
  executable: string;
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  executedVia: 'policy-blocked' | 'tauri' | 'unsupported-runtime';
}

export interface TerminalGovernanceSettings {
  approvalPolicy: TerminalApprovalPolicySetting;
  sandboxSettings: TerminalCommandGuardSetting;
}

export interface TerminalCommandGovernanceDecision {
  traceId: string;
  approvalPolicy: BirdcoderApprovalPolicy;
  sandboxSettings: TerminalCommandGuardSetting;
  riskLevel: BirdcoderRiskLevel;
  approvalDecision: BirdcoderApprovalDecision;
  allowed: boolean;
  reason: string | null;
  category: BirdcoderAuditEventCategory;
}

export interface TerminalCommandAuditEventInput {
  profileId: TerminalProfileId;
  cwd: string;
  command: string;
  decision: TerminalCommandGovernanceDecision;
}

const DEFAULT_TERMINAL_GOVERNANCE_SETTINGS: TerminalGovernanceSettings = {
  approvalPolicy: 'OnRequest',
  sandboxSettings: 'ReadOnly',
};

// This is a conservative UI preflight for BirdCoder-launched commands, not an OS sandbox.
const READ_ONLY_TERMINAL_COMMAND_PATTERNS = [
  /^\s*(pwd|whoami|get-location)\s*$/iu,
  /^\s*(ls|dir|get-childitem)(?:\s+[^\r\n]*)?$/iu,
  /^\s*(cat|type|get-content)(?:\s+[^\r\n]*)?$/iu,
  /^\s*(which|where|get-command)(?:\s+[^\r\n]*)?$/iu,
  /^\s*(echo|write-output)(?:\s+[^\r\n]*)?$/iu,
  /^\s*(rg|findstr)(?:\s+[^\r\n]*)?$/iu,
  /^\s*git\s+status(?:\s+[^\r\n]*)?$/iu,
] as const;

const HIGH_RISK_TERMINAL_COMMAND_PATTERNS = [
  /(?:^|&&|\|\||[;&|])\s*(?:(?:sudo|doas)\s+)?rm\b[^\r\n]*(?:-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive|--force)/iu,
  /(?:^|&&|\|\||[;&|])\s*(del|erase)\b[^\r\n]*(?:\/f|\/s|\/q)/iu,
  /(?:^|&&|\|\||[;&|])\s*(rd|rmdir)\b[^\r\n]*(?:\/s|--ignore-fail-on-non-empty)/iu,
  /(?:^|&&|\|\||[;&|])\s*(?:format(?:\.com)?\s+[a-z]:|format-volume\b|mkfs(?:\.[a-z0-9_-]+)?\b|diskpart\b)/iu,
  /(?:^|&&|\|\||[;&|])\s*(?:(?:sudo|doas)\s+)?dd\b[^\r\n]*\bof=/iu,
  /(?:^|&&|\|\||[;&|])\s*(?:(?:sudo|doas)\s+)?(shutdown|reboot|restart-computer|stop-computer)\b/iu,
  /(?:^|&&|\|\||[;&|])\s*git\s+reset\s+--hard\b/iu,
  /(?:^|&&|\|\||[;&|])\s*git\s+clean\b[^\r\n]*(?:-f|--force)/iu,
  /(?:^|&&|\|\||[;&|])\s*remove-item\b(?=[^\r\n]*(?:-recurse|-[a-z]*r[a-z]*))(?=[^\r\n]*(?:-force|-[a-z]*f[a-z]*))[^\r\n]*/iu,
  /(?:^|&&|\|\||[;&|]|\$\(|@\()\s*remove-item\b[^\r\n]*(?:-recurse|-[a-z]*r[a-z]*)[^\r\n]*(?:-force|-[a-z]*f[a-z]*)/iu,
  /(?:^|&&|\|\||[;&|]|\$\(|@\()\s*(?:rm|del|erase|rmdir)\b[^\r\n]*(?:-rf|\/s|\/f|\/q|--recursive|--force)/iu,
] as const;

const READ_ONLY_COMMAND_ESCAPE_PATTERNS = [
  /&&|\|\||[;&|<>`]|\$\(|@\(/u,
  /\brg\b[^\r\n]*--pre(?:=|\s)/iu,
] as const;

const TERMINAL_AUDIT_SECRET_ARGUMENT_PATTERN =
  /((?:--?|\/)(?:access[-_]?token|api[-_]?key|authorization|credential|password|refresh[-_]?token|secret|token)(?:=|\s+))("[^"]*"|'[^']*'|[^\s"']+)/giu;
const TERMINAL_AUDIT_SECRET_ENV_PATTERN =
  /\b([A-Z0-9_]*(?:ACCESS_TOKEN|API_KEY|AUTHORIZATION|CREDENTIAL|PASSWORD|REFRESH_TOKEN|SECRET|TOKEN)[A-Z0-9_]*)=("[^"]*"|'[^']*'|[^\s"']+)/giu;
const TERMINAL_AUDIT_BEARER_PATTERN = /\bBearer\s+[^\s"']+/giu;
const TERMINAL_AUDIT_URL_CREDENTIAL_PATTERN =
  /\b(https?:\/\/)[^\s\/:@]+:[^\s\/@]+@/giu;

let terminalGovernanceTraceSequence = 0;

function buildTerminalGovernanceDigest(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildTerminalGovernanceTraceId(command: string, timestamp = Date.now()): string {
  terminalGovernanceTraceSequence =
    (terminalGovernanceTraceSequence + 1) % Number.MAX_SAFE_INTEGER;
  return [
    'terminal-governance',
    timestamp.toString(36),
    terminalGovernanceTraceSequence.toString(36),
    buildTerminalGovernanceDigest(command),
  ].join(':');
}

async function loadTerminalGovernanceSettings(): Promise<TerminalGovernanceSettings> {
  const storedSettings = await getStoredJson<Record<string, unknown>>('settings', 'app', {});
  return {
    approvalPolicy: normalizeTerminalApprovalPolicySetting(
      storedSettings.approvalPolicy,
      DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.approvalPolicy,
    ),
    sandboxSettings: normalizeTerminalCommandGuardSetting(
      storedSettings.sandboxSettings,
      DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.sandboxSettings,
    ),
  };
}
function buildApprovalPolicyBlockedReason(
  approvalPolicy: TerminalApprovalPolicySetting,
  riskLevel: BirdcoderRiskLevel,
): string {
  if (approvalPolicy === 'OnRequest') {
    return 'Approval is required, but interactive terminal approval is not available. The command was blocked.';
  }

  if (approvalPolicy === 'ReleaseOnly') {
    return 'ReleaseOnly policy cannot verify a release lane for this terminal launch. The command was blocked.';
  }

  if (riskLevel === 'P3') {
    return 'Restricted policy blocked high-risk terminal command.';
  }

  return 'Restricted policy blocked side-effecting terminal command.';
}

function buildCommandGuardBlockedReason(
  sandboxSettings: TerminalCommandGuardSetting,
  riskLevel: BirdcoderRiskLevel,
): string | null {
  if (sandboxSettings === 'ReadOnly' && riskLevel !== 'P0') {
    return 'Read-only command guard blocked a command that may change system or workspace state.';
  }

  if (sandboxSettings === 'ReadWrite' && riskLevel === 'P3') {
    return 'Destructive-command guard blocked a high-risk terminal command.';
  }

  return null;
}

function resolveTerminalGovernanceCategory(
  allowed: boolean,
  riskLevel: BirdcoderRiskLevel,
): BirdcoderAuditEventCategory {
  if (!allowed && riskLevel === 'P3') {
    return 'dangerous.command';
  }

  return 'tool.call';
}

function isCommandMatchingAnyPattern(command: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(command));
}

export function normalizeTerminalApprovalPolicy(
  value: string | null | undefined,
): BirdcoderApprovalPolicy {
  return normalizeTerminalApprovalPolicySetting(
    value,
    DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.approvalPolicy,
  );
}

export function normalizeTerminalSandboxPolicy(
  value: string | null | undefined,
): TerminalCommandGuardSetting {
  return normalizeTerminalCommandGuardSetting(
    value,
    DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.sandboxSettings,
  );
}

export function classifyTerminalCommandRisk(command: string): BirdcoderRiskLevel {
  const normalizedCommand = command.trim();
  if (!normalizedCommand) {
    return 'P0';
  }

  if (isCommandMatchingAnyPattern(normalizedCommand, HIGH_RISK_TERMINAL_COMMAND_PATTERNS)) {
    return 'P3';
  }

  if (
    !isCommandMatchingAnyPattern(normalizedCommand, READ_ONLY_COMMAND_ESCAPE_PATTERNS) &&
    isCommandMatchingAnyPattern(normalizedCommand, READ_ONLY_TERMINAL_COMMAND_PATTERNS)
  ) {
    return 'P0';
  }

  return 'P2';
}

export async function evaluateTerminalCommandGovernance(
  command: string,
  settings?: Partial<TerminalGovernanceSettings> | null,
): Promise<TerminalCommandGovernanceDecision> {
  const resolvedSettings = settings
    ? {
      approvalPolicy: normalizeTerminalApprovalPolicySetting(
        settings.approvalPolicy,
        DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.approvalPolicy,
      ),
      sandboxSettings: normalizeTerminalCommandGuardSetting(
        settings.sandboxSettings,
        DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.sandboxSettings,
      ),
    }
    : await loadTerminalGovernanceSettings();
  const riskLevel = classifyTerminalCommandRisk(command);
  const commandGuardBlockedReason = buildCommandGuardBlockedReason(
    resolvedSettings.sandboxSettings,
    riskLevel,
  );
  const blocksForApproval =
    resolvedSettings.approvalPolicy === 'ReleaseOnly' ||
    ((resolvedSettings.approvalPolicy === 'OnRequest' ||
      resolvedSettings.approvalPolicy === 'Restricted') &&
      riskLevel !== 'P0');
  const allowed = !commandGuardBlockedReason && !blocksForApproval;
  const approvalDecision: BirdcoderApprovalDecision = allowed ? 'auto_allowed' : 'blocked';

  return {
    traceId: buildTerminalGovernanceTraceId(sanitizeTerminalCommandForAudit(command)),
    approvalPolicy: resolvedSettings.approvalPolicy,
    sandboxSettings: resolvedSettings.sandboxSettings,
    riskLevel,
    approvalDecision,
    allowed,
    reason: allowed
      ? null
      : commandGuardBlockedReason ??
        buildApprovalPolicyBlockedReason(resolvedSettings.approvalPolicy, riskLevel),
    category: resolveTerminalGovernanceCategory(allowed, riskLevel),
  };
}
export function sanitizeTerminalCommandForAudit(command: string): string {
  return command
    .trim()
    .replace(TERMINAL_AUDIT_SECRET_ARGUMENT_PATTERN, '$1<redacted>')
    .replace(TERMINAL_AUDIT_SECRET_ENV_PATTERN, '$1=<redacted>')
    .replace(TERMINAL_AUDIT_BEARER_PATTERN, 'Bearer <redacted>')
    .replace(TERMINAL_AUDIT_URL_CREDENTIAL_PATTERN, '$1<redacted>@');
}

export function buildTerminalCommandAuditEvent(
  input: TerminalCommandAuditEventInput,
  timestamp = Date.now(),
): BirdcoderAuditEvent {
  const sanitizedCommand = sanitizeTerminalCommandForAudit(input.command);

  return {
    category: input.decision.category,
    traceId: input.decision.traceId,
    engine: input.profileId,
    tool: 'terminal.launch.preflight',
    riskLevel: input.decision.riskLevel,
    approvalDecision: input.decision.approvalDecision,
    inputDigest: buildTerminalGovernanceDigest(`${input.cwd}\n${sanitizedCommand}`),
    outputDigest: buildTerminalGovernanceDigest(
      `${input.decision.allowed}:${input.decision.reason ?? 'allowed'}:${timestamp}`,
    ),
    artifactRefs: [`cwd:${input.cwd}`, `profile:${input.profileId}`],
    operator: `terminal:${input.profileId}`,
  };
}
