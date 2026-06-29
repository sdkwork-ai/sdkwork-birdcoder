import type { BirdCoderDeletedResourceResult } from './bird-coder-deleted-resource-result';

export interface BirdCoderDeletedResourceEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
