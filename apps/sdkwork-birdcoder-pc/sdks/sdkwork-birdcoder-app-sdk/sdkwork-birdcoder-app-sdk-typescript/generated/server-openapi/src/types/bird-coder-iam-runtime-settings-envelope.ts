import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamRuntimeSettingsSummary } from './bird-coder-iam-runtime-settings-summary';

export interface BirdCoderIamRuntimeSettingsEnvelope {
  data: BirdCoderIamRuntimeSettingsSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
