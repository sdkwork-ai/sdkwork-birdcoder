import type { BirdCoderHostMode } from './coding-session.ts';

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

export interface BirdCoderEngineDescriptor {
  engineKey: BirdCoderCodeEngineKey;
  displayName: string;
  vendor: string;
  installationKind: BirdCoderEngineInstallationKind;
  defaultModelId?: string;
  homepage?: string;
  supportedHostModes: readonly BirdCoderHostMode[];
  transportKinds: readonly BirdCoderEngineTransportKind[];
  capabilityMatrix: BirdCoderEngineCapabilityMatrix;
}

export interface BirdCoderModelCatalogEntry {
  engineKey: BirdCoderCodeEngineKey;
  modelId: string;
  displayName: string;
  providerId?: string;
  status: 'active' | 'preview' | 'deprecated' | 'disabled';
  defaultForEngine: boolean;
  transportKinds: readonly BirdCoderEngineTransportKind[];
  capabilityMatrix: Partial<BirdCoderEngineCapabilityMatrix>;
}

export interface BirdCoderEngineBindingSummary {
  id: string;
  scopeType: 'global' | 'workspace' | 'project';
  scopeId: string;
  engineKey: BirdCoderCodeEngineKey;
  modelId?: string;
  hostModes?: readonly BirdCoderHostMode[];
}
