import {
  buildTerminalExecutionPlan,
  getTerminalProfile,
  resolveTerminalLaunchProfileOption,
} from './profiles.ts';
import { isTerminalCliProfileId } from './registry.ts';
import {
  buildTerminalProfileBlockedMessage,
  listTerminalCliProfileAvailability,
  type TerminalCommandRequest,
} from './runtime.ts';
import type { DesktopTerminalLaunchPlan } from '@sdkwork/terminal-shell';
import type {
  DesktopLocalProcessSessionCreateRequest,
  DesktopLocalShellSessionCreateRequest,
} from '@sdkwork/terminal-infrastructure';

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

type BirdcoderDesktopLocalShellSessionCreateRequest = DesktopLocalShellSessionCreateRequest &
  BirdcoderTerminalSessionMetadata & {
    profileId?: string | null;
  };

type BirdcoderDesktopLocalProcessSessionCreateRequest = DesktopLocalProcessSessionCreateRequest &
  BirdcoderTerminalSessionMetadata & {
    profileId?: string | null;
  };

const DEFAULT_TERMINAL_COLS = 120;
const DEFAULT_TERMINAL_ROWS = 32;

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
): BirdcoderDesktopLocalProcessSessionCreateRequest {
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
): BirdcoderDesktopLocalShellSessionCreateRequest {
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
      ) as DesktopTerminalLaunchPlan['localProcessRequest'],
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
      ) as DesktopTerminalLaunchPlan['localProcessRequest'],
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
    ) as DesktopTerminalLaunchPlan['localShellRequest'],
  };
}

export async function resolveBirdcoderTerminalLaunchRequest(
  request: TerminalCommandRequest,
  options: ResolveBirdcoderTerminalLaunchRequestOptions = {},
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

  return {
    blockedMessage: null,
    plan: buildBirdcoderTerminalLaunchPlan(request, options),
  };
}
