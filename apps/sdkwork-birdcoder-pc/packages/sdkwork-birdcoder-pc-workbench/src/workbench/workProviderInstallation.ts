import {
  BirdCoderWorkProviderInstallationError,
  getBirdCoderWorkProviderInstallationDefinition,
  installBirdCoderWorkProvider,
  type BirdCoderWorkProviderId,
  type BirdCoderWorkProviderInstallationDefinition,
  type BirdCoderWorkProviderInstallationResult,
} from '@sdkwork/birdcoder-pc-infrastructure/platform/workProviderInstallation';
import {
  loadWorkbenchAgentEngineCatalog,
  resetWorkbenchAgentEngineCatalog,
} from './agentEngineCatalog.ts';
import { matchesWorkbenchModeCatalogEngine, WORKBENCH_MODE_PROVIDERS } from './workbenchMode.ts';

export { BirdCoderWorkProviderInstallationError };
export type {
  BirdCoderWorkProviderId,
  BirdCoderWorkProviderInstallationDefinition,
  BirdCoderWorkProviderInstallationResult,
};

export interface WorkbenchWorkProviderInstallationResult
  extends BirdCoderWorkProviderInstallationResult {
  availableAfterRefresh: boolean;
  catalogRefreshed: boolean;
}

export function getWorkbenchWorkProviderInstallationDefinition(
  providerId: string,
): BirdCoderWorkProviderInstallationDefinition {
  return getBirdCoderWorkProviderInstallationDefinition(providerId);
}

export async function installWorkbenchWorkProvider(
  providerId: string,
): Promise<WorkbenchWorkProviderInstallationResult> {
  const installation = await installBirdCoderWorkProvider(providerId);
  const provider = WORKBENCH_MODE_PROVIDERS.work.find(
    (candidate) => candidate.engineId === installation.providerId,
  );
  if (!provider) {
    throw new BirdCoderWorkProviderInstallationError(
      'unsupported-provider',
      `BirdCoder cannot admit Work Provider "${installation.providerId}".`,
    );
  }

  resetWorkbenchAgentEngineCatalog();
  try {
    const engines = await loadWorkbenchAgentEngineCatalog();
    return {
      ...installation,
      availableAfterRefresh: engines.some((engine) =>
        matchesWorkbenchModeCatalogEngine('work', engine)
        && engine.id === provider.engineId
        && engine.agentId === provider.agentId
        && engine.tier === provider.tier),
      catalogRefreshed: true,
    };
  } catch {
    return {
      ...installation,
      availableAfterRefresh: false,
      catalogRefreshed: false,
    };
  }
}
