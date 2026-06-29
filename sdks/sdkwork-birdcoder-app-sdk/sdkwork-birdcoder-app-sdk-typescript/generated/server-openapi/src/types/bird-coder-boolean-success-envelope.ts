import type { BirdCoderBooleanSuccessResult } from './bird-coder-boolean-success-result';

export interface BirdCoderBooleanSuccessEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
