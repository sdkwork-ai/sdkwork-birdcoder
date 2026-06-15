export interface BirdCoderAppTemplateSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  author?: string;
  versionId: string;
  versionLabel: string;
  presetKey: string;
  /** Known values include community, saas, and mine. */
  category: string;
  tags: string[];
  targetProfiles: string[];
  downloads?: number;
  stars?: number;
  /** Known values include active and archived. */
  status: string;
}
