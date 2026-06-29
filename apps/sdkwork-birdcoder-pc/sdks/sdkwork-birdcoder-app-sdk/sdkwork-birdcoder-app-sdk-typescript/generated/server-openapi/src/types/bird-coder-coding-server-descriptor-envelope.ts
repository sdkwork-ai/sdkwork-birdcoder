import type { BirdCoderCodingServerDescriptor } from './bird-coder-coding-server-descriptor';

export interface BirdCoderCodingServerDescriptorEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
