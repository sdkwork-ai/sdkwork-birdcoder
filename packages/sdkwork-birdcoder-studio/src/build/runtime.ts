import {
  resolveRunConfigurationTerminalLaunch,
  type ResolveRunConfigurationTerminalLaunchOptions,
  type RunConfigurationRecord,
  type RunConfigurationTerminalLaunchResult,
  type RunConfigurationTerminalRequest,
} from '../../../sdkwork-birdcoder-commons/src/terminal/runConfigs.ts';

import type { StudioBuildProfile } from './profiles.ts';

export const STUDIO_BUILD_EXECUTION_ADAPTER_ID = 'studio.build.execution';

type StudioBuildRunConfigurationInput = Pick<
  RunConfigurationRecord,
  'id' | 'command' | 'cwdMode' | 'customCwd' | 'profileId'
> &
  Partial<RunConfigurationRecord>;

export interface StudioBuildExecutionEvidence {
  adapterId: typeof STUDIO_BUILD_EXECUTION_ADAPTER_ID;
  evidenceKey: string;
  buildProfileId: StudioBuildProfile['profileId'];
  targetId: StudioBuildProfile['targetId'];
  outputKind: StudioBuildProfile['outputKind'];
  command: string;
  cwd: string;
  profileId: RunConfigurationTerminalRequest['profileId'];
  projectId: string | null;
  runConfigurationId: string | null;
  launchedAt: number;
}

export interface StudioBuildExecutionRequest {
  adapterId: typeof STUDIO_BUILD_EXECUTION_ADAPTER_ID;
  runConfigurationId: string | null;
  buildProfile: StudioBuildProfile;
  terminalRequest: RunConfigurationTerminalRequest;
  evidence: StudioBuildExecutionEvidence;
}

export interface ResolveStudioBuildExecutionLaunchOptions
  extends ResolveRunConfigurationTerminalLaunchOptions {
  projectId?: string | null;
  runConfigurationId?: string | null;
}

export interface StudioBuildExecutionLaunchResult {
  request: StudioBuildExecutionRequest | null;
  launchPresentation: RunConfigurationTerminalLaunchResult['launchPresentation'];
  blockedAction: RunConfigurationTerminalLaunchResult['blockedAction'];
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function buildStudioBuildExecutionEvidence(
  buildProfile: StudioBuildProfile,
  terminalRequest: RunConfigurationTerminalRequest,
  options: Pick<ResolveStudioBuildExecutionLaunchOptions, 'projectId' | 'runConfigurationId'> = {},
): StudioBuildExecutionEvidence {
  return {
    adapterId: STUDIO_BUILD_EXECUTION_ADAPTER_ID,
    evidenceKey: `${buildProfile.evidenceKey}.launch`,
    buildProfileId: buildProfile.profileId,
    targetId: buildProfile.targetId,
    outputKind: buildProfile.outputKind,
    command: terminalRequest.command,
    cwd: terminalRequest.path,
    profileId: terminalRequest.profileId,
    projectId: normalizeOptionalId(options.projectId),
    runConfigurationId: normalizeOptionalId(options.runConfigurationId),
    launchedAt: terminalRequest.timestamp,
  };
}

export async function resolveStudioBuildExecutionLaunch(
  buildProfile: StudioBuildProfile,
  configuration: StudioBuildRunConfigurationInput,
  options: ResolveStudioBuildExecutionLaunchOptions,
): Promise<StudioBuildExecutionLaunchResult> {
  const launch = await resolveRunConfigurationTerminalLaunch(configuration, options);

  if (!launch.request) {
    return {
      request: null,
      launchPresentation: launch.launchPresentation,
      blockedAction: launch.blockedAction,
    };
  }

  const runConfigurationId =
    normalizeOptionalId(options.runConfigurationId) ?? normalizeOptionalId(configuration.id);

  return {
    request: {
      adapterId: STUDIO_BUILD_EXECUTION_ADAPTER_ID,
      runConfigurationId,
      buildProfile,
      terminalRequest: launch.request,
      evidence: buildStudioBuildExecutionEvidence(buildProfile, launch.request, {
        projectId: options.projectId,
        runConfigurationId,
      }),
    },
    launchPresentation: launch.launchPresentation,
    blockedAction: launch.blockedAction,
  };
}
