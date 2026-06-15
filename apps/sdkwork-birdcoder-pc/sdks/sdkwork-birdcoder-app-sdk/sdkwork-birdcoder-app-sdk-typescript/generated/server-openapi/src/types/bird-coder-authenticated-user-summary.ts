export interface BirdCoderAuthenticatedUserSummary {
  id: string;
  uuid: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  avatarUrl?: string;
}
