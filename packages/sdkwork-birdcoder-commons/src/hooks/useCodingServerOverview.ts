import { useCallback, useEffect, useState } from 'react';
import type {
  BirdCoderApiRouteCatalogEntry,
  BirdCoderCodingServerDescriptor,
  BirdCoderCoreHealthSummary,
  BirdCoderCoreRuntimeSummary,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
} from '@sdkwork/birdcoder-types';
import type { ICoreReadService } from '@sdkwork/birdcoder-infrastructure';
import { useIDEServices } from '../context/ideServices.ts';

export interface BirdCoderCodingServerOverviewData {
  descriptor: BirdCoderCodingServerDescriptor | null;
  engines: BirdCoderEngineDescriptor[];
  engineCapabilities: Record<string, BirdCoderEngineCapabilityMatrix>;
  health: BirdCoderCoreHealthSummary | null;
  models: BirdCoderModelCatalogEntry[];
  routes: BirdCoderApiRouteCatalogEntry[];
  runtime: BirdCoderCoreRuntimeSummary | null;
}

export interface BirdCoderCodingServerOverviewState extends BirdCoderCodingServerOverviewData {
  isLoading: boolean;
}

const INITIAL_DATA: BirdCoderCodingServerOverviewData = {
  descriptor: null,
  engines: [],
  engineCapabilities: {},
  health: null,
  models: [],
  routes: [],
  runtime: null,
};

const INITIAL_STATE: BirdCoderCodingServerOverviewState = {
  ...INITIAL_DATA,
  isLoading: false,
};

type BirdCoderCodingServerOverviewReader = Pick<
  ICoreReadService,
  | 'getDescriptor'
  | 'getEngineCapabilities'
  | 'getHealth'
  | 'getRuntime'
  | 'listEngines'
  | 'listModels'
  | 'listRoutes'
>;

export async function loadCodingServerOverview(
  coreReadService: BirdCoderCodingServerOverviewReader,
): Promise<BirdCoderCodingServerOverviewData> {
  const [descriptor, runtime, health, engines, models, routes] = await Promise.all([
    coreReadService.getDescriptor(),
    coreReadService.getRuntime(),
    coreReadService.getHealth(),
    coreReadService.listEngines(),
    coreReadService.listModels(),
    coreReadService.listRoutes(),
  ]);

  const engineCapabilityEntries = await Promise.all(
    engines.map(async (engine) => {
      const capabilities = await coreReadService.getEngineCapabilities(engine.engineKey);
      return [engine.engineKey, capabilities] as const;
    }),
  );

  return {
    descriptor,
    engines,
    engineCapabilities: Object.fromEntries(engineCapabilityEntries),
    health,
    models,
    routes,
    runtime,
  };
}

export function useCodingServerOverview() {
  const { coreReadService } = useIDEServices();
  const [state, setState] = useState<BirdCoderCodingServerOverviewState>(INITIAL_STATE);

  const refreshOverview = useCallback(async () => {
    setState((current) => ({
      ...current,
      isLoading: true,
    }));

    try {
      const overview = await loadCodingServerOverview(coreReadService);
      setState({
        ...overview,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load coding server overview', error);
      setState((current) => ({
        ...current,
        isLoading: false,
      }));
    }
  }, [coreReadService]);

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  return {
    ...state,
    refreshOverview,
  };
}
