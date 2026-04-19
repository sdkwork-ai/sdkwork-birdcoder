import {
  buildTerminalExecutionPlan,
  getTerminalProfile,
  resolveTerminalLaunchProfileOption,
} from '@sdkwork/birdcoder-commons/terminal/profiles';
import { isTerminalCliProfileId } from '@sdkwork/birdcoder-commons/terminal/registry';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-commons/terminal/runtime';
import type {
  DesktopLocalProcessSessionCreateRequest,
  DesktopLocalShellSessionCreateRequest,
} from '@sdkwork/terminal-infrastructure';

export type TerminalShellAppProfile = 'powershell' | 'bash' | 'shell';

export interface BirdcoderTerminalSessionMetadata {
  projectId?: string | null;
  title?: string | null;
  workspaceId?: string | null;
}

export interface BirdcoderDesktopLocalShellSessionCreateRequest
  extends DesktopLocalShellSessionCreateRequest,
    BirdcoderTerminalSessionMetadata {
  profileId?: string | null;
}

export interface BirdcoderDesktopLocalProcessSessionCreateRequest
  extends DesktopLocalProcessSessionCreateRequest,
    BirdcoderTerminalSessionMetadata {
  profileId?: string | null;
}

export interface TerminalRequestLaunchPlan {
  kind: 'local-shell' | 'local-process';
  shellAppProfile: TerminalShellAppProfile;
  title: string;
  targetLabel: string;
  workingDirectory: string;
  localShellRequest?: BirdcoderDesktopLocalShellSessionCreateRequest;
  localProcessRequest?: BirdcoderDesktopLocalProcessSessionCreateRequest;
}

const DEFAULT_TERMINAL_COLS = 120;
const DEFAULT_TERMINAL_ROWS = 32;

export function mapTerminalProfileIdToShellAppProfile(profileId: string): TerminalShellAppProfile {
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

export function buildTerminalRequestLaunchPlan(
  request: TerminalCommandRequest,
  defaultWorkingDirectory: string,
  metadata: BirdcoderTerminalSessionMetadata = {},
): TerminalRequestLaunchPlan {
  const profile = getTerminalProfile(request.profileId ?? 'powershell');
  const workingDirectory = resolveWorkingDirectory(request, defaultWorkingDirectory);
  const shellAppProfile = mapTerminalProfileIdToShellAppProfile(profile.id);
  const normalizedCommand = request.command?.trim();

  if (normalizedCommand) {
    const executionPlan = buildTerminalExecutionPlan(profile.id, normalizedCommand, workingDirectory);
    const title = normalizedCommand.split(/\s+/u, 1)[0] || profile.title;

    return {
      kind: 'local-process',
      shellAppProfile,
      title,
      targetLabel: executionPlan.cwd,
      workingDirectory: executionPlan.cwd,
      localProcessRequest: buildLocalProcessRequest(
        [executionPlan.executable, ...executionPlan.args],
        executionPlan.cwd,
        {
          ...metadata,
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
      shellAppProfile,
      title: profile.title,
      targetLabel: workingDirectory,
      workingDirectory,
      localProcessRequest: buildLocalProcessRequest(
        [launchProfile.executable, ...launchProfile.startupArgs],
        workingDirectory,
        {
          ...metadata,
          title: profile.title,
        },
        profile.id,
      ),
    };
  }

  return {
    kind: 'local-shell',
    shellAppProfile,
    title: profile.title,
    targetLabel: workingDirectory,
    workingDirectory,
    localShellRequest: {
      profile: shellAppProfile,
      workingDirectory,
      cols: DEFAULT_TERMINAL_COLS,
      rows: DEFAULT_TERMINAL_ROWS,
      workspaceId: metadata.workspaceId ?? null,
      projectId: metadata.projectId ?? null,
      title: profile.title,
      profileId: profile.id,
    },
  };
}
