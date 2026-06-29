import type { BirdCoderEditCodingSessionMessageResult } from './bird-coder-edit-coding-session-message-result';

export interface BirdCoderEditCodingSessionMessageResultEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
