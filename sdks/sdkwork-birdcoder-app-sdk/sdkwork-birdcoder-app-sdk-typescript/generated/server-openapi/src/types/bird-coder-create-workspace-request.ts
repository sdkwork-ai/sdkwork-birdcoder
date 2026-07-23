export interface BirdCoderCreateWorkspaceRequest {
  name: string;
  description?: string | null;
  code?: string | null;
  iconUrl?: string | null;
  color?: string | null;
  visibility?: 'private' | 'organization' | null;
}
