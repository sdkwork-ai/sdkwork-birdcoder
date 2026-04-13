import {
  resolveRunConfigurationTerminalLaunch,
  type ResolveRunConfigurationTerminalLaunchOptions,
  type RunConfigurationRecord,
  type RunConfigurationTerminalLaunchResult,
  type RunConfigurationTerminalRequest,
} from '../../../sdkwork-birdcoder-commons/src/terminal/runConfigs.ts';

export const STUDIO_TEST_EXECUTION_ADAPTER_ID = 'studio.test.execution';

type StudioTestRunConfigurationInput = Pick<
  RunConfigurationRecord,
  'id' | 'command' | 'cwdMode' | 'customCwd' | 'profileId'
> &
  Partial<RunConfigurationRecord>;

export interface StudioTestExecutionEvidence {
  adapterId: typeof STUDIO_TEST_EXECUTION_ADAPTER_ID;
  evidenceKey: string;
  command: string;
  cwd: string;
  profileId: RunConfigurationTerminalRequest['profileId'];
  projectId: string | null;
  runConfigurationId: string | null;
  launchedAt: number;
}

export interface StudioTestExecutionRequest {
  adapterId: typeof STUDIO_TEST_EXECUTION_ADAPTER_ID;
  runConfigurationId: string | null;
  terminalRequest: RunConfigurationTerminalRequest;
  evidence: StudioTestExecutionEvidence;
}

export interface ResolveStudioTestExecutionLaunchOptions
  extends ResolveRunConfigurationTerminalLaunchOptions {
  projectId?: string | null;
  runConfigurationId?: string | null;
}

export interface StudioTestExecutionLaunchResult {
  request: StudioTestExecutionRequest | null;
  launchPresentation: RunConfigurationTerminalLaunchResult['launchPresentation'];
  blockedAction: RunConfigurationTerminalLaunchResult['blockedAction'];
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildStudioTestEvidenceKey(runConfigurationId: string | null): string {
  return `test.${runConfigurationId ?? 'default'}.launch`;
}

export function buildStudioTestExecutionEvidence(
  terminalRequest: RunConfigurationTerminalRequest,
  options: Pick<ResolveStudioTestExecutionLaunchOptions, 'projectId' | 'runConfigurationId'> = {},
): StudioTestExecutionEvidence {
  const runConfigurationId = normalizeOptionalId(options.runConfigurationId);

  return {
    adapterId: STUDIO_TEST_EXECUTION_ADAPTER_ID,
    evidenceKey: buildStudioTestEvidenceKey(runConfigurationId),
    command: terminalRequest.command,
    cwd: terminalRequest.path,
    profileId: terminalRequest.profileId,
    projectId: normalizeOptionalId(options.projectId),
    runConfigurationId,
    launchedAt: terminalRequest.timestamp,
  };
}

export async function resolveStudioTestExecutionLaunch(
  configuration: StudioTestRunConfigurationInput,
  options: ResolveStudioTestExecutionLaunchOptions,
) : Promise<StudioTestExecutionLaunchResult> {
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
      adapterId: STUDIO_TEST_EXECUTION_ADAPTER_ID,
      runConfigurationId,
      terminalRequest: launch.request,
      evidence: buildStudioTestExecutionEvidence(launch.request, {
        projectId: options.projectId,
        runConfigurationId,
      }),
    },
    launchPresentation: launch.launchPresentation,
    blockedAction: launch.blockedAction,
  };
}
