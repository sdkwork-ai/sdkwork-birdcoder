import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderSkillPackageSummary } from './bird-coder-skill-package-summary';

export interface BirdCoderSkillPackageSummaryListEnvelope {
  items: BirdCoderSkillPackageSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
