export interface BirdCoderProjectRuntimeLocationPreference {
  id: string;
  projectId: string;
  subjectUserId: string;
  capability: 'terminal' | 'git' | 'build' | 'file_system';
  runtimeLocationId: string;
  /** Optimistic concurrency version used with the If-Match request header. */
  version: string;
  createdAt: string;
  updatedAt: string;
}
