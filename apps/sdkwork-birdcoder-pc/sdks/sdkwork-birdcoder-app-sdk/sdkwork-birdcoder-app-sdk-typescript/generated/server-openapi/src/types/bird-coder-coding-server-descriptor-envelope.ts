import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderCodingServerDescriptor } from './bird-coder-coding-server-descriptor';

export interface BirdCoderCodingServerDescriptorEnvelope {
  data: BirdCoderCodingServerDescriptor;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
