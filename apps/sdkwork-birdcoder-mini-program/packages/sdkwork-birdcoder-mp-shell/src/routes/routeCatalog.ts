import type { BirdCoderMiniProgramRouteContribution } from '@sdkwork/birdcoder-mp-workbench';
import { BIRDCODER_MP_WORKBENCH_ROUTE } from '@sdkwork/birdcoder-mp-workbench';

export interface BirdCoderMiniProgramRouteCatalog {
  readonly routes: readonly BirdCoderMiniProgramRouteContribution[];
  readonly initialRouteId: BirdCoderMiniProgramRouteContribution['id'];
}

export function createBirdCoderMiniProgramRouteCatalog(): BirdCoderMiniProgramRouteCatalog {
  return {
    routes: [BIRDCODER_MP_WORKBENCH_ROUTE],
    initialRouteId: BIRDCODER_MP_WORKBENCH_ROUTE.id,
  };
}
