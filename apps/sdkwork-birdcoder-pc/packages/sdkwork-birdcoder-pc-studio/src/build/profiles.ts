export const STUDIO_BUILD_PROFILE_REGISTRY_ADAPTER_ID = 'studio.build.profile-registry';

export type StudioBuildPlatform = 'web' | 'app' | 'mini-program' | 'server' | 'desktop';
export type StudioBuildOutputKind =
  | 'web'
  | 'application'
  | 'mini-program'
  | 'server'
  | 'desktop';

export interface StudioBuildProfile {
  adapterId: typeof STUDIO_BUILD_PROFILE_REGISTRY_ADAPTER_ID;
  profileId: string;
  platform: StudioBuildPlatform;
  targetId: string;
  outputKind: StudioBuildOutputKind;
  displayName: string;
  evidenceKey: string;
}

export interface ResolveStudioBuildProfileInput {
  platform?: string | null;
  webDevice?: string | null;
  miniProgramPlatform?: string | null;
  appPlatform?: string | null;
}

function normalizeSegment(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim().toLowerCase().replace(/_/g, '-');

  return normalized || fallback;
}

function titleize(value: string): string {
  return value
    .split(/[-.]/u)
    .filter(Boolean)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ''}${segment.slice(1)}`)
    .join(' ');
}

function createStudioBuildProfile(input: {
  platform: StudioBuildPlatform;
  targetId: string;
  outputKind: StudioBuildOutputKind;
}): StudioBuildProfile {
  return {
    adapterId: STUDIO_BUILD_PROFILE_REGISTRY_ADAPTER_ID,
    profileId: input.targetId,
    platform: input.platform,
    targetId: input.targetId,
    outputKind: input.outputKind,
    displayName: titleize(input.targetId),
    evidenceKey: `build.${input.targetId}`,
  };
}

export function resolveStudioBuildProfile(
  input: ResolveStudioBuildProfileInput,
): StudioBuildProfile {
  const platform = normalizeSegment(input.platform, 'web');

  switch (platform) {
    case 'app': {
      const appPlatform = normalizeSegment(input.appPlatform, 'mobile');

      return createStudioBuildProfile({
        platform: 'app',
        targetId: `app.${appPlatform}`,
        outputKind: 'application',
      });
    }
    case 'mini-program':
    case 'mini-programs':
    case 'mp': {
      const miniProgramPlatform = normalizeSegment(
        input.miniProgramPlatform,
        'wechat',
      );

      return createStudioBuildProfile({
        platform: 'mini-program',
        targetId: `mini-program.${miniProgramPlatform}`,
        outputKind: 'mini-program',
      });
    }
    case 'server':
      return createStudioBuildProfile({
        platform: 'server',
        targetId: 'server',
        outputKind: 'server',
      });
    case 'desktop':
      return createStudioBuildProfile({
        platform: 'desktop',
        targetId: 'desktop',
        outputKind: 'desktop',
      });
    case 'web':
    default: {
      const webDevice = normalizeSegment(input.webDevice, 'desktop');

      return createStudioBuildProfile({
        platform: 'web',
        targetId: `web.${webDevice}`,
        outputKind: 'web',
      });
    }
  }
}
