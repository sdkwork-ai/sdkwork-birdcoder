export interface BirdCoderProjectCollaboratorSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  projectId: string;
  workspaceId: string;
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
  teamId?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'invited' | 'active' | 'suspended' | 'removed';
  createdByUserId?: string;
  grantedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}
