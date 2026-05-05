import {
  buildTerminalExecutionPlan,
  getTerminalProfile,
  type TerminalExecutionPlan,
  type TerminalProfileId,
} from './profiles.ts';
import {
  TERMINAL_CLI_PROFILE_REGISTRY,
  getTerminalCliProfileDefinition,
  type TerminalCliProfileId,
} from './registry.ts';
import { getStoredJson } from '../storage/localStore.ts';
import { globalEventBus } from '../utils/EventBus.ts';
import type {
  BirdcoderApprovalDecision,
  BirdcoderApprovalPolicy,
  BirdcoderAuditEvent,
  BirdcoderAuditEventCategory,
  BirdcoderRiskLevel,
} from '@sdkwork/birdcoder-types';

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

export type TerminalCommandSurface = 'workspace' | 'embedded';

export interface TerminalCommandRequest {
  surface: TerminalCommandSurface;
  path?: string;
  command?: string;
  profileId?: TerminalProfileId;
  timestamp: number;
}

interface TerminalEventEmitterLike {
  emit(event: string, ...args: any[]): void;
}

export type TerminalCliProfileAvailabilityStatus = 'available' | 'missing' | 'unknown';

export interface TerminalCliProfileAvailability {
  profileId: TerminalCliProfileId;
  executable: string;
  aliases: string[];
  installHint: string;
  status: TerminalCliProfileAvailabilityStatus;
  resolvedExecutable: string | null;
  checkedAt: number;
  detectedVia: 'tauri' | 'browser';
}

export interface TerminalProfileLaunchState {
  canLaunch: boolean;
  reason: string | null;
}

export interface TerminalProfileLaunchPresentation extends TerminalProfileLaunchState {
  statusLabel: 'Ready' | 'Install' | 'Unknown' | null;
  detailLabel: string;
}

export interface TerminalProfileBlockedAction {
  actionId: 'open-settings' | null;
  actionLabel: 'Open Settings' | null;
}

export interface TerminalProfileBlockedMessageOptions {
  availability?: TerminalCliProfileAvailability | null;
  launchState?: TerminalProfileLaunchState | TerminalProfileLaunchPresentation | null;
  blockedAction?: TerminalProfileBlockedAction | null;
}

export interface TerminalGovernanceSettings {
  approvalPolicy: BirdcoderApprovalPolicy;
  sandboxSettings: string;
}

export interface TerminalCommandGovernanceDecision {
  traceId: string;
  approvalPolicy: BirdcoderApprovalPolicy;
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

interface TauriTerminalCliProfileAvailabilityResponse {
  profileId: string;
  status: string;
  resolvedExecutable?: string | null;
}

const DEFAULT_TERMINAL_GOVERNANCE_SETTINGS: TerminalGovernanceSettings = {
  approvalPolicy: 'OnRequest',
  sandboxSettings: 'Read only',
};

const TERMINAL_CLI_PROFILE_AVAILABILITY_CONCURRENCY = 2;

const TERMINAL_APPROVAL_POLICY_ALIASES: Readonly<Record<string, BirdcoderApprovalPolicy>> = {
  autoallow: 'AutoAllow',
  'auto allow': 'AutoAllow',
  onrequest: 'OnRequest',
  'on request': 'OnRequest',
  restricted: 'Restricted',
  releaseonly: 'ReleaseOnly',
  'release only': 'ReleaseOnly',
};

const READ_ONLY_TERMINAL_COMMAND_PATTERNS = [
  /^\s*(pwd|ls|dir|echo|which|where|whoami|rg|find|cat|type|get-childitem|get-location)\b/i,
  /^\s*git\s+(status|diff)\b/i,
] as const;

const HIGH_RISK_TERMINAL_COMMAND_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bdel\b.*\/f.*\/s.*\/q/i,
  /\bformat\b/i,
  /\bmkfs\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-fd\b/i,
  /\bremove-item\b.*-recurse.*-force/i,
] as const;

function buildTerminalGovernanceDigest(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildTerminalGovernanceTraceId(command: string, timestamp = Date.now()): string {
  return `terminal-governance:${timestamp.toString(36)}:${buildTerminalGovernanceDigest(command)}`;
}

async function loadTerminalGovernanceSettings(): Promise<TerminalGovernanceSettings> {
  const storedSettings = await getStoredJson<Record<string, unknown>>('settings', 'app', {});
  return {
    approvalPolicy: normalizeTerminalApprovalPolicy(
      typeof storedSettings.approvalPolicy === 'string'
        ? storedSettings.approvalPolicy
        : DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.approvalPolicy,
    ),
    sandboxSettings:
      typeof storedSettings.sandboxSettings === 'string'
        ? storedSettings.sandboxSettings
        : DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.sandboxSettings,
  };
}

function buildBlockedGovernanceReason(
  approvalPolicy: BirdcoderApprovalPolicy,
  riskLevel: BirdcoderRiskLevel,
): string {
  if (approvalPolicy === 'AutoAllow') {
    return 'AutoAllow policy only permits read-only terminal commands.';
  }

  if (approvalPolicy === 'ReleaseOnly') {
    return 'ReleaseOnly policy blocked interactive terminal execution outside the release lane.';
  }

  if (riskLevel === 'P3') {
    return 'Restricted policy blocked high-risk terminal command.';
  }

  return 'Restricted policy blocked side-effecting terminal command.';
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
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.approvalPolicy;
  }

  return (
    TERMINAL_APPROVAL_POLICY_ALIASES[normalizedValue] ??
    DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.approvalPolicy
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

  if (isCommandMatchingAnyPattern(normalizedCommand, READ_ONLY_TERMINAL_COMMAND_PATTERNS)) {
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
      approvalPolicy: normalizeTerminalApprovalPolicy(settings.approvalPolicy),
      sandboxSettings:
        settings.sandboxSettings?.trim() || DEFAULT_TERMINAL_GOVERNANCE_SETTINGS.sandboxSettings,
    }
    : await loadTerminalGovernanceSettings();
  const riskLevel = classifyTerminalCommandRisk(command);
  const blocksForAutoAllow = resolvedSettings.approvalPolicy === 'AutoAllow' && riskLevel !== 'P0';
  const blocksForRestricted =
    (resolvedSettings.approvalPolicy === 'Restricted' ||
      resolvedSettings.approvalPolicy === 'ReleaseOnly') &&
    (riskLevel === 'P2' || riskLevel === 'P3');
  const allowed = !blocksForAutoAllow && !blocksForRestricted;
  const approvalDecision: BirdcoderApprovalDecision = allowed
    ? riskLevel === 'P0'
      ? 'auto_allowed'
      : 'approved'
    : 'blocked';

  return {
    traceId: buildTerminalGovernanceTraceId(command),
    approvalPolicy: resolvedSettings.approvalPolicy,
    riskLevel,
    approvalDecision,
    allowed,
    reason: allowed
      ? null
      : buildBlockedGovernanceReason(resolvedSettings.approvalPolicy, riskLevel),
    category: resolveTerminalGovernanceCategory(allowed, riskLevel),
  };
}

export function buildTerminalCommandAuditEvent(
  input: TerminalCommandAuditEventInput,
  timestamp = Date.now(),
): BirdcoderAuditEvent {
  return {
    category: input.decision.category,
    traceId: input.decision.traceId,
    engine: input.profileId,
    tool: 'terminal.exec',
    riskLevel: input.decision.riskLevel,
    approvalDecision: input.decision.approvalDecision,
    inputDigest: buildTerminalGovernanceDigest(`${input.cwd}\n${input.command}`),
    outputDigest: buildTerminalGovernanceDigest(
      `${input.decision.allowed}:${input.decision.reason ?? 'allowed'}:${timestamp}`,
    ),
    artifactRefs: [`cwd:${input.cwd}`, `profile:${input.profileId}`],
    operator: `terminal:${input.profileId}`,
  };
}

async function resolveTauriInvoke() {
  if (typeof window === 'undefined' || !window.__TAURI__) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

async function mapWithConcurrencyLimit<TItem, TResult>(
  items: readonly TItem[],
  limit: number,
  mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const resolvedLimit = Math.max(1, Math.floor(limit));
  const results: TResult[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(resolvedLimit, items.length) },
      () => worker(),
    ),
  );

  return results;
}

function normalizeTerminalCliProfileAvailability(
  profileId: TerminalCliProfileId | string,
  value: Partial<TerminalCliProfileAvailability>,
): TerminalCliProfileAvailability {
  const definition = getTerminalCliProfileDefinition(profileId);

  return {
    profileId: definition.profileId,
    executable: value.executable?.trim() || definition.executable,
    aliases: Array.isArray(value.aliases) ? [...value.aliases] : [...definition.aliases],
    installHint: value.installHint?.trim() || definition.installHint,
    status:
      value.status === 'available' || value.status === 'missing' || value.status === 'unknown'
        ? value.status
        : 'unknown',
    resolvedExecutable: value.resolvedExecutable?.trim() || null,
    checkedAt: typeof value.checkedAt === 'number' ? value.checkedAt : Date.now(),
    detectedVia: value.detectedVia === 'tauri' ? 'tauri' : 'browser',
  };
}

export async function listTerminalCliProfileAvailability(): Promise<
  TerminalCliProfileAvailability[]
> {
  const invoke = await resolveTauriInvoke();

  if (!invoke) {
    return TERMINAL_CLI_PROFILE_REGISTRY.map((profile) =>
      normalizeTerminalCliProfileAvailability(profile.profileId, {
        executable: profile.executable,
        aliases: [...profile.aliases],
        installHint: profile.installHint,
        status: 'unknown',
        resolvedExecutable: null,
        detectedVia: 'browser',
      }),
    );
  }

  const results = await mapWithConcurrencyLimit(
    TERMINAL_CLI_PROFILE_REGISTRY,
    TERMINAL_CLI_PROFILE_AVAILABILITY_CONCURRENCY,
    async (profile) => {
      try {
        const response = await invoke<TauriTerminalCliProfileAvailabilityResponse>(
          'terminal_cli_profile_detect',
          {
            request: {
              profileId: profile.profileId,
              executable: profile.executable,
              aliases: [...profile.aliases],
            },
          },
        );

        return normalizeTerminalCliProfileAvailability(profile.profileId, {
          executable: profile.executable,
          aliases: [...profile.aliases],
          installHint: profile.installHint,
          status:
            response.status === 'available' || response.status === 'missing'
              ? response.status
              : 'unknown',
          resolvedExecutable: response.resolvedExecutable ?? null,
          detectedVia: 'tauri',
        });
      } catch {
        return normalizeTerminalCliProfileAvailability(profile.profileId, {
          executable: profile.executable,
          aliases: [...profile.aliases],
          installHint: profile.installHint,
          status: 'unknown',
          resolvedExecutable: null,
          detectedVia: 'tauri',
        });
      }
    },
  );

  return results.sort(
    (left, right) =>
      TERMINAL_CLI_PROFILE_REGISTRY.findIndex((profile) => profile.profileId === left.profileId) -
      TERMINAL_CLI_PROFILE_REGISTRY.findIndex((profile) => profile.profileId === right.profileId),
  );
}

export function resolveTerminalProfileLaunchState(
  profileId: TerminalProfileId | string,
  availability?: TerminalCliProfileAvailability | null,
): TerminalProfileLaunchState {
  const profile = getTerminalProfile(profileId);

  if (profile.kind !== 'cli') {
    return {
      canLaunch: true,
      reason: null,
    };
  }

  if (availability?.status === 'missing') {
    return {
      canLaunch: false,
      reason: availability.installHint || getTerminalCliProfileDefinition(profile.id).installHint,
    };
  }

  return {
    canLaunch: true,
    reason: null,
  };
}

export function resolveTerminalProfileLaunchPresentation(
  profileId: TerminalProfileId | string,
  availability?: TerminalCliProfileAvailability | null,
): TerminalProfileLaunchPresentation {
  const profile = getTerminalProfile(profileId);
  const launchState = resolveTerminalProfileLaunchState(profile.id, availability);

  if (profile.kind !== 'cli') {
    return {
      ...launchState,
      statusLabel: null,
      detailLabel: buildTerminalExecutionPlan(profile.id, '', profile.defaultCwd).executable,
    };
  }

  if (availability?.status === 'available') {
    return {
      ...launchState,
      statusLabel: 'Ready',
      detailLabel: `${availability.resolvedExecutable ?? availability.executable} on PATH`,
    };
  }

  if (availability?.status === 'missing') {
    return {
      ...launchState,
      statusLabel: 'Install',
      detailLabel: launchState.reason ?? getTerminalCliProfileDefinition(profile.id).installHint,
    };
  }

  return {
    ...launchState,
    statusLabel: 'Unknown',
    detailLabel: `${getTerminalCliProfileDefinition(profile.id).executable} detection requires desktop host access`,
  };
}

export function resolveTerminalProfileBlockedAction(
  profileId: TerminalProfileId | string,
  availability?: TerminalCliProfileAvailability | null,
): TerminalProfileBlockedAction {
  const launchState = resolveTerminalProfileLaunchState(profileId, availability);

  if (!launchState.canLaunch) {
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

export function buildTerminalProfileBlockedMessage(
  profileId: TerminalProfileId | string,
  availabilityOrOptions?: TerminalCliProfileAvailability | TerminalProfileBlockedMessageOptions | null,
): string | null {
  const profile = getTerminalProfile(profileId);
  let options: TerminalProfileBlockedMessageOptions;

  if (availabilityOrOptions && 'status' in availabilityOrOptions) {
    options = { availability: availabilityOrOptions };
  } else {
    options = (availabilityOrOptions ?? {}) as TerminalProfileBlockedMessageOptions;
  }

  const launchState =
    options.launchState ?? resolveTerminalProfileLaunchState(profile.id, options.availability);
  const blockedAction =
    options.blockedAction ?? resolveTerminalProfileBlockedAction(profile.id, options.availability);

  if (launchState.canLaunch) {
    return null;
  }

  return `${profile.title} is unavailable. ${launchState.reason ?? 'Install the CLI to continue.'} ${blockedAction.actionLabel ?? 'Open Settings'} to configure the environment.`;
}

export function emitOpenTerminalVisibility(
  eventBus: TerminalEventEmitterLike = globalEventBus,
): void {
  eventBus.emit('openTerminal');
}

function resolveBrowserTerminalProfileId(): TerminalProfileId {
  if (typeof navigator === 'undefined') {
    return 'powershell';
  }

  const browserNavigator = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };
  const platform = browserNavigator.userAgentData?.platform ?? browserNavigator.platform ?? '';
  return platform.trim().toLowerCase().includes('win') ? 'powershell' : 'bash';
}

export function buildDefaultTerminalCommandRequest(
  overrides: Partial<Omit<TerminalCommandRequest, 'timestamp'>> = {},
): TerminalCommandRequest {
  return {
    surface: overrides.surface ?? 'workspace',
    path: overrides.path?.trim() || undefined,
    command: overrides.command?.trim() || undefined,
    profileId: overrides.profileId ?? resolveBrowserTerminalProfileId(),
    timestamp: Date.now(),
  };
}

export function emitOpenTerminalRequest(
  request: TerminalCommandRequest,
  eventBus: TerminalEventEmitterLike = globalEventBus,
): void {
  eventBus.emit('terminalRequest', request);
}

export function areTerminalCommandRequestsEqual(
  left: TerminalCommandRequest | undefined,
  right: TerminalCommandRequest | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    left.surface === right.surface &&
    left.path === right.path &&
    left.command === right.command &&
    left.profileId === right.profileId &&
    left.timestamp === right.timestamp
  );
}
