import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderOperationDescriptor } from './bird-coder-operation-descriptor';

export interface BirdCoderOperationDescriptorEnvelope {
  data: BirdCoderOperationDescriptor;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
