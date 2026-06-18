import type {
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
} from '@sdkwork/birdcoder-pc-types';

import type { BirdCoderCodeEngineNativeSessionProvider, WorkbenchCodeEngineId } from './catalog.ts';
import {
  listBirdCoderCodeEngineNativeSessionProviders,
} from './catalog.ts';
import { WORKBENCH_ENGINE_KERNELS } from './kernel.ts';

const ENGINE_CATALOG_DEFAULT_TENANT_ID = '0';

export interface BirdCoderCodeEngineManifest {
  id: WorkbenchCodeEngineId;
  label: string;
  tenantId: typeof ENGINE_CATALOG_DEFAULT_TENANT_ID;
  descriptor: BirdCoderEngineDescriptor;
  defaultModelId: string;
  modelCatalog: readonly BirdCoderModelCatalogEntry[];
  nativeSessionProvider: BirdCoderCodeEngineNativeSessionProvider | null;
}

export function listBirdCoderCodeEngineManifests():
  readonly BirdCoderCodeEngineManifest[] {
  const providers = listBirdCoderCodeEngineNativeSessionProviders();

  return WORKBENCH_ENGINE_KERNELS.map((kernel) => {
    const defaultModel = kernel.modelCatalog.find((model) => model.defaultForEngine);

    if (!defaultModel) {
      throw new Error(`Missing default model for code engine manifest: ${kernel.id}`);
    }

    return {
      id: kernel.id,
      label: kernel.label,
      tenantId: ENGINE_CATALOG_DEFAULT_TENANT_ID,
      descriptor: {
        ...kernel.descriptor,
        defaultModelId: defaultModel.modelId,
      },
      defaultModelId: defaultModel.modelId,
      modelCatalog: kernel.modelCatalog,
      nativeSessionProvider:
        providers.find((provider) => provider.engineKey === kernel.id) ?? null,
    };
  });
}
