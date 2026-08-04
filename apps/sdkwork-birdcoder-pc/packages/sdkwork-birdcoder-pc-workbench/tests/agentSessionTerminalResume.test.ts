import { describe, expect, it } from 'vitest';

import { resolveAgentSessionTerminalResume } from '../src/terminal/agentSessionResume.ts';

describe('resolveAgentSessionTerminalResume', () => {
  it('builds the Codex native resume command from the engine identity', () => {
    expect(resolveAgentSessionTerminalResume({
      engineId: 'codex',
      providerSessionId: '019fa3a3-fa92-7801-9a30-522115ec65a9',
      providerId: 'openai',
    })).toEqual({
      command: 'codex resume 019fa3a3-fa92-7801-9a30-522115ec65a9',
      providerKey: 'codex',
      providerLabel: 'Codex',
      status: 'ready',
    });
  });

  it.each([
    {
      command: 'claude --resume 019fa3a3-fa92-7801-9a30-522115ec65a9',
      engineId: 'claude-code',
      providerId: 'anthropic',
      providerKey: 'claude-code',
      providerLabel: 'Claude Code',
    },
    {
      command: 'opencode --session ses_1234567890',
      engineId: 'opencode',
      providerId: 'opencode',
      providerKey: 'opencode',
      providerLabel: 'OpenCode',
    },
    {
      command: 'codex resume 019fa3a3-fa92-7801-9a30-522115ec65a9',
      engineId: 'codex',
      providerId: 'provider.codex',
      providerKey: 'codex',
      providerLabel: 'Codex',
    },
  ])('uses the $providerLabel provider implementation', ({
    command,
    engineId,
    providerId,
    providerKey,
    providerLabel,
  }) => {
    expect(resolveAgentSessionTerminalResume({
      engineId,
      providerSessionId: command.split(' ').at(-1),
      providerId,
    })).toEqual({
      command,
      providerKey,
      providerLabel,
      status: 'ready',
    });
  });

  it('treats a missing persisted provider session id as invalid data', () => {
    expect(resolveAgentSessionTerminalResume({ engineId: 'codex' })).toEqual({
      reason: 'invalid-provider-session-id',
      status: 'unsupported',
    });
  });

  it('rejects provider session ids that could add shell syntax', () => {
    expect(resolveAgentSessionTerminalResume({
      engineId: 'codex',
      providerSessionId: 'session-id; Remove-Item -Recurse -Force .',
    })).toEqual({
      reason: 'invalid-provider-session-id',
      status: 'unsupported',
    });
  });

  it('does not guess a resume command for an unsupported provider', () => {
    expect(resolveAgentSessionTerminalResume({
      engineId: 'gemini',
      providerSessionId: 'session-1',
      providerId: 'google',
    })).toEqual({
      reason: 'unsupported-provider',
      status: 'unsupported',
    });
  });
});
