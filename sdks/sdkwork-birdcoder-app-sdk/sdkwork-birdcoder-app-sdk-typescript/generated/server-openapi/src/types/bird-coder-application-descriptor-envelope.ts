import type { BirdCoderApplicationDescriptor } from './bird-coder-application-descriptor';

export interface BirdCoderApplicationDescriptorEnvelope {
  code: 0;
  data: unknown & { item: BirdCoderApplicationDescriptor; };
  /** Server-owned request correlation id. */
  traceId: string;
}
