export interface BirdCoderUpdateProjectRequest {
  description?: string;
  name?: string;
  status?: 'active' | 'archived';
}
