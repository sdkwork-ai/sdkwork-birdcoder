import type { BirdCoderProjectPublishResult } from './bird-coder-project-publish-result';

export interface BirdCoderProjectPublishResultEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
