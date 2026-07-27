export interface AgentSessionTerminalResumeTarget {
  engineId?: string | null;
  providerSessionId?: string | null;
  providerId?: string | null;
}

export type AgentSessionTerminalResumeFailureReason =
  | 'invalid-provider-session-id'
  | 'unsupported-provider';

export type AgentSessionTerminalResumeResolution =
  | {
      command: string;
      providerKey: string;
      providerLabel: string;
      status: 'ready';
    }
  | {
      reason: AgentSessionTerminalResumeFailureReason;
      status: 'unsupported';
    };

interface AgentSessionTerminalResumeProvider {
  buildCommand: (providerSessionId: string) => string;
  engineKeys: ReadonlySet<string>;
  key: string;
  label: string;
  providerKeys: ReadonlySet<string>;
}

const SAFE_PROVIDER_SESSION_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,255}$/iu;

const AGENT_SESSION_TERMINAL_RESUME_PROVIDERS: readonly AgentSessionTerminalResumeProvider[] = [
  {
    key: 'codex',
    label: 'Codex',
    engineKeys: new Set(['codex']),
    providerKeys: new Set(['codex', 'openai-codex']),
    buildCommand: (providerSessionId) => `codex resume ${providerSessionId}`,
  },
  {
    key: 'claude-code',
    label: 'Claude Code',
    engineKeys: new Set(['claude', 'claude-code']),
    providerKeys: new Set(['anthropic', 'claude', 'claude-code']),
    buildCommand: (providerSessionId) => `claude --resume ${providerSessionId}`,
  },
  {
    key: 'opencode',
    label: 'OpenCode',
    engineKeys: new Set(['open-code', 'opencode']),
    providerKeys: new Set(['open-code', 'opencode']),
    buildCommand: (providerSessionId) => `opencode --session ${providerSessionId}`,
  },
] as const;

function normalizeProviderKey(value: string | null | undefined): string {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/^provider[.:/-]/u, '')
    .replace(/[_.\s]+/gu, '-') ?? '';
}

function findAgentSessionTerminalResumeProvider(
  target: AgentSessionTerminalResumeTarget,
): AgentSessionTerminalResumeProvider | null {
  const engineKey = normalizeProviderKey(target.engineId);
  const providerKey = normalizeProviderKey(target.providerId);

  return AGENT_SESSION_TERMINAL_RESUME_PROVIDERS.find((provider) => (
    (engineKey && provider.engineKeys.has(engineKey))
    || (providerKey && provider.providerKeys.has(providerKey))
  )) ?? null;
}

export function resolveAgentSessionTerminalResume(
  target: AgentSessionTerminalResumeTarget,
): AgentSessionTerminalResumeResolution {
  const providerSessionId = target.providerSessionId?.trim() ?? '';
  if (!SAFE_PROVIDER_SESSION_ID_PATTERN.test(providerSessionId)) {
    return {
      reason: 'invalid-provider-session-id',
      status: 'unsupported',
    };
  }

  const provider = findAgentSessionTerminalResumeProvider(target);
  if (!provider) {
    return {
      reason: 'unsupported-provider',
      status: 'unsupported',
    };
  }

  return {
    command: provider.buildCommand(providerSessionId),
    providerKey: provider.key,
    providerLabel: provider.label,
    status: 'ready',
  };
}
