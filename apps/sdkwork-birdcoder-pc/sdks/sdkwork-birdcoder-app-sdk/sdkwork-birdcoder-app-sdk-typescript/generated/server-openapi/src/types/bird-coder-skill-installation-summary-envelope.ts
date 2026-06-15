import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderSkillInstallationSummary } from './bird-coder-skill-installation-summary';

export interface BirdCoderSkillInstallationSummaryEnvelope {
  data: BirdCoderSkillInstallationSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
