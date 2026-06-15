export interface BirdCoderTeamMemberSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  teamId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'invited' | 'active' | 'suspended' | 'removed';
  createdByUserId?: string;
  grantedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}
