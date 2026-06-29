import type { BirdCoderSkillPackageSummary } from './bird-coder-skill-package-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderSkillPackageSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
