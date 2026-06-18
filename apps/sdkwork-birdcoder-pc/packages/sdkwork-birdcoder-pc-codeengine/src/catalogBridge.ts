import {
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineModels,
  listBirdCoderCodeEngineNativeSessionProviders,
} from './catalog.ts';

export async function loadCatalog(): Promise<{
  engines: ReturnType<typeof listBirdCoderCodeEngineDescriptors>;
  models: ReturnType<typeof listBirdCoderCodeEngineModels>;
  nativeProviders: ReturnType<typeof listBirdCoderCodeEngineNativeSessionProviders>;
}> {
  return {
    engines: listBirdCoderCodeEngineDescriptors(),
    models: listBirdCoderCodeEngineModels(),
    nativeProviders: listBirdCoderCodeEngineNativeSessionProviders(),
  };
}
