import type { BirdCoderSkillInstallationSummary } from './bird-coder-skill-installation-summary';

export interface BirdCoderSkillInstallationSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
