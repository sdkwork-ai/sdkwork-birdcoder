export interface BirdCoderCodingSessionArtifact {
  id: string;
  codingSessionId: string;
  turnId?: string;
  kind: 'diff' | 'patch' | 'file' | 'command-log' | 'todo-list' | 'pty-transcript' | 'structured-output' | 'build-evidence' | 'preview-evidence' | 'simulator-evidence' | 'test-evidence' | 'release-evidence' | 'diagnostic-bundle';
  status?: 'draft' | 'sealed' | 'archived';
  title: string;
  blobRef?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
