import {
  createBirdCoderWeixinHost,
  resolveWeixinMiniProgramApi,
  type BirdCoderWeixinHost,
  type WeixinMiniProgramApi,
} from '@sdkwork/birdcoder-mp-host';

export function registerBirdCoderMiniProgramHostAdapters(
  api: WeixinMiniProgramApi = resolveWeixinMiniProgramApi(),
): BirdCoderWeixinHost {
  return createBirdCoderWeixinHost(api);
}
