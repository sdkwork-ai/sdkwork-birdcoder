import type { BirdCoderCodeEngineModelConfigSyncResult } from './bird-coder-code-engine-model-config-sync-result';

export interface BirdCoderCodeEngineModelConfigSyncResultEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
