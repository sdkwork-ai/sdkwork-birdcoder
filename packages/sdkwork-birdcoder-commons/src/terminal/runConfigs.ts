import { getTerminalProfile, type TerminalProfileId } from './profiles.ts';
import {
  listTerminalCliProfileAvailability,
  resolveTerminalProfileBlockedAction,
  resolveTerminalProfileLaunchPresentation,
  type TerminalCliProfileAvailability,
  type TerminalCommandRequest,
  type TerminalProfileBlockedAction,
  type TerminalProfileLaunchPresentation,
} from './runtime.ts';
export {
  buildRunConfigurationStorageKey,
  ensureStoredRunConfigurations,
  getDefaultRunConfigurations,
  getRunConfigurationRepository,
  listStoredRunConfigurations,
  normalizeRunConfigurations,
  saveStoredRunConfigurations,
  upsertStoredRunConfiguration,
  type RunConfigurationCwdMode,
  type RunConfigurationGroup,
  type RunConfigurationRecord,
} from './runConfigStorage.ts';
import { type RunConfigurationRecord } from './runConfigStorage.ts';

export interface RunConfigurationTerminalRequest extends TerminalCommandRequest {
  path: string;
  command: string;
  profileId: TerminalProfileId;
}

type RunConfigurationDirectoryInput = Pick<RunConfigurationRecord, 'cwdMode' | 'customCwd'> &
  Partial<RunConfigurationRecord>;

interface BuildRunConfigurationTerminalRequestOptions {
  projectDirectory: string;
  workspaceDirectory: string;
  timestamp?: number;
}

export interface ResolveRunConfigurationTerminalLaunchOptions
  extends BuildRunConfigurationTerminalRequestOptions {
  cliAvailabilityByProfileId?: Partial<Record<TerminalProfileId, TerminalCliProfileAvailability>>;
}

export interface RunConfigurationTerminalLaunchResult {
  request: RunConfigurationTerminalRequest | null;
  launchPresentation: TerminalProfileLaunchPresentation;
  blockedAction: TerminalProfileBlockedAction;
}

export function resolveRunConfigurationDirectory(
  config: RunConfigurationDirectoryInput,
  projectDirectory: string,
  workspaceDirectory: string,
): string {
  switch (config.cwdMode) {
    case 'custom':
      return config.customCwd.trim() || projectDirectory || workspaceDirectory;
    case 'workspace':
      return workspaceDirectory || projectDirectory;
    default:
      return projectDirectory || workspaceDirectory;
  }
}

export function buildRunConfigurationTerminalRequest(
  configuration: Pick<RunConfigurationRecord, 'command' | 'cwdMode' | 'customCwd' | 'profileId'>,
  options: BuildRunConfigurationTerminalRequestOptions,
): RunConfigurationTerminalRequest {
  return {
    path: resolveRunConfigurationDirectory(
      configuration,
      options.projectDirectory,
      options.workspaceDirectory,
    ),
    command: configuration.command,
    profileId: getTerminalProfile(configuration.profileId).id,
    timestamp: options.timestamp ?? Date.now(),
  };
}

export async function resolveRunConfigurationTerminalLaunch(
  configuration: Pick<RunConfigurationRecord, 'command' | 'cwdMode' | 'customCwd' | 'profileId'>,
  options: ResolveRunConfigurationTerminalLaunchOptions,
): Promise<RunConfigurationTerminalLaunchResult> {
  const profile = getTerminalProfile(configuration.profileId);
  let availability = options.cliAvailabilityByProfileId?.[profile.id];

  if (profile.kind === 'cli' && !availability) {
    availability = (await listTerminalCliProfileAvailability()).find(
      (entry) => entry.profileId === profile.id,
    );
  }

  const launchPresentation = resolveTerminalProfileLaunchPresentation(profile.id, availability);
  const blockedAction = resolveTerminalProfileBlockedAction(profile.id, availability);

  if (!launchPresentation.canLaunch) {
    return {
      request: null,
      launchPresentation,
      blockedAction,
    };
  }

  return {
    request: buildRunConfigurationTerminalRequest(configuration, options),
    launchPresentation,
    blockedAction,
  };
}
