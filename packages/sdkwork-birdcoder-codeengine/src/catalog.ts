import type {
  BirdCoderCodeEngineKey,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineAccessPlan,
  BirdCoderEngineAccessLane,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
  BirdCoderStandardEngineCatalogEntry,
  BirdCoderStandardEngineId,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_STANDARD_DEFAULT_ENGINE_ID,
  BIRDCODER_STANDARD_ENGINE_IDS,
  BIRDCODER_STANDARD_ENGINE_MANIFESTS,
  type BirdCoderCodeEngineNativeSessionProviderEntry,
  getBirdCoderCodeEngineManifestById,
  listBirdCoderCodeEngineNativeSessionProviders,
} from './manifest.ts';
import {
  findBirdCoderCodeEngineAccessPlan,
  resolveBirdCoderCodeEnginePrimaryAccessLane,
} from './access.ts';

export type {
  BirdCoderStandardEngineCatalogEntry,
  BirdCoderStandardEngineId,
  BirdCoderStandardEngineTheme,
} from '@sdkwork/birdcoder-types';

export { BIRDCODER_STANDARD_DEFAULT_ENGINE_ID, BIRDCODER_STANDARD_ENGINE_IDS } from './manifest.ts';
export { listBirdCoderCodeEngineNativeSessionProviders } from './manifest.ts';

export const BIRDCODER_STANDARD_ENGINE_CATALOG: ReadonlyArray<BirdCoderStandardEngineCatalogEntry> =
  BIRDCODER_STANDARD_ENGINE_MANIFESTS;

const BIRDCODER_STANDARD_ENGINE_ID_SET = new Set<string>(BIRDCODER_STANDARD_ENGINE_IDS);
const BIRDCODER_NATIVE_SESSION_PROVIDERS =
  listBirdCoderCodeEngineNativeSessionProviders();
const BIRDCODER_NATIVE_SESSION_PROVIDER_BY_ENGINE_ID = new Map(
  BIRDCODER_NATIVE_SESSION_PROVIDERS.map((provider) => [provider.engineId, provider] as const),
);

function normalizeBirdCoderNativeSessionProviderEngineId(
  value: string | null | undefined,
): BirdCoderStandardEngineId | null {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  const matchedManifest = BIRDCODER_STANDARD_ENGINE_MANIFESTS.find(
    (manifest) =>
      manifest.id === normalizedValue ||
      manifest.aliases.includes(normalizedValue) ||
      manifest.label.toLowerCase() === normalizedValue,
  );
  return matchedManifest?.id ?? null;
}

export function listBirdCoderStandardEngineCatalog(): ReadonlyArray<BirdCoderStandardEngineCatalogEntry> {
  return BIRDCODER_STANDARD_ENGINE_CATALOG;
}

export function findBirdCoderStandardEngineCatalogEntry(
  value: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderStandardEngineCatalogEntry | null {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  return (
    BIRDCODER_STANDARD_ENGINE_CATALOG.find(
      (entry) =>
        entry.id === normalizedValue ||
        entry.aliases.includes(normalizedValue) ||
        entry.label.toLowerCase() === normalizedValue,
    ) ?? null
  );
}

export function listBirdCoderStandardEngineDescriptors(): ReadonlyArray<BirdCoderEngineDescriptor> {
  return BIRDCODER_STANDARD_ENGINE_CATALOG.map((entry) => entry.descriptor);
}

export function listBirdCoderStandardModelCatalogEntries(): ReadonlyArray<BirdCoderModelCatalogEntry> {
  return BIRDCODER_STANDARD_ENGINE_CATALOG.flatMap((entry) => entry.modelCatalog);
}

export function normalizeBirdCoderStandardEngineId(
  value: string | null | undefined,
): BirdCoderStandardEngineId {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return BIRDCODER_STANDARD_DEFAULT_ENGINE_ID;
  }

  const matchedEntry = BIRDCODER_STANDARD_ENGINE_MANIFESTS.find(
    (entry) =>
      entry.id === normalizedValue ||
      entry.aliases.includes(normalizedValue) ||
      entry.label.toLowerCase() === normalizedValue,
  );

  return matchedEntry?.id ?? BIRDCODER_STANDARD_DEFAULT_ENGINE_ID;
}

export function isBirdCoderStandardEngineId(
  value: string | null | undefined,
): value is BirdCoderStandardEngineId {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue !== undefined && BIRDCODER_STANDARD_ENGINE_ID_SET.has(normalizedValue);
}

export function getBirdCoderStandardEngineCatalogEntry(
  value: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderStandardEngineCatalogEntry {
  return (
    findBirdCoderStandardEngineCatalogEntry(value) ??
    getBirdCoderCodeEngineManifestById(BIRDCODER_STANDARD_DEFAULT_ENGINE_ID)
  );
}

export function normalizeBirdCoderCodeEngineId(
  value: string | null | undefined,
): BirdCoderStandardEngineId {
  return normalizeBirdCoderStandardEngineId(value);
}

export function getBirdCoderCodeEngineCatalogEntry(
  engineKey: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderStandardEngineCatalogEntry {
  return getBirdCoderStandardEngineCatalogEntry(engineKey);
}

export function getBirdCoderCodeEngineNativeSessionProvider(
  engineKey: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderCodeEngineNativeSessionProviderEntry | null {
  const normalizedEngineId = normalizeBirdCoderNativeSessionProviderEngineId(engineKey);
  return normalizedEngineId
    ? (BIRDCODER_NATIVE_SESSION_PROVIDER_BY_ENGINE_ID.get(normalizedEngineId) ?? null)
    : null;
}

export function resolveBirdCoderCodeEngineNativeSessionIdPrefix(
  engineKey: BirdCoderCodeEngineKey | null | undefined,
): string | null {
  return getBirdCoderCodeEngineNativeSessionProvider(engineKey)?.nativeSessionIdPrefix ?? null;
}

export function isBirdCoderCodeEngineNativeSessionId(
  nativeSessionId: string | null | undefined,
  engineKey?: BirdCoderCodeEngineKey | null,
): boolean {
  const normalizedSessionId = nativeSessionId?.trim().toLowerCase();
  if (!normalizedSessionId) {
    return false;
  }

  const expectedPrefix = resolveBirdCoderCodeEngineNativeSessionIdPrefix(engineKey);
  if (expectedPrefix && normalizedSessionId.startsWith(expectedPrefix.toLowerCase())) {
    return true;
  }

  return BIRDCODER_NATIVE_SESSION_PROVIDERS.some((provider) =>
    normalizedSessionId.startsWith(provider.nativeSessionIdPrefix.toLowerCase()),
  );
}

export function resolveBirdCoderCodeEngineNativeSessionLookupId(
  nativeSessionId: string | null | undefined,
  engineKey?: BirdCoderCodeEngineKey | null,
): string | null {
  const normalizedSessionId = nativeSessionId?.trim();
  if (!normalizedSessionId) {
    return null;
  }

  const provider = getBirdCoderCodeEngineNativeSessionProvider(engineKey);
  const providers = provider
    ? [
        provider,
        ...BIRDCODER_NATIVE_SESSION_PROVIDERS.filter(
          (entry) => entry.engineId !== provider.engineId,
        ),
      ]
    : BIRDCODER_NATIVE_SESSION_PROVIDERS;
  const matchedProvider = providers.find((entry) =>
    normalizedSessionId
      .toLowerCase()
      .startsWith(entry.nativeSessionIdPrefix.toLowerCase()),
  );

  if (!matchedProvider) {
    return normalizedSessionId;
  }

  return normalizedSessionId.slice(matchedProvider.nativeSessionIdPrefix.length).trim() || null;
}

export function normalizeBirdCoderCodeEngineNativeSessionId(
  nativeSessionId: string | null | undefined,
  engineKey?: BirdCoderCodeEngineKey | null,
): string | null {
  return resolveBirdCoderCodeEngineNativeSessionLookupId(nativeSessionId, engineKey);
}

export function listBirdCoderCodeEngineDescriptors(): ReadonlyArray<BirdCoderEngineDescriptor> {
  return listBirdCoderStandardEngineDescriptors();
}

export function listBirdCoderCodeEngineModels(): ReadonlyArray<BirdCoderModelCatalogEntry> {
  return listBirdCoderStandardModelCatalogEntries();
}

export function getBirdCoderCodeEngineDescriptor(
  engineKey: string,
): BirdCoderEngineDescriptor | null {
  const normalizedEngineKey = engineKey.trim().toLowerCase();
  return (
    listBirdCoderCodeEngineDescriptors().find(
      (descriptor) => descriptor.engineKey.toLowerCase() === normalizedEngineKey,
    ) ?? null
  );
}

export function getBirdCoderCodeEngineCapabilities(
  engineKey: string,
): BirdCoderEngineCapabilityMatrix | null {
  return getBirdCoderCodeEngineDescriptor(engineKey)?.capabilityMatrix ?? null;
}

export function resolveBirdCoderEngineAccessPlan(
  engineKey: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderEngineAccessPlan | null {
  return findBirdCoderCodeEngineAccessPlan(engineKey);
}

export function resolveBirdCoderEnginePrimaryAccessLane(
  engineKey: BirdCoderCodeEngineKey | null | undefined,
): BirdCoderEngineAccessLane | null {
  return resolveBirdCoderCodeEnginePrimaryAccessLane(engineKey);
}
