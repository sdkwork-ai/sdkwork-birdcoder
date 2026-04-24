import type { BirdCoderHostMode } from './coding-session.ts';
import type { BirdCoderCanonicalEntityId } from './data.ts';

export const BIRDCODER_CODE_ENGINE_KEYS = [
  'claude-code',
  'codex',
  'gemini',
  'opencode',
] as const;

export type BirdCoderCodeEngineKey =
  | (typeof BIRDCODER_CODE_ENGINE_KEYS)[number]
  | (string & {});

export const BIRDCODER_ENGINE_TRANSPORT_KINDS = [
  'cli-jsonl',
  'json-rpc-v2',
  'sdk-stream',
  'openapi-http',
  'remote-control-http',
] as const;

export type BirdCoderEngineTransportKind =
  | (typeof BIRDCODER_ENGINE_TRANSPORT_KINDS)[number]
  | (string & {});

export const BIRDCODER_ENGINE_INSTALLATION_KINDS = [
  'bundled',
  'external-cli',
  'embedded-sdk',
  'remote-service',
] as const;

export type BirdCoderEngineInstallationKind =
  | (typeof BIRDCODER_ENGINE_INSTALLATION_KINDS)[number]
  | (string & {});

export const BIRDCODER_ENGINE_ACCESS_STRATEGY_KINDS = [
  'rust-native',
  'grpc-bridge',
  'openapi-proxy',
  'remote-control',
  'cli-spawn',
] as const;

export type BirdCoderEngineAccessStrategyKind =
  | (typeof BIRDCODER_ENGINE_ACCESS_STRATEGY_KINDS)[number]
  | (string & {});

export const BIRDCODER_ENGINE_ACCESS_LANE_STATUSES = ['ready', 'planned'] as const;

export type BirdCoderEngineAccessLaneStatus =
  | (typeof BIRDCODER_ENGINE_ACCESS_LANE_STATUSES)[number]
  | (string & {});

export const BIRDCODER_ENGINE_RUNTIME_OWNERS = [
  'rust-server',
  'typescript-bridge',
  'external-service',
] as const;

export type BirdCoderEngineRuntimeOwner =
  | (typeof BIRDCODER_ENGINE_RUNTIME_OWNERS)[number]
  | (string & {});

export const BIRDCODER_ENGINE_INTEGRATION_CLASSES = [
  'official-sdk',
  'official-protocol',
  'source-derived',
] as const;

export type BirdCoderEngineIntegrationClass =
  | (typeof BIRDCODER_ENGINE_INTEGRATION_CLASSES)[number]
  | (string & {});

export const BIRDCODER_ENGINE_RUNTIME_MODES = [
  'sdk',
  'headless',
  'remote-control',
  'protocol-fallback',
] as const;

export type BirdCoderEngineRuntimeMode =
  | (typeof BIRDCODER_ENGINE_RUNTIME_MODES)[number]
  | (string & {});

export const BIRDCODER_ENGINE_BRIDGE_PROTOCOLS = [
  'direct',
  'grpc',
  'http',
  'websocket',
  'stdio',
] as const;

export type BirdCoderEngineBridgeProtocol =
  | (typeof BIRDCODER_ENGINE_BRIDGE_PROTOCOLS)[number]
  | (string & {});

export type BirdCoderEngineAvailabilityStatus =
  | 'active'
  | 'preview'
  | 'deprecated'
  | 'disabled'
  | (string & {});

export interface BirdCoderEngineCatalogEntitySummary {
  id: BirdCoderCanonicalEntityId;
  uuid: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BirdCoderEngineAccessLane {
  laneId: string;
  label: string;
  strategyKind: BirdCoderEngineAccessStrategyKind;
  runtimeOwner: BirdCoderEngineRuntimeOwner;
  bridgeProtocol: BirdCoderEngineBridgeProtocol;
  transportKind: BirdCoderEngineTransportKind;
  status: BirdCoderEngineAccessLaneStatus;
  enabledByDefault: boolean;
  hostModes: readonly BirdCoderHostMode[];
  description: string;
}

export interface BirdCoderEngineAccessPlan {
  primaryLaneId: string;
  fallbackLaneIds: readonly string[];
  lanes: readonly BirdCoderEngineAccessLane[];
}

export interface BirdCoderEngineOfficialEntry {
  packageName: string;
  packageVersion?: string;
  sdkPath?: string | null;
  cliPackageName?: string | null;
  sourceMirrorPath?: string | null;
  supplementalLanes?: readonly string[];
}

export interface BirdCoderEngineOfficialIntegration {
  integrationClass: BirdCoderEngineIntegrationClass;
  runtimeMode: BirdCoderEngineRuntimeMode;
  officialEntry: BirdCoderEngineOfficialEntry;
  notes?: string;
}

export interface BirdCoderEngineCapabilityMatrix {
  chat: boolean;
  streaming: boolean;
  structuredOutput: boolean;
  toolCalls: boolean;
  planning: boolean;
  patchArtifacts: boolean;
  commandArtifacts: boolean;
  todoArtifacts: boolean;
  ptyArtifacts: boolean;
  previewArtifacts: boolean;
  testArtifacts: boolean;
  approvalCheckpoints: boolean;
  sessionResume: boolean;
  remoteBridge: boolean;
  mcp: boolean;
}

export interface BirdCoderEngineDescriptor extends BirdCoderEngineCatalogEntitySummary {
  engineKey: BirdCoderCodeEngineKey;
  displayName: string;
  vendor: string;
  installationKind: BirdCoderEngineInstallationKind;
  defaultModelId: string;
  homepage?: string;
  supportedHostModes: readonly BirdCoderHostMode[];
  transportKinds: readonly BirdCoderEngineTransportKind[];
  capabilityMatrix: BirdCoderEngineCapabilityMatrix;
  status: BirdCoderEngineAvailabilityStatus;
  accessPlan?: BirdCoderEngineAccessPlan;
  officialIntegration?: BirdCoderEngineOfficialIntegration;
}

export interface BirdCoderModelCatalogEntry extends BirdCoderEngineCatalogEntitySummary {
  engineKey: BirdCoderCodeEngineKey;
  modelId: string;
  displayName: string;
  providerId?: string;
  status: BirdCoderEngineAvailabilityStatus;
  defaultForEngine: boolean;
  transportKinds: readonly BirdCoderEngineTransportKind[];
  capabilityMatrix: Partial<BirdCoderEngineCapabilityMatrix>;
}

export interface BirdCoderEngineBindingSummary extends BirdCoderEngineCatalogEntitySummary {
  scopeType: 'global' | 'workspace' | 'project';
  scopeId: string;
  engineKey: BirdCoderCodeEngineKey;
  modelId: string;
  hostModes?: readonly BirdCoderHostMode[];
}
