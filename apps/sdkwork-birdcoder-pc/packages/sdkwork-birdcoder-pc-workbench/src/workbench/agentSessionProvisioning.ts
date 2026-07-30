interface CreatedAgentSession {
  sessionId: string;
}

export class AgentSessionExecutionTargetUnavailableError extends Error {
  readonly code: 'cloud_execution_unavailable';
  readonly executionTarget: 'CLOUD';

  constructor() {
    super(
      'Cloud execution is unavailable until Agents can prove a ready Sandbox placement.',
    );
    this.name = 'AgentSessionExecutionTargetUnavailableError';
    this.code = 'cloud_execution_unavailable';
    this.executionTarget = 'CLOUD';
  }
}

export class AgentSessionRuntimeLocationUnavailableError extends Error {
  readonly code: 'local_runtime_location_unavailable';
  readonly executionTarget: 'LOCAL';

  constructor() {
    super(
      'Local execution requires a mounted project runtime location before the Agent Session can be created.',
    );
    this.name = 'AgentSessionRuntimeLocationUnavailableError';
    this.code = 'local_runtime_location_unavailable';
    this.executionTarget = 'LOCAL';
  }
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

export interface CreateLocallyBoundAgentSessionOptions<
  TSession extends CreatedAgentSession,
  TRuntimeBinding,
> {
  createRuntimeBinding: (
    session: TSession,
    runtimeLocationId: string,
  ) => Promise<TRuntimeBinding>;
  createSession: () => Promise<TSession>;
  deleteCreatedSession: (session: TSession) => Promise<void>;
  resolveRuntimeLocationId: () => Promise<string>;
}

export interface LocallyBoundAgentSession<TSession, TRuntimeBinding>
  extends BoundAgentSession<TSession, TRuntimeBinding> {
  runtimeLocationId: string;
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

export async function createLocallyBoundAgentSession<
  TSession extends CreatedAgentSession,
  TRuntimeBinding,
>(
  options: CreateLocallyBoundAgentSessionOptions<TSession, TRuntimeBinding>,
): Promise<LocallyBoundAgentSession<TSession, TRuntimeBinding>> {
  const runtimeLocationId = (await options.resolveRuntimeLocationId()).trim();
  if (!runtimeLocationId) {
    throw new AgentSessionRuntimeLocationUnavailableError();
  }

  const provisionedSession = await createBoundAgentSession({
    createRuntimeBinding: (session) =>
      options.createRuntimeBinding(session, runtimeLocationId),
    createSession: options.createSession,
    deleteCreatedSession: options.deleteCreatedSession,
  });

  return {
    ...provisionedSession,
    runtimeLocationId,
  };
}
