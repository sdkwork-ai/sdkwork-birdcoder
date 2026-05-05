export const STUDIO_BUILD_PROFILE_REGISTRY_ADAPTER_ID = 'studio.build.profile-registry';

export type StudioBuildPlatform = 'web' | 'miniprogram' | 'app';
export type StudioBuildOutputKind = 'web' | 'mini-program' | 'application';

export interface StudioBuildProfile {
  adapterId: typeof STUDIO_BUILD_PROFILE_REGISTRY_ADAPTER_ID;
  profileId: string;
  platform: StudioBuildPlatform;
  targetId: string;
  outputKind: StudioBuildOutputKind;
  displayName: string;
  evidenceKey: string;
}

export interface ResolveStudioBuildProfileOptions {
  platform?: StudioBuildPlatform | null;
  webDevice?: 'desktop' | 'tablet' | 'mobile' | null;
  miniProgramPlatform?: 'wechat' | 'douyin' | 'alipay' | null;
  appPlatform?: 'ios' | 'android' | 'harmony' | null;
}

function toTitleCase(value: string): string {
  return value
    .split(/[.\-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function resolveStudioBuildProfile(
  options: ResolveStudioBuildProfileOptions = {},
): StudioBuildProfile {
  const platform = options.platform ?? 'web';

  if (platform === 'miniprogram') {
    const targetId = `miniprogram.${options.miniProgramPlatform ?? 'wechat'}`;
    return {
      adapterId: STUDIO_BUILD_PROFILE_REGISTRY_ADAPTER_ID,
      profileId: targetId,
      platform,
      targetId,
      outputKind: 'mini-program',
      displayName: toTitleCase(targetId),
      evidenceKey: `build.${targetId}`,
    };
  }

  if (platform === 'app') {
    const targetId = `app.${options.appPlatform ?? 'ios'}`;
    return {
      adapterId: STUDIO_BUILD_PROFILE_REGISTRY_ADAPTER_ID,
      profileId: targetId,
      platform,
      targetId,
      outputKind: 'application',
      displayName: toTitleCase(targetId),
      evidenceKey: `build.${targetId}`,
    };
  }

  const targetId = `web.${options.webDevice ?? 'desktop'}`;
  return {
    adapterId: STUDIO_BUILD_PROFILE_REGISTRY_ADAPTER_ID,
    profileId: targetId,
    platform: 'web',
    targetId,
    outputKind: 'web',
    displayName: toTitleCase(targetId),
    evidenceKey: `build.${targetId}`,
  };
}
