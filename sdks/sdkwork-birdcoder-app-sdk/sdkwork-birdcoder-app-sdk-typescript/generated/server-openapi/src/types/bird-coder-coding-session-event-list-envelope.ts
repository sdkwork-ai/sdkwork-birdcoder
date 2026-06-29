import type { BirdCoderCodingSessionEvent } from './bird-coder-coding-session-event';
import type { PageInfo } from './page-info';

export interface BirdCoderCodingSessionEventListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
