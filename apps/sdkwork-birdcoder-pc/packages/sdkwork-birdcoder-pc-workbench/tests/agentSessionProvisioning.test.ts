import { describe, expect, it, vi } from 'vitest';

import {
  AgentSessionExecutionTargetUnavailableError,
  AgentSessionRuntimeLocationUnavailableError,
  AgentSessionRuntimeBindingProvisioningError,
  createBoundAgentSession,
  createLocallyBoundAgentSession,
} from '../src/workbench/agentSessionProvisioning';

describe('AgentSessionExecutionTargetUnavailableError', () => {
  it('exposes a typed fail-closed cloud placement failure', () => {
    expect(new AgentSessionExecutionTargetUnavailableError()).toMatchObject({
      code: 'cloud_execution_unavailable',
      executionTarget: 'CLOUD',
      name: 'AgentSessionExecutionTargetUnavailableError',
    });
  });
});

describe('createBoundAgentSession', () => {
  it('returns the Session and Runtime Binding only after both are created', async () => {
    const session = { sessionId: 'session.bound' };
    const runtimeBinding = { runtimeBindingId: 'binding.bound' };
    const createRuntimeBinding = vi.fn(async () => runtimeBinding);
    const deleteCreatedSession = vi.fn(async () => undefined);

    await expect(createBoundAgentSession({
      createRuntimeBinding,
      createSession: vi.fn(async () => session),
      deleteCreatedSession,
    })).resolves.toEqual({ runtimeBinding, session });

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

describe('createLocallyBoundAgentSession', () => {
  it('resolves a mounted runtime location before creating the Session', async () => {
    const callOrder: string[] = [];
    const session = { sessionId: 'session.local' };
    const runtimeBinding = { runtimeBindingId: 'binding.local' };

    await expect(createLocallyBoundAgentSession({
      resolveRuntimeLocationId: vi.fn(async () => {
        callOrder.push('resolve-runtime-location');
        return ' runtime-location.local ';
      }),
      createSession: vi.fn(async () => {
        callOrder.push('create-session');
        return session;
      }),
      createRuntimeBinding: vi.fn(async (createdSession, runtimeLocationId) => {
        callOrder.push(`create-runtime-binding:${runtimeLocationId}`);
        expect(createdSession).toBe(session);
        return runtimeBinding;
      }),
      deleteCreatedSession: vi.fn(async () => undefined),
    })).resolves.toEqual({
      runtimeBinding,
      runtimeLocationId: 'runtime-location.local',
      session,
    });

    expect(callOrder).toEqual([
      'resolve-runtime-location',
      'create-session',
      'create-runtime-binding:runtime-location.local',
    ]);
  });

  it('does not create a Session when the runtime location cannot be resolved', async () => {
    const runtimeLocationError = new Error('Project mount selection was cancelled.');
    const createSession = vi.fn(async () => ({ sessionId: 'session.unexpected' }));
    const createRuntimeBinding = vi.fn(async () => ({
      runtimeBindingId: 'binding.unexpected',
    }));
    const deleteCreatedSession = vi.fn(async () => undefined);

    await expect(createLocallyBoundAgentSession({
      resolveRuntimeLocationId: vi.fn(async () => {
        throw runtimeLocationError;
      }),
      createSession,
      createRuntimeBinding,
      deleteCreatedSession,
    })).rejects.toBe(runtimeLocationError);

    expect(createSession).not.toHaveBeenCalled();
    expect(createRuntimeBinding).not.toHaveBeenCalled();
    expect(deleteCreatedSession).not.toHaveBeenCalled();
  });

  it('rejects an empty runtime location without creating a Session', async () => {
    const createSession = vi.fn(async () => ({ sessionId: 'session.unexpected' }));
    const createRuntimeBinding = vi.fn(async () => ({
      runtimeBindingId: 'binding.unexpected',
    }));
    const deleteCreatedSession = vi.fn(async () => undefined);

    await expect(createLocallyBoundAgentSession({
      resolveRuntimeLocationId: vi.fn(async () => '  '),
      createSession,
      createRuntimeBinding,
      deleteCreatedSession,
    })).rejects.toBeInstanceOf(AgentSessionRuntimeLocationUnavailableError);

    expect(createSession).not.toHaveBeenCalled();
    expect(createRuntimeBinding).not.toHaveBeenCalled();
    expect(deleteCreatedSession).not.toHaveBeenCalled();
  });
});
