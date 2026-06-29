import type { BirdCoderIamRuntimeSettingsSummary } from './bird-coder-iam-runtime-settings-summary';

export interface BirdCoderIamRuntimeSettingsEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
