import type { BirdCoderCodingSessionCheckpoint } from './bird-coder-coding-session-checkpoint';
import type { PageInfo } from './page-info';

export interface BirdCoderCodingSessionCheckpointListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
