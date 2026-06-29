import type { BirdCoderIamOAuthAuthorizationSummary } from './bird-coder-iam-oauth-authorization-summary';

export interface BirdCoderIamOAuthAuthorizationEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
