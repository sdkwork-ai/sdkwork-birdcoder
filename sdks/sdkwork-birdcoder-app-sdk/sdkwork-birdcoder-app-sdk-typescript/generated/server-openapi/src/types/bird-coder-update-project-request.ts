export interface BirdCoderUpdateProjectRequest {
  name?: string | null;
  description?: string | null;
  code?: string | null;
  projectKind?: string | null;
  /** Stable sdkwork-agents project identifier. */
  defaultAgentProjectId?: string | null;
  status?: 'active' | 'archived' | null;
}
