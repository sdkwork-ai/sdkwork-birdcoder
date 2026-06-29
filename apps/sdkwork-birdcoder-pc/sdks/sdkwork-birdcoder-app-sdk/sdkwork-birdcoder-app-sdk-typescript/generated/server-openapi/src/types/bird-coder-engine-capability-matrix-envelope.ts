import type { BirdCoderEngineCapabilityMatrix } from './bird-coder-engine-capability-matrix';

export interface BirdCoderEngineCapabilityMatrixEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
