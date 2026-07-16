import type { BirdCoderProjectRuntimeLocation } from './bird-coder-project-runtime-location';

export interface BirdCoderProjectRuntimeLocationEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
