interface CreatedAgentSession {
  sessionId: string;
}

export interface CreateBoundAgentSessionOptions<
  TSession extends CreatedAgentSession,
  TRuntimeBinding,
> {
  createRuntimeBinding: (session: TSession) => Promise<TRuntimeBinding>;
  createSession: () => Promise<TSession>;
  deleteCreatedSession: (session: TSession) => Promise<void>;
}

export interface BoundAgentSession<TSession, TRuntimeBinding> {
  runtimeBinding: TRuntimeBinding;
  session: TSession;
}

export class AgentSessionRuntimeBindingProvisioningError extends Error {
  readonly cleanupError: unknown;
  readonly runtimeBindingError: unknown;
  readonly sessionId: string;

  constructor(
    sessionId: string,
    runtimeBindingError: unknown,
    cleanupError: unknown = null,
  ) {
    const message = runtimeBindingError instanceof Error && runtimeBindingError.message.trim()
      ? runtimeBindingError.message.trim()
      : 'Failed to create the Agent Session runtime binding.';
    super(message);
    this.name = 'AgentSessionRuntimeBindingProvisioningError';
    this.sessionId = sessionId;
    this.runtimeBindingError = runtimeBindingError;
    this.cleanupError = cleanupError;
  }
}

export async function createBoundAgentSession<
  TSession extends CreatedAgentSession,
  TRuntimeBinding,
>(
  options: CreateBoundAgentSessionOptions<TSession, TRuntimeBinding>,
): Promise<BoundAgentSession<TSession, TRuntimeBinding>> {
  const session = await options.createSession();

  try {
    const runtimeBinding = await options.createRuntimeBinding(session);
    return { runtimeBinding, session };
  } catch (runtimeBindingError) {
    let cleanupError: unknown = null;
    try {
      await options.deleteCreatedSession(session);
    } catch (error) {
      cleanupError = error;
    }

    throw new AgentSessionRuntimeBindingProvisioningError(
      session.sessionId,
      runtimeBindingError,
      cleanupError,
    );
  }
}
