import type { BirdCoderProjectRuntimeLocation } from './bird-coder-project-runtime-location';
import type { PageInfo } from './page-info';

export interface BirdCoderProjectRuntimeLocationListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
