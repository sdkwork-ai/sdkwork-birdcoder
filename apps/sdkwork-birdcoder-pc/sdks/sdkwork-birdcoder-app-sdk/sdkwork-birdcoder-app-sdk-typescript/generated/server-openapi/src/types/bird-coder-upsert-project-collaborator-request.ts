export interface BirdCoderUpsertProjectCollaboratorRequest {
  userId?: string;
  email?: string;
  teamId?: string;
  role?: 'owner' | 'admin' | 'member' | 'viewer';
  status?: 'invited' | 'active' | 'suspended' | 'removed';
  createdByUserId?: string;
  grantedByUserId?: string;
}
