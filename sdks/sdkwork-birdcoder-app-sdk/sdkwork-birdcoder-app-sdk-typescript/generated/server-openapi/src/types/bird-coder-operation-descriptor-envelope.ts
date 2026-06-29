import type { BirdCoderOperationDescriptor } from './bird-coder-operation-descriptor';

export interface BirdCoderOperationDescriptorEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
