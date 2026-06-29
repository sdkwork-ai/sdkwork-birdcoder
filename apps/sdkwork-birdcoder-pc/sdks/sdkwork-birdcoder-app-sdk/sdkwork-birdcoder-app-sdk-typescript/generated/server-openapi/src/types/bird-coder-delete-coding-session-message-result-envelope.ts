import type { BirdCoderDeleteCodingSessionMessageResult } from './bird-coder-delete-coding-session-message-result';

export interface BirdCoderDeleteCodingSessionMessageResultEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
