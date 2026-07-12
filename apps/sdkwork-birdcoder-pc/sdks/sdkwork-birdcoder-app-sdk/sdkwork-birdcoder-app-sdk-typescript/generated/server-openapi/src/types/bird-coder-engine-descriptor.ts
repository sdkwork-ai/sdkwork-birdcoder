import type { BirdCoderEngineAccessPlan } from './bird-coder-engine-access-plan';
import type { BirdCoderEngineCapabilityMatrix } from './bird-coder-engine-capability-matrix';
import type { BirdCoderEngineOfficialIntegration } from './bird-coder-engine-official-integration';

export interface BirdCoderEngineDescriptor {
  id: string;
  uuid: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  engineKey: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  displayName: string;
  vendor: string;
  installationKind: 'external-cli';
  defaultModelId: string;
  homepage?: string;
  supportedHostModes: ('web' | 'desktop' | 'server')[];
  transportKinds: ('cli-jsonl' | 'sdk-stream' | 'remote-control-http' | 'openapi-http')[];
  capabilityMatrix: BirdCoderEngineCapabilityMatrix;
  status: 'active' | 'preview' | 'deprecated' | 'disabled';
  accessPlan?: BirdCoderEngineAccessPlan;
  officialIntegration?: BirdCoderEngineOfficialIntegration;
}
