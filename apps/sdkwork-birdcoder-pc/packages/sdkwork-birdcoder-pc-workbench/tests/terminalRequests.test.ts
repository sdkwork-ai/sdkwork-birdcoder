import { describe, expect, it } from 'vitest';

import {
  areTerminalCommandRequestsEqual,
  buildDefaultTerminalCommandRequest,
  type TerminalCommandRequest,
} from '../src/terminal/requests.ts';

describe('terminal request target context', () => {
  it('normalizes the target project, session, and runtime location', () => {
    expect(buildDefaultTerminalCommandRequest({
      agentSessionId: ' session-1 ',
      projectId: ' project-1 ',
      runtimeLocationId: ' runtime-1 ',
      surface: 'project',
    })).toMatchObject({
      agentSessionId: 'session-1',
      projectId: 'project-1',
      runtimeLocationId: 'runtime-1',
      surface: 'project',
    });
  });

  it('treats a different target session as a different request', () => {
    const request: TerminalCommandRequest = {
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
    expect(areTerminalCommandRequestsEqual(request, { ...request })).toBe(true);
  });
});
