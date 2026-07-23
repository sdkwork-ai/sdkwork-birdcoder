import type { BirdCoderProjectRuntimeLocationPreference } from './bird-coder-project-runtime-location-preference';

export interface BirdCoderProjectRuntimeLocationPreferenceEnvelope {
  code: 0;
  data: unknown & { item: BirdCoderProjectRuntimeLocationPreference; };
  /** Server-owned request correlation id. */
  traceId: string;
}
