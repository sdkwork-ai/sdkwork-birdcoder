import type { BirdCoderSkillCatalogEntrySummary } from './bird-coder-skill-catalog-entry-summary';

export interface BirdCoderSkillPackageSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  author?: string;
  versionId: string;
  versionLabel: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  installCount?: string;
  longDescription?: string;
  sourceUri?: string;
  installed: boolean;
  skills: BirdCoderSkillCatalogEntrySummary[];
}
