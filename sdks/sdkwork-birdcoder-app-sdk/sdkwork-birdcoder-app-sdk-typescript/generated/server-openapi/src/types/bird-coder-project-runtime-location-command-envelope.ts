import type { BirdCoderProjectRuntimeLocationCommandAccepted } from './bird-coder-project-runtime-location-command-accepted';

export interface BirdCoderProjectRuntimeLocationCommandEnvelope {
  code: 0;
  data: unknown & BirdCoderProjectRuntimeLocationCommandAccepted;
  /** Server-owned request correlation id. */
  traceId: string;
}
