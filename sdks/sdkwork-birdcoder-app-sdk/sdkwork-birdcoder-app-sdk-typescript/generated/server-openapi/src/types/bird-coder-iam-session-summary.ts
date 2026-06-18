import type { BirdCoderAuthenticatedUserSummary } from './bird-coder-authenticated-user-summary';

export interface BirdCoderIamSessionSummary {
  accessToken: string;
  authToken: string;
  context?: Record<string, unknown>;
  expiresAt?: string;
  refreshToken?: string;
  sessionId?: string;
  user?: BirdCoderAuthenticatedUserSummary;
}
