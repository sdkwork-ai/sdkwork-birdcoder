import type {
  BirdCoderCodeEngineKey,
  BirdCoderEngineAccessLane,
  BirdCoderEngineBridgeProtocol,
  BirdCoderEngineOfficialIntegration,
  BirdCoderEngineRuntimeOwner,
  BirdCoderEngineTransportKind,
  BirdCoderStandardEngineId,
} from '@sdkwork/birdcoder-types';
import {
  findBirdCoderCodeEngineManifest,
  listBirdCoderCodeEngineManifests,
  type BirdCoderCodeEngineManifest,
  type BirdCoderCodeEngineNativeSessionDiscoveryMode,
} from './manifest.ts';

export const WORKBENCH_CODE_ENGINE_AUTHORITY_PATHS = [
  'rust-native',
  'rust-rpc-bridge',
  'typescript-rpc-bridge',
  'external-service',
  'unknown',
] as const;

export type WorkbenchCodeEngineAuthorityPath =
  | (typeof WORKBENCH_CODE_ENGINE_AUTHORITY_PATHS)[number]
  | (string & {});

export interface WorkbenchCodeEngineExecutionTopology {
  engineId: BirdCoderStandardEngineId;
  primaryLane: BirdCoderEngineAccessLane | null;
  fallbackLanes: readonly BirdCoderEngineAccessLane[];
  authorityPath: WorkbenchCodeEngineAuthorityPath;
  serverReady: boolean;
  bridgeRequired: boolean;
  runtimeOwner: BirdCoderEngineRuntimeOwner | null;
  bridgeProtocol: BirdCoderEngineBridgeProtocol | null;
  transportKind: BirdCoderEngineTransportKind | null;
  officialIntegration: BirdCoderEngineOfficialIntegration | null;
  officialSdkPackageName: string | null;
  officialSdkConfigured: boolean;
  nativeSessionAuthorityBacked: boolean;
  nativeSessionDiscoveryMode: BirdCoderCodeEngineNativeSessionDiscoveryMode | null;
}

function resolvePrimaryLane(
  manifest: BirdCoderCodeEngineManifest,
): BirdCoderEngineAccessLane | null {
  const accessPlan = manifest.descriptor.accessPlan;
  if (!accessPlan) {
    return null;
  }

  return (
    accessPlan.lanes.find((lane) => lane.laneId === accessPlan.primaryLaneId) ??
    accessPlan.lanes[0] ??
    null
  );
}

function resolveFallbackLanes(
  manifest: BirdCoderCodeEngineManifest,
  primaryLane: BirdCoderEngineAccessLane | null,
): readonly BirdCoderEngineAccessLane[] {
  const accessPlan = manifest.descriptor.accessPlan;
  if (!accessPlan) {
    return [];
  }

  const fallbackLanes = accessPlan.fallbackLaneIds
    .map((laneId) => accessPlan.lanes.find((lane) => lane.laneId === laneId) ?? null)
    .filter((lane): lane is BirdCoderEngineAccessLane => lane !== null);

  if (fallbackLanes.length > 0) {
    return fallbackLanes;
  }

  return accessPlan.lanes.filter((lane) => lane.laneId !== primaryLane?.laneId);
}

function resolveAuthorityPath(
  primaryLane: BirdCoderEngineAccessLane | null,
): WorkbenchCodeEngineAuthorityPath {
  if (!primaryLane) {
    return 'unknown';
  }

  switch (primaryLane.runtimeOwner) {
    case 'rust-server':
      return primaryLane.strategyKind === 'rust-native' ? 'rust-native' : 'rust-rpc-bridge';
    case 'typescript-bridge':
      return 'typescript-rpc-bridge';
    case 'external-service':
      return 'external-service';
    default:
      return 'unknown';
  }
}

function buildExecutionTopology(
  manifest: BirdCoderCodeEngineManifest,
): WorkbenchCodeEngineExecutionTopology {
  const primaryLane = resolvePrimaryLane(manifest);
  const officialIntegration = manifest.descriptor.officialIntegration ?? null;

  return {
    engineId: manifest.id,
    primaryLane,
    fallbackLanes: resolveFallbackLanes(manifest, primaryLane),
    authorityPath: resolveAuthorityPath(primaryLane),
    serverReady: primaryLane?.status === 'ready',
    bridgeRequired:
      primaryLane !== null &&
      (primaryLane.runtimeOwner !== 'rust-server' || primaryLane.strategyKind !== 'rust-native'),
    runtimeOwner: primaryLane?.runtimeOwner ?? null,
    bridgeProtocol: primaryLane?.bridgeProtocol ?? null,
    transportKind: primaryLane?.transportKind ?? manifest.descriptor.transportKinds[0] ?? null,
    officialIntegration,
    officialSdkPackageName: officialIntegration?.officialEntry.packageName ?? null,
    officialSdkConfigured:
      officialIntegration?.integrationClass === 'official-sdk' &&
      Boolean(officialIntegration.officialEntry.packageName?.trim()),
    nativeSessionAuthorityBacked: manifest.nativeSession.authorityBacked,
    nativeSessionDiscoveryMode: manifest.nativeSession.discoveryMode,
  };
}

export const WORKBENCH_CODE_ENGINE_TOPOLOGIES: ReadonlyArray<WorkbenchCodeEngineExecutionTopology> =
  listBirdCoderCodeEngineManifests().map(buildExecutionTopology);

const WORKBENCH_CODE_ENGINE_TOPOLOGY_BY_ID = new Map<
  BirdCoderStandardEngineId,
  WorkbenchCodeEngineExecutionTopology
>(WORKBENCH_CODE_ENGINE_TOPOLOGIES.map((topology) => [topology.engineId, topology]));

export function listWorkbenchCodeEngineExecutionTopologies(): ReadonlyArray<WorkbenchCodeEngineExecutionTopology> {
  return WORKBENCH_CODE_ENGINE_TOPOLOGIES;
}

export function findWorkbenchCodeEngineExecutionTopology(
  value: BirdCoderCodeEngineKey | null | undefined,
): WorkbenchCodeEngineExecutionTopology | null {
  const manifest = findBirdCoderCodeEngineManifest(value);
  if (!manifest) {
    return null;
  }

  return WORKBENCH_CODE_ENGINE_TOPOLOGY_BY_ID.get(manifest.id) ?? null;
}

export function getWorkbenchCodeEngineExecutionTopology(
  value: BirdCoderCodeEngineKey | null | undefined,
): WorkbenchCodeEngineExecutionTopology {
  const topology = findWorkbenchCodeEngineExecutionTopology(value);
  if (!topology) {
    throw new Error(`Unknown BirdCoder code engine topology "${value?.trim() || 'unknown'}".`);
  }

  return topology;
}
