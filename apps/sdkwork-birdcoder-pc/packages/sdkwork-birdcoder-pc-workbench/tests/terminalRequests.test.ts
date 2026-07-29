import { describe, expect, it } from 'vitest';

import {
  areTerminalCommandRequestsEqual,
  buildDefaultTerminalCommandRequest,
  type TerminalCommandRequest,
} from '../src/terminal/requests.ts';

describe('terminal request target context', () => {
  it('normalizes the target Agent, project, Session, and runtime location', () => {
    expect(buildDefaultTerminalCommandRequest({
      agentId: ' agent.intelligence.codex ',
      agentSessionId: ' session-1 ',
      projectId: ' project-1 ',
      runtimeLocationId: ' runtime-1 ',
      surface: 'project',
    })).toMatchObject({
      agentId: 'agent.intelligence.codex',
      agentSessionId: 'session-1',
      projectId: 'project-1',
      runtimeLocationId: 'runtime-1',
      surface: 'project',
    });
  });

  it('treats a different target session as a different request', () => {
    const request: TerminalCommandRequest = {
      agentId: 'agent.intelligence.codex',
      agentSessionId: 'session-1',
      command: 'codex resume provider-session-1',
      projectId: 'project-1',
      runtimeLocationId: 'runtime-1',
      surface: 'project',
      timestamp: 1,
    };

    expect(areTerminalCommandRequestsEqual(request, {
      ...request,
      agentSessionId: 'session-2',
    })).toBe(false);
    expect(areTerminalCommandRequestsEqual(request, {
      ...request,
      agentId: 'agent.intelligence.opencode',
    })).toBe(false);
    expect(areTerminalCommandRequestsEqual(request, { ...request })).toBe(true);
  });
});
