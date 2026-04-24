import {
  resolveRunConfigurationTerminalLaunch,
  type ResolveRunConfigurationTerminalLaunchOptions,
  type RunConfigurationRecord,
  type RunConfigurationTerminalLaunchResult,
  type RunConfigurationTerminalRequest,
} from '@sdkwork/birdcoder-commons';
import type { HostStudioSimulatorSession } from '../../../sdkwork-birdcoder-host-studio/src/index.ts';

export const STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID = 'studio.simulator.execution';

type StudioSimulatorRunConfigurationInput = Pick<
  RunConfigurationRecord,
  'id' | 'command' | 'cwdMode' | 'customCwd' | 'profileId'
> &
  Partial<RunConfigurationRecord>;

export interface StudioSimulatorExecutionEvidence {
  adapterId: typeof STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID;
  evidenceKey: string;
  sessionEvidenceKey: string;
  host: HostStudioSimulatorSession['host'];
  channel: HostStudioSimulatorSession['target']['channel'];
  runtime: HostStudioSimulatorSession['target']['runtime'];
  orientation: HostStudioSimulatorSession['target']['orientation'];
  command: string;
  cwd: string;
  profileId: RunConfigurationTerminalRequest['profileId'];
  projectId: string | null;
  runConfigurationId: string | null;
  launchedAt: number;
}

export interface StudioSimulatorExecutionRequest {
  adapterId: typeof STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID;
  runConfigurationId: string | null;
  session: HostStudioSimulatorSession;
  terminalRequest: RunConfigurationTerminalRequest;
  evidence: StudioSimulatorExecutionEvidence;
}

export interface ResolveStudioSimulatorExecutionLaunchOptions
  extends ResolveRunConfigurationTerminalLaunchOptions {
  projectId?: string | null;
  runConfigurationId?: string | null;
}

export interface StudioSimulatorExecutionLaunchResult {
  request: StudioSimulatorExecutionRequest | null;
  launchPresentation: RunConfigurationTerminalLaunchResult['launchPresentation'];
  blockedAction: RunConfigurationTerminalLaunchResult['blockedAction'];
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function buildStudioSimulatorExecutionEvidence(
  session: HostStudioSimulatorSession,
  terminalRequest: RunConfigurationTerminalRequest,
  options: Pick<ResolveStudioSimulatorExecutionLaunchOptions, 'projectId' | 'runConfigurationId'> = {},
): StudioSimulatorExecutionEvidence {
  return {
    adapterId: STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID,
    evidenceKey: `${session.evidenceKey}.launch`,
    sessionEvidenceKey: session.evidenceKey,
    host: session.host,
    channel: session.target.channel,
    runtime: session.target.runtime,
    orientation: session.target.orientation,
    command: terminalRequest.command,
    cwd: terminalRequest.path,
    profileId: terminalRequest.profileId,
    projectId: normalizeOptionalId(options.projectId),
    runConfigurationId: normalizeOptionalId(options.runConfigurationId),
    launchedAt: terminalRequest.timestamp,
  };
}

export async function resolveStudioSimulatorExecutionLaunch(
  session: HostStudioSimulatorSession,
  configuration: StudioSimulatorRunConfigurationInput,
  options: ResolveStudioSimulatorExecutionLaunchOptions,
): Promise<StudioSimulatorExecutionLaunchResult> {
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
      adapterId: STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID,
      runConfigurationId,
      session,
      terminalRequest: launch.request,
      evidence: buildStudioSimulatorExecutionEvidence(session, launch.request, {
        projectId: options.projectId,
        runConfigurationId,
      }),
    },
    launchPresentation: launch.launchPresentation,
    blockedAction: launch.blockedAction,
  };
}
