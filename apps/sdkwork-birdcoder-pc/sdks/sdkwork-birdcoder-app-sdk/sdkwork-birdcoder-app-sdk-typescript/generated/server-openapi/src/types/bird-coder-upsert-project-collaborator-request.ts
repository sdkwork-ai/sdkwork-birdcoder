export interface BirdCoderUpsertProjectCollaboratorRequest {
  userId: string;
  role?: 'owner' | 'admin' | 'member' | 'viewer';
  status?: 'invited' | 'active' | 'suspended';
}
