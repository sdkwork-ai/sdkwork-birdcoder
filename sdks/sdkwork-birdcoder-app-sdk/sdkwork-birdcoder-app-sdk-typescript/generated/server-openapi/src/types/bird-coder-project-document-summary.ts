export interface BirdCoderProjectDocumentSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  projectId: string;
  documentKind: 'prd' | 'architecture' | 'step' | 'release' | 'test-plan' | 'custom';
  title: string;
  slug: string;
  bodyRef?: string;
  status: 'draft' | 'active' | 'archived';
}
