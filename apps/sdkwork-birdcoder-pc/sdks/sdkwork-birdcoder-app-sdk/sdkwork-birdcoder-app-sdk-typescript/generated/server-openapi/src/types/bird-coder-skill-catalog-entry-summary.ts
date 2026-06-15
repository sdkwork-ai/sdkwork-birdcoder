export interface BirdCoderSkillCatalogEntrySummary {
  id: string;
  packageId: string;
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
  tags: string[];
  license?: string;
  repositoryUrl?: string;
  lastUpdated?: string;
  readme?: string;
  capabilityKeys: string[];
  installed: boolean;
}
