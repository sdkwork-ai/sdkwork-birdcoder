import type { BirdCoderViewState } from '@sdkwork/birdcoder-mp-commons';
import type {
  BirdCoderMiniProgramRuntimeConfig,
  BirdCoderSystemDescriptor,
  BirdCoderWorkbenchSdkPort,
} from '@sdkwork/birdcoder-mp-core';

export type BirdCoderWorkbenchState = BirdCoderViewState<BirdCoderSystemDescriptor>;

export class BirdCoderWorkbenchController {
  public constructor(
    private readonly runtime: BirdCoderMiniProgramRuntimeConfig,
    private readonly sdk: BirdCoderWorkbenchSdkPort,
  ) {}

  public async load(): Promise<BirdCoderWorkbenchState> {
    try {
      const descriptor = await this.sdk.loadSystemDescriptor(this.runtime);
      if (!descriptor) {
        return {
          kind: 'empty',
          message: '工作台能力正在接入，请稍后再试。',
          retryable: true,
        };
      }
      if (descriptor.status === 'unavailable') {
        return {
          kind: 'unavailable',
          data: descriptor,
          message: 'BirdCoder 服务暂时不可用。',
          retryable: true,
        };
      }
      return { kind: 'ready', data: descriptor, retryable: false };
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (code === 'FORBIDDEN' || code === '403') {
        return {
          kind: 'permission-denied',
          message: '当前账号没有访问 BirdCoder 工作台的权限。',
          retryable: false,
        };
      }
      return {
        kind: 'error',
        message: error instanceof Error ? error.message : '工作台加载失败。',
        retryable: true,
      };
    }
  }
}
