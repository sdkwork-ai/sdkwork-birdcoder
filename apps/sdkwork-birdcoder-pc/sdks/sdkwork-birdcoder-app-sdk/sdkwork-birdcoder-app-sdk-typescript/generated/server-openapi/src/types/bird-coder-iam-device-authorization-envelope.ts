import type { BirdCoderIamDeviceAuthorizationSummary } from './bird-coder-iam-device-authorization-summary';

export interface BirdCoderIamDeviceAuthorizationEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
