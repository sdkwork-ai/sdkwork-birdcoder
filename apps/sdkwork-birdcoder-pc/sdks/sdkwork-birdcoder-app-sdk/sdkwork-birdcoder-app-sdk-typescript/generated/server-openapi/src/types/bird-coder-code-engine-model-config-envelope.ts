import type { BirdCoderCodeEngineModelConfig } from './bird-coder-code-engine-model-config';

export interface BirdCoderCodeEngineModelConfigEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
