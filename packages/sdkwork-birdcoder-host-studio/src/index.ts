import {
  getDistributionManifest,
  type DistributionId,
} from '../../sdkwork-birdcoder-distribution/src/index.ts';
import {
  createBirdHostDescriptorFromDistribution,
  type BirdHostDescriptor,
} from '@sdkwork/birdcoder-host-core';

export const HOST_STUDIO_PREVIEW_ADAPTER_ID = 'host-studio.preview';
export const HOST_STUDIO_SIMULATOR_ADAPTER_ID = 'host-studio.simulator';

export type HostStudioPreviewPlatform = 'web' | 'miniprogram' | 'app';
export type HostStudioPreviewWebDevice = 'desktop' | 'tablet' | 'mobile';
export type HostStudioPreviewMiniProgramPlatform = 'wechat' | 'douyin' | 'alipay';
export type HostStudioPreviewAppPlatform = 'ios' | 'android' | 'harmony';
export type HostStudioPreviewOrientation = 'portrait' | 'landscape';
export type HostStudioSimulatorRuntime =
  | 'browser'
  | 'wechat-devtools'
  | 'douyin-devtools'
  | 'alipay-devtools'
  | 'ios-simulator'
  | 'android-emulator'
  | 'harmony-emulator';

export interface ResolveHostStudioPreviewSessionInput {
  url?: string;
  platform?: HostStudioPreviewPlatform;
  webDevice?: HostStudioPreviewWebDevice;
  miniProgramPlatform?: HostStudioPreviewMiniProgramPlatform;
  appPlatform?: HostStudioPreviewAppPlatform;
  deviceModel?: string;
  isLandscape?: boolean;
}

export interface HostStudioPreviewTarget {
  url: string;
  platform: HostStudioPreviewPlatform;
  channel: string;
  orientation: HostStudioPreviewOrientation;
  webDevice: HostStudioPreviewWebDevice | null;
  miniProgramPlatform: HostStudioPreviewMiniProgramPlatform | null;
  appPlatform: HostStudioPreviewAppPlatform | null;
  deviceModel: string | null;
}

export interface HostStudioPreviewSession {
  adapterId: typeof HOST_STUDIO_PREVIEW_ADAPTER_ID;
  host: BirdHostDescriptor;
  target: HostStudioPreviewTarget;
  evidenceKey: string;
}

export interface ResolveHostStudioSimulatorSessionInput {
  platform?: HostStudioPreviewPlatform;
  webDevice?: HostStudioPreviewWebDevice;
  miniProgramPlatform?: HostStudioPreviewMiniProgramPlatform;
  appPlatform?: HostStudioPreviewAppPlatform;
  deviceModel?: string;
  isLandscape?: boolean;
}

export interface HostStudioSimulatorTarget {
  platform: HostStudioPreviewPlatform;
  channel: string;
  runtime: HostStudioSimulatorRuntime;
  orientation: HostStudioPreviewOrientation;
  webDevice: HostStudioPreviewWebDevice | null;
  miniProgramPlatform: HostStudioPreviewMiniProgramPlatform | null;
  appPlatform: HostStudioPreviewAppPlatform | null;
  deviceModel: string | null;
}

export interface HostStudioSimulatorSession {
  adapterId: typeof HOST_STUDIO_SIMULATOR_ADAPTER_ID;
  host: BirdHostDescriptor;
  target: HostStudioSimulatorTarget;
  evidenceKey: string;
}

const DEFAULT_WEB_DEVICE: HostStudioPreviewWebDevice = 'desktop';
const DEFAULT_MINI_PROGRAM_PLATFORM: HostStudioPreviewMiniProgramPlatform = 'wechat';
const DEFAULT_APP_PLATFORM: HostStudioPreviewAppPlatform = 'ios';
const DEFAULT_MINI_PROGRAM_DEVICE_MODEL = 'iphone-14-pro';

const DEFAULT_APP_DEVICE_MODELS: Record<HostStudioPreviewAppPlatform, string> = {
  ios: 'iphone-14-pro',
  android: 'pixel-7',
  harmony: 'mate-60',
};

const MINI_PROGRAM_SIMULATOR_RUNTIMES: Record<
  HostStudioPreviewMiniProgramPlatform,
  HostStudioSimulatorRuntime
> = {
  wechat: 'wechat-devtools',
  douyin: 'douyin-devtools',
  alipay: 'alipay-devtools',
};

const APP_SIMULATOR_RUNTIMES: Record<
  HostStudioPreviewAppPlatform,
  HostStudioSimulatorRuntime
> = {
  ios: 'ios-simulator',
  android: 'android-emulator',
  harmony: 'harmony-emulator',
};

export function createHostStudioDescriptor(distributionId: DistributionId = 'global') {
  return createBirdHostDescriptorFromDistribution(
    'desktop',
    getDistributionManifest(distributionId),
  );
}

export function resolveHostStudioPreviewSession(
  input: ResolveHostStudioPreviewSessionInput = {},
  distributionId: DistributionId = 'global',
): HostStudioPreviewSession {
  const host = createHostStudioDescriptor(distributionId);
  const platform = input.platform ?? 'web';
  const orientation: HostStudioPreviewOrientation = input.isLandscape ? 'landscape' : 'portrait';

  const target: HostStudioPreviewTarget = {
    url: input.url ?? 'about:blank',
    platform,
    channel: 'web.desktop',
    orientation,
    webDevice: null,
    miniProgramPlatform: null,
    appPlatform: null,
    deviceModel: null,
  };

  if (platform === 'web') {
    const webDevice = input.webDevice ?? DEFAULT_WEB_DEVICE;
    target.channel = `web.${webDevice}`;
    target.webDevice = webDevice;
  } else if (platform === 'miniprogram') {
    const miniProgramPlatform = input.miniProgramPlatform ?? DEFAULT_MINI_PROGRAM_PLATFORM;
    target.channel = `miniprogram.${miniProgramPlatform}`;
    target.miniProgramPlatform = miniProgramPlatform;
    target.deviceModel = input.deviceModel ?? DEFAULT_MINI_PROGRAM_DEVICE_MODEL;
  } else {
    const appPlatform = input.appPlatform ?? DEFAULT_APP_PLATFORM;
    target.channel = `app.${appPlatform}`;
    target.appPlatform = appPlatform;
    target.deviceModel = input.deviceModel ?? DEFAULT_APP_DEVICE_MODELS[appPlatform];
  }

  return {
    adapterId: HOST_STUDIO_PREVIEW_ADAPTER_ID,
    host,
    target,
    evidenceKey: `preview.${host.distributionId}.${target.channel}.${target.orientation}`,
  };
}

export function resolveHostStudioSimulatorSession(
  input: ResolveHostStudioSimulatorSessionInput = {},
  distributionId: DistributionId = 'global',
): HostStudioSimulatorSession {
  const host = createHostStudioDescriptor(distributionId);
  const platform = input.platform ?? 'web';
  const orientation: HostStudioPreviewOrientation = input.isLandscape ? 'landscape' : 'portrait';

  const target: HostStudioSimulatorTarget = {
    platform,
    channel: 'web.desktop',
    runtime: 'browser',
    orientation,
    webDevice: null,
    miniProgramPlatform: null,
    appPlatform: null,
    deviceModel: null,
  };

  if (platform === 'web') {
    const webDevice = input.webDevice ?? DEFAULT_WEB_DEVICE;
    target.channel = `web.${webDevice}`;
    target.webDevice = webDevice;
  } else if (platform === 'miniprogram') {
    const miniProgramPlatform = input.miniProgramPlatform ?? DEFAULT_MINI_PROGRAM_PLATFORM;
    target.channel = `miniprogram.${miniProgramPlatform}`;
    target.runtime = MINI_PROGRAM_SIMULATOR_RUNTIMES[miniProgramPlatform];
    target.miniProgramPlatform = miniProgramPlatform;
    target.deviceModel = input.deviceModel ?? DEFAULT_MINI_PROGRAM_DEVICE_MODEL;
  } else {
    const appPlatform = input.appPlatform ?? DEFAULT_APP_PLATFORM;
    target.channel = `app.${appPlatform}`;
    target.runtime = APP_SIMULATOR_RUNTIMES[appPlatform];
    target.appPlatform = appPlatform;
    target.deviceModel = input.deviceModel ?? DEFAULT_APP_DEVICE_MODELS[appPlatform];
  }

  return {
    adapterId: HOST_STUDIO_SIMULATOR_ADAPTER_ID,
    host,
    target,
    evidenceKey: `simulator.${host.distributionId}.${target.channel}.${target.runtime}.${target.orientation}`,
  };
}
