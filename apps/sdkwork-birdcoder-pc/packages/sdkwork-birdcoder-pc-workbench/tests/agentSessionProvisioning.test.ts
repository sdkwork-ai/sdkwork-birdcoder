import { describe, expect, it, vi } from 'vitest';

import {
  AgentSessionRuntimeBindingProvisioningError,
  createBoundAgentSession,
} from '../src/workbench/agentSessionProvisioning';

describe('createBoundAgentSession', () => {
  it('returns the Session only after its Runtime Binding is created', async () => {
    const session = { sessionId: 'session.bound' };
    const createRuntimeBinding = vi.fn(async () => ({ runtimeBindingId: 'binding.bound' }));
    const deleteCreatedSession = vi.fn(async () => undefined);

    await expect(createBoundAgentSession({
      createRuntimeBinding,
      createSession: vi.fn(async () => session),
      deleteCreatedSession,
    })).resolves.toBe(session);

    expect(createRuntimeBinding).toHaveBeenCalledWith(session);
    expect(deleteCreatedSession).not.toHaveBeenCalled();
  });

  it('does not run compensation when Session creation itself fails', async () => {
    const creationError = new Error('Session creation failed.');
    const createRuntimeBinding = vi.fn(async () => undefined);
    const deleteCreatedSession = vi.fn(async () => undefined);

    await expect(createBoundAgentSession({
      createRuntimeBinding,
      createSession: vi.fn(async () => {
        throw creationError;
      }),
      deleteCreatedSession,
    })).rejects.toBe(creationError);

    expect(createRuntimeBinding).not.toHaveBeenCalled();
    expect(deleteCreatedSession).not.toHaveBeenCalled();
  });

  it('deletes the newly created Session when Runtime Binding creation fails', async () => {
    const session = { sessionId: 'session.binding-failed' };
    const runtimeBindingError = new Error('Runtime Binding creation failed.');
    const deleteCreatedSession = vi.fn(async () => undefined);

    await expect(createBoundAgentSession({
      createRuntimeBinding: vi.fn(async () => {
        throw runtimeBindingError;
      }),
      createSession: vi.fn(async () => session),
      deleteCreatedSession,
    })).rejects.toMatchObject({
      cleanupError: null,
      message: runtimeBindingError.message,
      name: 'AgentSessionRuntimeBindingProvisioningError',
      runtimeBindingError,
      sessionId: session.sessionId,
    });

    expect(deleteCreatedSession).toHaveBeenCalledWith(session);
  });

  it('preserves cleanup diagnostics when deleting the incomplete Session also fails', async () => {
    const cleanupError = new Error('Session cleanup failed.');
    const runtimeBindingError = new Error('Runtime Binding creation failed.');

    try {
      await createBoundAgentSession({
        createRuntimeBinding: vi.fn(async () => {
          throw runtimeBindingError;
        }),
        createSession: vi.fn(async () => ({ sessionId: 'session.cleanup-failed' })),
        deleteCreatedSession: vi.fn(async () => {
          throw cleanupError;
        }),
      });
      throw new Error('Expected Agent Session provisioning to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(AgentSessionRuntimeBindingProvisioningError);
      expect(error).toMatchObject({
        cleanupError,
        runtimeBindingError,
        sessionId: 'session.cleanup-failed',
      });
    }
  });
});
