import { describe, expect, it } from 'vitest';

import { resolveCodeTranscriptSessionScopeKey } from '../src/pages/codeTranscriptSessionScope.ts';

describe('Code transcript session scope', () => {
  it('depends only on stable project and session identity', () => {
    const initialSession = {
      agentId: null,
      projectId: 'project.one',
      providerId: null,
      sessionId: 'session.one',
    };
    const enrichedSession = {
      ...initialSession,
      agentId: 'agent.code-engine.codex',
      providerId: 'provider.openai',
    };

    const initialScopeKey = resolveCodeTranscriptSessionScopeKey(
      initialSession.projectId,
      initialSession.sessionId,
    );
    const enrichedScopeKey = resolveCodeTranscriptSessionScopeKey(
      enrichedSession.projectId,
      enrichedSession.sessionId,
    );

    expect(initialScopeKey).toBe('project.one\u0001session.one');
    expect(enrichedScopeKey).toBe(initialScopeKey);
  });

  it('uses the session identity until a project is selected', () => {
    expect(resolveCodeTranscriptSessionScopeKey('', ' session.one ')).toBe('session.one');
    expect(resolveCodeTranscriptSessionScopeKey('project.one', null)).toBeUndefined();
  });
});
