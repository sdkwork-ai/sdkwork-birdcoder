import type { BirdCoderEngineDescriptor } from './bird-coder-engine-descriptor';
import type { PageInfo } from './page-info';

export interface BirdCoderEngineDescriptorListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
