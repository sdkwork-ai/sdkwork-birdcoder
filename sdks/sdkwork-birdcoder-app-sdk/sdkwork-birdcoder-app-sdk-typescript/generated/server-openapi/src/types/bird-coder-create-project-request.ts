export interface BirdCoderCreateProjectRequest {
  workspaceId: string;
  name: string;
  description?: string | null;
  code?: string | null;
  projectKind?: string | null;
  /** Stable sdkwork-agents project identifier. */
  defaultAgentProjectId?: string | null;
}
