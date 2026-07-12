import {
  buildTerminalExecutionPlan,
  getTerminalProfile,
  resolveTerminalLaunchProfileOption,
} from './profiles.ts';
import { isTerminalCliProfileId } from './registry.ts';
import {
  buildTerminalCommandAuditEvent,
  buildTerminalProfileBlockedMessage,
  evaluateTerminalCommandGovernance,
  listTerminalCliProfileAvailability,
  sanitizeTerminalCommandForAudit,
  type TerminalCommandRequest,
} from './runtime.ts';
import {
  saveStoredTerminalGovernanceAuditRecord,
  type TerminalGovernanceAuditRecord,
} from './auditStore.ts';
import type {
  DesktopLocalProcessSessionCreateRequest,
  DesktopLocalShellSessionCreateRequest,
} from '@sdkwork/terminal-pc-infrastructure';
import type { DesktopTerminalLaunchPlan } from './contracts/sdkworkTerminalShell.d.ts';

export interface BirdcoderTerminalSessionMetadata {
  projectId?: string | null;
  title?: string | null;
  workspaceId?: string | null;
}

export interface ResolveBirdcoderTerminalLaunchRequestOptions
  extends BirdcoderTerminalSessionMetadata {
  defaultWorkingDirectory?: string | null;
}

export interface BirdcoderTerminalLaunchResolution {
  blockedMessage: string | null;
  plan: DesktopTerminalLaunchPlan | null;
}

export interface BirdcoderTerminalGovernanceRuntime {
  evaluateCommand: typeof evaluateTerminalCommandGovernance;
  saveAuditRecord: (
    record: TerminalGovernanceAuditRecord,
  ) => Promise<unknown>;
  now: () => number;
}

const DEFAULT_TERMINAL_COLS = 120;
const DEFAULT_TERMINAL_ROWS = 32;
const DEFAULT_TERMINAL_GOVERNANCE_RUNTIME: BirdcoderTerminalGovernanceRuntime = {
  evaluateCommand: evaluateTerminalCommandGovernance,
  saveAuditRecord: saveStoredTerminalGovernanceAuditRecord,
  now: Date.now,
};

const TERMINAL_GOVERNANCE_UNAVAILABLE_MESSAGE =
  'The command was not launched because terminal governance could not be evaluated or audited.';

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
    workspaceId: metadata.workspaceId ?? null,
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
    workspaceId: metadata.workspaceId ?? null,
    projectId: metadata.projectId ?? null,
    title: metadata.title ?? null,
    profileId: profileId ?? null,
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

  if (isTerminalCliProfileId(profile.id)) {
    const launchProfile = resolveTerminalLaunchProfileOption(profile.id);

    return {
      kind: 'local-process',
      profile: shellAppProfile,
      title: profile.title,
      targetLabel: workingDirectory,
      localProcessRequest: buildLocalProcessRequest(
        [launchProfile.executable, ...launchProfile.startupArgs],
        workingDirectory,
        {
          ...options,
          title: profile.title,
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
  const profileId = request.profileId ?? 'powershell';
  if (isTerminalCliProfileId(profileId)) {
    const availabilityEntries = await listTerminalCliProfileAvailability();
    const availability = availabilityEntries.find((entry) => entry.profileId === profileId);

    if (availability?.status === 'missing') {
      return {
        blockedMessage:
          buildTerminalProfileBlockedMessage(profileId, availability) ??
          `${profileId} is unavailable.`,
        plan: null,
      };
    }
  }

  const plan = buildBirdcoderTerminalLaunchPlan(request, options);
  const normalizedCommand = request.command?.trim();
  if (normalizedCommand) {
    try {
      const decision = await governanceRuntime.evaluateCommand(normalizedCommand);
      const recordedAt = governanceRuntime.now();
      const profileId = getTerminalProfile(request.profileId ?? 'powershell').id;
      const cwd =
        plan.kind === 'local-process'
          ? plan.localProcessRequest.workingDirectory?.trim() || plan.targetLabel
          : plan.localShellRequest.workingDirectory?.trim() || plan.targetLabel;
      const auditEvent = buildTerminalCommandAuditEvent(
        {
          profileId,
          cwd,
          command: normalizedCommand,
          decision,
        },
        recordedAt,
      );

      await governanceRuntime.saveAuditRecord({
        ...auditEvent,
        recordedAt,
        profileId,
        cwd,
        command: sanitizeTerminalCommandForAudit(normalizedCommand),
        reason: decision.reason,
        approvalPolicy: decision.approvalPolicy,
        sandboxSettings: decision.sandboxSettings,
      });

      if (!decision.allowed) {
        return {
          blockedMessage: decision.reason ?? 'Terminal governance blocked the command.',
          plan: null,
        };
      }
    } catch {
      return {
        blockedMessage: TERMINAL_GOVERNANCE_UNAVAILABLE_MESSAGE,
        plan: null,
      };
    }
  }

  return {
    blockedMessage: null,
    plan,
  };
}
