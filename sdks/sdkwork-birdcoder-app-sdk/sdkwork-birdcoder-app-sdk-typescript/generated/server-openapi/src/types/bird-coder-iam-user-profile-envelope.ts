import type { BirdCoderIamUserProfileSummary } from './bird-coder-iam-user-profile-summary';

export interface BirdCoderIamUserProfileEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
