import {
  createBirdHostDescriptorFromDistribution,
  type BirdHostDescriptor,
} from '@sdkwork/birdcoder-pc-host-core';

export const HOST_STUDIO_PREVIEW_ADAPTER_ID = 'host.studio.preview';
export const HOST_STUDIO_SIMULATOR_ADAPTER_ID = 'host.studio.simulator';

export type HostStudioDistributionId = 'global' | 'cn';
export type HostStudioPlatform = 'web' | 'miniprogram' | 'mini-program' | 'app';
export type HostStudioWebDevice = 'desktop' | 'tablet' | 'mobile';
export type HostStudioMiniProgramPlatform = 'wechat' | 'douyin' | 'alipay';
export type HostStudioAppPlatform = 'ios' | 'android' | 'harmony';
export type HostStudioOrientation = 'portrait' | 'landscape';

export interface HostStudioPreviewTarget {
  url: string;
  platform: 'web' | 'miniprogram' | 'app';
  channel: string;
  orientation: HostStudioOrientation;
  webDevice: HostStudioWebDevice | null;
  miniProgramPlatform: HostStudioMiniProgramPlatform | null;
  appPlatform: HostStudioAppPlatform | null;
  deviceModel: string | null;
}

export interface HostStudioSimulatorTarget {
  platform: 'web' | 'miniprogram' | 'app';
  channel: string;
  runtime: string;
  orientation: HostStudioOrientation;
  webDevice: HostStudioWebDevice | null;
  miniProgramPlatform: HostStudioMiniProgramPlatform | null;
  appPlatform: HostStudioAppPlatform | null;
  deviceModel: string | null;
}

export interface HostStudioPreviewSession {
  adapterId: typeof HOST_STUDIO_PREVIEW_ADAPTER_ID;
  host: BirdHostDescriptor;
  target: HostStudioPreviewTarget;
  evidenceKey: string;
}

export interface HostStudioSimulatorSession {
  adapterId: typeof HOST_STUDIO_SIMULATOR_ADAPTER_ID;
  host: BirdHostDescriptor;
  target: HostStudioSimulatorTarget;
  evidenceKey: string;
}

export interface ResolveHostStudioPreviewSessionInput {
  url: string;
  platform?: HostStudioPlatform | null;
  webDevice?: HostStudioWebDevice | null;
  miniProgramPlatform?: HostStudioMiniProgramPlatform | null;
  appPlatform?: HostStudioAppPlatform | null;
  deviceModel?: string | null;
  isLandscape?: boolean | null;
}

export interface ResolveHostStudioSimulatorSessionInput {
  platform?: HostStudioPlatform | null;
  webDevice?: HostStudioWebDevice | null;
  miniProgramPlatform?: HostStudioMiniProgramPlatform | null;
  appPlatform?: HostStudioAppPlatform | null;
  deviceModel?: string | null;
  isLandscape?: boolean | null;
}

const HOST_STUDIO_DISTRIBUTIONS = {
  global: {
    id: 'global',
    appId: 'sdkwork-birdcoder',
    appName: 'SDKWork BirdCoder',
    apiBaseUrl: 'http://127.0.0.1:10240',
  },
  cn: {
    id: 'cn',
    appId: 'sdkwork-birdcoder-cn',
    appName: 'SDKWork BirdCoder',
    apiBaseUrl: 'http://127.0.0.1:10240',
  },
} as const;

function normalizeDistributionId(
  value: HostStudioDistributionId | string | null | undefined,
): HostStudioDistributionId {
  return value === 'cn' ? 'cn' : 'global';
}

export function createHostStudioDescriptor(
  distributionId: HostStudioDistributionId | string = 'global',
  overrides: Partial<BirdHostDescriptor> = {},
): BirdHostDescriptor {
  const normalizedDistributionId = normalizeDistributionId(distributionId);

  return createBirdHostDescriptorFromDistribution(
    'desktop',
    HOST_STUDIO_DISTRIBUTIONS[normalizedDistributionId],
    overrides,
  );
}

function normalizePlatform(value: HostStudioPlatform | null | undefined) {
  if (value === 'app') {
    return 'app' as const;
  }
  if (value === 'miniprogram' || value === 'mini-program') {
    return 'miniprogram' as const;
  }

  return 'web' as const;
}

function normalizeOrientation(isLandscape: boolean | null | undefined): HostStudioOrientation {
  return isLandscape ? 'landscape' : 'portrait';
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function resolveTargetFields(input: {
  platform?: HostStudioPlatform | null;
  webDevice?: HostStudioWebDevice | null;
  miniProgramPlatform?: HostStudioMiniProgramPlatform | null;
  appPlatform?: HostStudioAppPlatform | null;
  deviceModel?: string | null;
}) {
  const platform = normalizePlatform(input.platform);

  if (platform === 'app') {
    const appPlatform = input.appPlatform ?? 'ios';

    return {
      platform,
      channel: `app.${appPlatform}`,
      webDevice: null,
      miniProgramPlatform: null,
      appPlatform,
      deviceModel: normalizeOptionalString(input.deviceModel),
    };
  }

  if (platform === 'miniprogram') {
    const miniProgramPlatform = input.miniProgramPlatform ?? 'wechat';

    return {
      platform,
      channel: `miniprogram.${miniProgramPlatform}`,
      webDevice: null,
      miniProgramPlatform,
      appPlatform: null,
      deviceModel: normalizeOptionalString(input.deviceModel),
    };
  }

  const webDevice = input.webDevice ?? 'desktop';

  return {
    platform,
    channel: `web.${webDevice}`,
    webDevice,
    miniProgramPlatform: null,
    appPlatform: null,
    deviceModel: null,
  };
}

function resolveSimulatorRuntime(input: ReturnType<typeof resolveTargetFields>): string {
  if (input.platform === 'app') {
    if (input.appPlatform === 'harmony') {
      return 'harmony-emulator';
    }
    return `${input.appPlatform ?? 'ios'}-simulator`;
  }

  if (input.platform === 'miniprogram') {
    return `${input.miniProgramPlatform ?? 'wechat'}-devtools`;
  }

  return 'browser';
}

export function resolveHostStudioPreviewSession(
  input: ResolveHostStudioPreviewSessionInput,
  distributionId: HostStudioDistributionId | string = 'global',
): HostStudioPreviewSession {
  const host = createHostStudioDescriptor(distributionId);
  const targetFields = resolveTargetFields(input);
  const orientation = normalizeOrientation(input.isLandscape);
  const target: HostStudioPreviewTarget = {
    url: input.url,
    platform: targetFields.platform,
    channel: targetFields.channel,
    orientation,
    webDevice: targetFields.webDevice,
    miniProgramPlatform: targetFields.miniProgramPlatform,
    appPlatform: targetFields.appPlatform,
    deviceModel: targetFields.deviceModel,
  };

  return {
    adapterId: HOST_STUDIO_PREVIEW_ADAPTER_ID,
    host,
    target,
    evidenceKey: ['preview', host.distributionId, target.channel, orientation].join('.'),
  };
}

export function resolveHostStudioSimulatorSession(
  input: ResolveHostStudioSimulatorSessionInput,
  distributionId: HostStudioDistributionId | string = 'global',
): HostStudioSimulatorSession {
  const host = createHostStudioDescriptor(distributionId);
  const targetFields = resolveTargetFields(input);
  const runtime = resolveSimulatorRuntime(targetFields);
  const orientation = normalizeOrientation(input.isLandscape);
  const target: HostStudioSimulatorTarget = {
    platform: targetFields.platform,
    channel: targetFields.channel,
    runtime,
    orientation,
    webDevice: targetFields.webDevice,
    miniProgramPlatform: targetFields.miniProgramPlatform,
    appPlatform: targetFields.appPlatform,
    deviceModel: targetFields.deviceModel,
  };

  return {
    adapterId: HOST_STUDIO_SIMULATOR_ADAPTER_ID,
    host,
    target,
    evidenceKey: ['simulator', host.distributionId, target.channel, runtime, orientation].join('.'),
  };
}
