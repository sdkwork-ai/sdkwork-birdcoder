import {
  resolveRunConfigurationTerminalLaunch,
  type ResolveRunConfigurationTerminalLaunchOptions,
  type RunConfigurationRecord,
  type RunConfigurationTerminalLaunchResult,
  type RunConfigurationTerminalRequest,
} from '@sdkwork/birdcoder-commons';
import type { HostStudioPreviewSession } from '../../../sdkwork-birdcoder-host-studio/src/index.ts';

export const STUDIO_PREVIEW_EXECUTION_ADAPTER_ID = 'studio.preview.execution';
export const DEFAULT_STUDIO_PREVIEW_URL = 'http://127.0.0.1:4173';

type StudioPreviewRunConfigurationInput = Pick<
  RunConfigurationRecord,
  'id' | 'command' | 'cwdMode' | 'customCwd' | 'profileId'
> &
  Partial<RunConfigurationRecord>;

export interface StudioPreviewExecutionEvidence {
  adapterId: typeof STUDIO_PREVIEW_EXECUTION_ADAPTER_ID;
  evidenceKey: string;
  sessionEvidenceKey: string;
  host: HostStudioPreviewSession['host'];
  channel: HostStudioPreviewSession['target']['channel'];
  orientation: HostStudioPreviewSession['target']['orientation'];
  previewUrl: string;
  command: string;
  cwd: string;
  profileId: RunConfigurationTerminalRequest['profileId'];
  projectId: string | null;
  runConfigurationId: string | null;
  launchedAt: number;
}

export interface StudioPreviewExecutionRequest {
  adapterId: typeof STUDIO_PREVIEW_EXECUTION_ADAPTER_ID;
  runConfigurationId: string | null;
  session: HostStudioPreviewSession;
  terminalRequest: RunConfigurationTerminalRequest;
  evidence: StudioPreviewExecutionEvidence;
}

export interface ResolveStudioPreviewExecutionLaunchOptions
  extends ResolveRunConfigurationTerminalLaunchOptions {
  projectId?: string | null;
  runConfigurationId?: string | null;
}

export interface StudioPreviewExecutionLaunchResult {
  request: StudioPreviewExecutionRequest | null;
  launchPresentation: RunConfigurationTerminalLaunchResult['launchPresentation'];
  blockedAction: RunConfigurationTerminalLaunchResult['blockedAction'];
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function resolveStudioPreviewUrl(url: string | null | undefined): string {
  const normalized = url?.trim();
  if (!normalized || normalized === 'about:blank') {
    return DEFAULT_STUDIO_PREVIEW_URL;
  }

  return normalized;
}

export function buildStudioPreviewExecutionEvidence(
  session: HostStudioPreviewSession,
  terminalRequest: RunConfigurationTerminalRequest,
  options: Pick<ResolveStudioPreviewExecutionLaunchOptions, 'projectId' | 'runConfigurationId'> = {},
): StudioPreviewExecutionEvidence {
  return {
    adapterId: STUDIO_PREVIEW_EXECUTION_ADAPTER_ID,
    evidenceKey: `${session.evidenceKey}.launch`,
    sessionEvidenceKey: session.evidenceKey,
    host: session.host,
    channel: session.target.channel,
    orientation: session.target.orientation,
    previewUrl: session.target.url,
    command: terminalRequest.command,
    cwd: terminalRequest.path,
    profileId: terminalRequest.profileId,
    projectId: normalizeOptionalId(options.projectId),
    runConfigurationId: normalizeOptionalId(options.runConfigurationId),
    launchedAt: terminalRequest.timestamp,
  };
}

export async function resolveStudioPreviewExecutionLaunch(
  session: HostStudioPreviewSession,
  configuration: StudioPreviewRunConfigurationInput,
  options: ResolveStudioPreviewExecutionLaunchOptions,
): Promise<StudioPreviewExecutionLaunchResult> {
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
      adapterId: STUDIO_PREVIEW_EXECUTION_ADAPTER_ID,
      runConfigurationId,
      session,
      terminalRequest: launch.request,
      evidence: buildStudioPreviewExecutionEvidence(session, launch.request, {
        projectId: options.projectId,
        runConfigurationId,
      }),
    },
    launchPresentation: launch.launchPresentation,
    blockedAction: launch.blockedAction,
  };
}
