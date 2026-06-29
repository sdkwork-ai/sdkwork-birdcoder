import type { BirdCoderCodingSessionArtifact } from './bird-coder-coding-session-artifact';
import type { PageInfo } from './page-info';

export interface BirdCoderCodingSessionArtifactListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
