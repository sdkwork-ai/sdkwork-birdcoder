import type { BirdCoderProjectSandboxBinding } from './bird-coder-project-sandbox-binding';

export interface BirdCoderProjectSandboxBindingEnvelope {
  code: 0;
  data: unknown & { item: BirdCoderProjectSandboxBinding; };
  /** Server-owned request correlation id. */
  traceId: string;
}
