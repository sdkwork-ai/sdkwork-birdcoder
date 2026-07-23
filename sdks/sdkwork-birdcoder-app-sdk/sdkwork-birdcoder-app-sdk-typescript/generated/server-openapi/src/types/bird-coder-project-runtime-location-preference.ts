export interface BirdCoderProjectRuntimeLocationPreference {
  id: string;
  projectId: string;
  subjectUserId: string;
  capability: 'terminal' | 'git' | 'build' | 'filesystem';
  runtimeLocationId: string;
  /** Optimistic concurrency version used with the If-Match request header. */
  version: string;
  createdAt: string;
  updatedAt: string;
}
