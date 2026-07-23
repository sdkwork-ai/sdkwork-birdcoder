export interface BirdCoderUpdateWorkspaceRequest {
  name?: string | null;
  description?: string | null;
  code?: string | null;
  iconUrl?: string | null;
  color?: string | null;
  visibility?: 'private' | 'organization' | null;
  status?: 'active' | 'archived' | null;
}
