export interface BirdCoderNativeSessionAttributes {
  schemaVersion: number;
  sessionTreeId?: string;
  parentSessionId?: string;
  forkedFromSessionId?: string;
  title?: string;
  preview?: string;
  source?: string;
  providerVersion?: string;
  modelProvider?: string;
  projectId?: string;
  cwd?: string;
  gitBranch?: string;
  gitCommit?: string;
  gitRepositoryUrl?: string;
  agentName?: string;
  agentRole?: string;
  isEphemeral: boolean;
  isSidechain: boolean;
  metadata: Record<string, unknown>;
}
