import { describe, expect, it, vi } from 'vitest';

import {
  emitRevealAgentSession,
  subscribeRevealAgentSession,
} from '../src/events/agentSessionRevealEvents.ts';

describe('agent session reveal events', () => {
  it('normalizes the project-scoped target before notifying the workbench', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRevealAgentSession(listener);

    expect(emitRevealAgentSession({
      projectId: ' project.one ',
      sessionId: ' session.one ',
    })).toBe(true);
    expect(listener).toHaveBeenCalledWith({
      projectId: 'project.one',
      sessionId: 'session.one',
    });

    unsubscribe();
  });

  it('rejects incomplete targets and supports listener cleanup', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRevealAgentSession(listener);

    expect(emitRevealAgentSession({ projectId: '', sessionId: 'session.one' })).toBe(false);
    unsubscribe();
    expect(emitRevealAgentSession({
      projectId: 'project.one',
      sessionId: 'session.one',
    })).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
