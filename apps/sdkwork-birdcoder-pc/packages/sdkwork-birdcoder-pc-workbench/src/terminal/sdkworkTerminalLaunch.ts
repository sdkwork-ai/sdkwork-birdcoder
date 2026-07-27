import {
  buildTerminalExecutionPlan,
  getTerminalProfile,
  type TerminalProfileId,
} from './profiles.ts';
import {
  buildTerminalCommandAuditEvent,
  evaluateTerminalCommandGovernance,
  sanitizeTerminalCommandForAudit,
  type TerminalCommandRequest,
} from './runtime.ts';
import {
  recordTerminalGovernanceDiagnostic,
  type TerminalGovernanceDiagnosticRecord,
} from './governanceDiagnostics.ts';
import type {
  DesktopLocalProcessSessionCreateRequest,
  DesktopLocalShellSessionCreateRequest,
} from '@sdkwork/terminal-pc-infrastructure';
import type {
  DesktopTerminalLaunchPlan,
  WebRuntimeSessionIntent,
} from './contracts/sdkworkTerminalShell.d.ts';

export interface BirdcoderTerminalSessionMetadata {
  projectId?: string | null;
  title?: string | null;
}

export interface ResolveBirdcoderTerminalLaunchRequestOptions
  extends BirdcoderTerminalSessionMetadata {
  defaultWorkingDirectory?: string | null;
}

export interface BirdcoderTerminalLaunchResolution {
  blockedMessage: string | null;
  plan: DesktopTerminalLaunchPlan | null;
}

export interface ResolveBirdcoderWebTerminalLaunchRequestOptions {
  projectId: string;
  requestId: string;
  runtimeLocationId: string;
}

export interface BirdcoderWebTerminalLaunchResolution {
  blockedMessage: string | null;
  intent: WebRuntimeSessionIntent | null;
}

export interface BirdcoderTerminalGovernanceRuntime {
  evaluateCommand: typeof evaluateTerminalCommandGovernance;
  recordDiagnostic: (
    record: TerminalGovernanceDiagnosticRecord,
  ) => Promise<unknown>;
  now: () => number;
}

const DEFAULT_TERMINAL_COLS = 120;
const DEFAULT_TERMINAL_ROWS = 32;
const DEFAULT_TERMINAL_GOVERNANCE_RUNTIME: BirdcoderTerminalGovernanceRuntime = {
  evaluateCommand: evaluateTerminalCommandGovernance,
  recordDiagnostic: recordTerminalGovernanceDiagnostic,
  now: Date.now,
};

const TERMINAL_GOVERNANCE_UNAVAILABLE_MESSAGE =
  'The command was not launched because terminal governance could not be evaluated or recorded.';
const REMOTE_TERMINAL_TARGET_UNAVAILABLE_MESSAGE =
  'The command was not launched because the remote terminal target is unavailable.';

function mapTerminalProfileIdToShellAppProfile(
  profileId: string,
): DesktopTerminalLaunchPlan['profile'] {
  switch (profileId.trim().toLowerCase()) {
    case 'powershell':
      return 'powershell';
    case 'bash':
    case 'ubuntu':
      return 'bash';
    default:
      return 'shell';
  }
}

function resolveWorkingDirectory(
  request: TerminalCommandRequest,
  defaultWorkingDirectory: string,
) {
  const requestedPath = request.path?.trim();
  if (requestedPath) {
    return requestedPath;
  }

  const fallbackPath = defaultWorkingDirectory.trim();
  if (fallbackPath) {
    return fallbackPath;
  }

  return getTerminalProfile(request.profileId ?? 'powershell').defaultCwd;
}

function buildLocalProcessRequest(
  command: string[],
  workingDirectory: string,
  metadata: BirdcoderTerminalSessionMetadata,
  profileId?: string | null,
): DesktopLocalProcessSessionCreateRequest {
  return {
    command,
    workingDirectory,
    cols: DEFAULT_TERMINAL_COLS,
    rows: DEFAULT_TERMINAL_ROWS,
    projectId: metadata.projectId ?? null,
    title: metadata.title ?? null,
    profileId: profileId ?? null,
  };
}

function buildLocalShellRequest(
  profile: DesktopTerminalLaunchPlan['profile'],
  workingDirectory: string,
  metadata: BirdcoderTerminalSessionMetadata,
  profileId?: string | null,
): DesktopLocalShellSessionCreateRequest {
  return {
    profile,
    workingDirectory,
    cols: DEFAULT_TERMINAL_COLS,
    rows: DEFAULT_TERMINAL_ROWS,
    projectId: metadata.projectId ?? null,
    title: metadata.title ?? null,
    profileId: profileId ?? null,
  };
}

async function evaluateAndRecordTerminalCommand(
  command: string,
  profileId: TerminalProfileId,
  auditScope: string,
  governanceRuntime: BirdcoderTerminalGovernanceRuntime,
): Promise<string | null> {
  try {
    const decision = await governanceRuntime.evaluateCommand(command);
    const recordedAt = governanceRuntime.now();
    const auditEvent = buildTerminalCommandAuditEvent(
      {
        profileId,
        cwd: auditScope,
        command,
        decision,
      },
      recordedAt,
    );

    await governanceRuntime.recordDiagnostic({
      ...auditEvent,
      recordedAt,
      profileId,
      cwd: auditScope,
      command: sanitizeTerminalCommandForAudit(command),
      reason: decision.reason,
      approvalPolicy: decision.approvalPolicy,
      sandboxSettings: decision.sandboxSettings,
    });

    return decision.allowed
      ? null
      : decision.reason ?? 'Terminal governance blocked the command.';
  } catch {
    return TERMINAL_GOVERNANCE_UNAVAILABLE_MESSAGE;
  }
}

export async function resolveBirdcoderWebTerminalLaunchRequest(
  request: TerminalCommandRequest,
  options: ResolveBirdcoderWebTerminalLaunchRequestOptions,
  governanceRuntime: BirdcoderTerminalGovernanceRuntime =
    DEFAULT_TERMINAL_GOVERNANCE_RUNTIME,
): Promise<BirdcoderWebTerminalLaunchResolution> {
  const projectId = options.projectId.trim();
  const runtimeLocationId = options.runtimeLocationId.trim();
  const requestId = options.requestId.trim();
  if (!projectId || !runtimeLocationId || !requestId) {
    return {
      blockedMessage: REMOTE_TERMINAL_TARGET_UNAVAILABLE_MESSAGE,
      intent: null,
    };
  }

  const normalizedCommand = request.command?.trim();
  const profileId = getTerminalProfile(request.profileId ?? 'bash').id;
  if (normalizedCommand) {
    const blockedMessage = await evaluateAndRecordTerminalCommand(
      normalizedCommand,
      profileId,
      `remote-runtime:${runtimeLocationId}`,
      governanceRuntime,
    );
    if (blockedMessage) {
      return {
        blockedMessage,
        intent: null,
      };
    }
  }

  const title = normalizedCommand?.split(/\s+/u, 1)[0] || 'bash';
  return {
    blockedMessage: null,
    intent: {
      requestId,
      profile: 'bash',
      title,
      targetLabel: runtimeLocationId,
      request: {
        projectId,
        runtimeLocationId,
        command: normalizedCommand
          ? ['/bin/bash', '-lc', normalizedCommand]
          : ['/bin/bash', '-l'],
        modeTags: ['cli-native'],
        tags: ['birdcoder', 'profile:bash'],
      },
    },
  };
}

export function buildBirdcoderTerminalLaunchPlan(
  request: TerminalCommandRequest,
  options: ResolveBirdcoderTerminalLaunchRequestOptions = {},
): DesktopTerminalLaunchPlan {
  const profile = getTerminalProfile(request.profileId ?? 'powershell');
  const workingDirectory = resolveWorkingDirectory(
    request,
    options.defaultWorkingDirectory?.trim() || '',
  );
  const shellAppProfile = mapTerminalProfileIdToShellAppProfile(profile.id);
  const normalizedCommand = request.command?.trim();

  if (normalizedCommand) {
    const executionPlan = buildTerminalExecutionPlan(profile.id, normalizedCommand, workingDirectory);
    const title = normalizedCommand.split(/\s+/u, 1)[0] || profile.title;

    return {
      kind: 'local-process',
      profile: shellAppProfile,
      title,
      targetLabel: executionPlan.cwd,
      localProcessRequest: buildLocalProcessRequest(
        [executionPlan.executable, ...executionPlan.args],
        executionPlan.cwd,
        {
          ...options,
          title,
        },
        profile.id,
      ),
    };
  }

  return {
    kind: 'local-shell',
    profile: shellAppProfile,
    title: profile.title,
    targetLabel: workingDirectory,
    localShellRequest: buildLocalShellRequest(
      shellAppProfile,
      workingDirectory,
      {
        ...options,
        title: profile.title,
      },
      profile.id,
    ),
  };
}

export async function resolveBirdcoderTerminalLaunchRequest(
  request: TerminalCommandRequest,
  options: ResolveBirdcoderTerminalLaunchRequestOptions = {},
  governanceRuntime: BirdcoderTerminalGovernanceRuntime =
    DEFAULT_TERMINAL_GOVERNANCE_RUNTIME,
): Promise<BirdcoderTerminalLaunchResolution> {
  const plan = buildBirdcoderTerminalLaunchPlan(request, options);
  const normalizedCommand = request.command?.trim();
  if (normalizedCommand) {
    const profileId = getTerminalProfile(request.profileId ?? 'powershell').id;
    const cwd =
      plan.kind === 'local-process'
        ? plan.localProcessRequest.workingDirectory?.trim() || plan.targetLabel
        : plan.localShellRequest.workingDirectory?.trim() || plan.targetLabel;
    const blockedMessage = await evaluateAndRecordTerminalCommand(
      normalizedCommand,
      profileId,
      cwd,
      governanceRuntime,
    );
    if (blockedMessage) {
      return {
        blockedMessage,
        plan: null,
      };
    }
  }

  return {
    blockedMessage: null,
    plan,
  };
}
