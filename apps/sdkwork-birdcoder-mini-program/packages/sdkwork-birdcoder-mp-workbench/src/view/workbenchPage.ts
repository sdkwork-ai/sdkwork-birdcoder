import type { BirdCoderWorkbenchState } from '../controller/workbenchController.ts';
import { BirdCoderWorkbenchController } from '../controller/workbenchController.ts';
import type { BirdCoderMiniProgramRuntimeConfig, BirdCoderWorkbenchSdkPort } from '@sdkwork/birdcoder-mp-core';

interface WorkbenchRuntime {
  readonly config: BirdCoderMiniProgramRuntimeConfig;
  readonly sdkPorts: { readonly birdCoder: BirdCoderWorkbenchSdkPort };
  readonly host: { stopPullDownRefresh(): void };
}

interface NativePageInstance {
  setData(data: Partial<BirdCoderWorkbenchPageData>): void;
  loadWorkbench(): Promise<void>;
}

export interface BirdCoderWorkbenchPageData {
  readonly state: BirdCoderWorkbenchState['kind'];
  readonly message: string;
  readonly productName: string;
  readonly version: string;
  readonly profileLabel: string;
  readonly retryable: boolean;
}

export function createBirdCoderWorkbenchPageData(
  state: BirdCoderWorkbenchState,
  profileLabel: string,
): BirdCoderWorkbenchPageData {
  return {
    state: state.kind,
    message: state.message ?? '',
    productName: state.data?.name ?? 'BirdCoder',
    version: state.data?.version ?? '',
    profileLabel,
    retryable: state.retryable,
  };
}

export function createBirdCoderWorkbenchPageDefinition(options: {
  getRuntime(): WorkbenchRuntime;
}) {
  let profileLabel = 'runtime unavailable';
  try {
    const runtime = options.getRuntime();
    profileLabel = `${runtime.config.deploymentProfile} / ${runtime.config.environment}`;
  } catch {
    // The page exposes the bootstrap failure through its normal error state.
  }
  return {
    data: createBirdCoderWorkbenchPageData(
      { kind: 'loading', retryable: false },
      profileLabel,
    ),
    onLoad(this: NativePageInstance) {
      void this.loadWorkbench();
    },
    onPullDownRefresh(this: NativePageInstance) {
      void this.loadWorkbench().finally(() => options.getRuntime().host.stopPullDownRefresh());
    },
    retry(this: NativePageInstance) {
      void this.loadWorkbench();
    },
    async loadWorkbench(this: NativePageInstance) {
      this.setData(createBirdCoderWorkbenchPageData(
        { kind: 'loading', retryable: false },
        profileLabel,
      ));
      try {
        const currentRuntime = options.getRuntime();
        const controller = new BirdCoderWorkbenchController(
          currentRuntime.config,
          currentRuntime.sdkPorts.birdCoder,
        );
        const state = await controller.load();
        this.setData(createBirdCoderWorkbenchPageData(state, profileLabel));
      } catch (error) {
        this.setData(createBirdCoderWorkbenchPageData({
          kind: 'error',
          message: error instanceof Error ? error.message : '工作台加载失败。',
          retryable: true,
        }, profileLabel));
      }
    },
  };
}
