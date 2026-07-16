import type { BirdCoderProjectWorkspaceBinding } from './bird-coder-project-workspace-binding';

export interface BirdCoderProjectWorkspaceBindingEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
