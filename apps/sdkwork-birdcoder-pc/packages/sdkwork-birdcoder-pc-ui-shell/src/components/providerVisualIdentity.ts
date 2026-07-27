export type ProviderVisualTone =
  | 'amber'
  | 'cyan'
  | 'emerald'
  | 'indigo'
  | 'lime'
  | 'neutral'
  | 'orange'
  | 'rose'
  | 'sky';

export interface ProviderVisualIdentityInput {
  agentId?: string | null;
  engineId?: string | null;
  providerId?: string | null;
}

export interface ProviderVisualIdentity {
  abbreviation: string;
  id: string;
  label: string;
  tone: ProviderVisualTone;
}

interface KnownProviderVisualIdentity extends ProviderVisualIdentity {
  aliases: readonly string[];
}

export const PROVIDER_VISUAL_TONE_CLASS_NAMES: Readonly<
  Record<ProviderVisualTone, string>
> = {
  amber: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
  cyan: 'bg-cyan-500/15 text-cyan-300 ring-cyan-400/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  indigo: 'bg-indigo-500/15 text-indigo-300 ring-indigo-400/30',
  lime: 'bg-lime-500/15 text-lime-300 ring-lime-400/30',
  neutral: 'bg-white/5 text-gray-400 ring-white/10',
  orange: 'bg-orange-500/15 text-orange-300 ring-orange-400/30',
  rose: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
  sky: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
};

const EXECUTION_PROVIDER_VISUAL_IDENTITIES: readonly KnownProviderVisualIdentity[] = [
  {
    abbreviation: 'CX',
    aliases: ['codex', 'openai-codex'],
    id: 'codex',
    label: 'Codex',
    tone: 'emerald',
  },
  {
    abbreviation: 'CC',
    aliases: ['claude-code'],
    id: 'claude-code',
    label: 'Claude Code',
    tone: 'amber',
  },
  {
    abbreviation: 'GM',
    aliases: ['gemini-cli', 'gemini'],
    id: 'gemini',
    label: 'Gemini',
    tone: 'sky',
  },
  {
    abbreviation: 'OC',
    aliases: ['opencode', 'open-code'],
    id: 'opencode',
    label: 'OpenCode',
    tone: 'rose',
  },
];

const PROVIDER_VISUAL_IDENTITIES: Readonly<
  Record<string, Omit<ProviderVisualIdentity, 'id'>>
> = {
  'amazon-bedrock': { abbreviation: 'AB', label: 'Amazon Bedrock', tone: 'amber' },
  'azure-openai': { abbreviation: 'AO', label: 'Azure OpenAI', tone: 'indigo' },
  anthropic: { abbreviation: 'AN', label: 'Anthropic', tone: 'orange' },
  bedrock: { abbreviation: 'BR', label: 'Amazon Bedrock', tone: 'amber' },
  deepseek: { abbreviation: 'DS', label: 'DeepSeek', tone: 'indigo' },
  google: { abbreviation: 'GO', label: 'Google', tone: 'sky' },
  groq: { abbreviation: 'GQ', label: 'Groq', tone: 'lime' },
  mistral: { abbreviation: 'MI', label: 'Mistral', tone: 'orange' },
  openai: { abbreviation: 'OA', label: 'OpenAI', tone: 'cyan' },
  openrouter: { abbreviation: 'OR', label: 'OpenRouter', tone: 'indigo' },
  xai: { abbreviation: 'XA', label: 'xAI', tone: 'lime' },
};

const FALLBACK_PROVIDER_VISUAL_TONES: readonly ProviderVisualTone[] = [
  'cyan',
  'emerald',
  'amber',
  'sky',
  'rose',
  'indigo',
  'orange',
  'lime',
];

function normalizeProviderIdentityId(identityId?: string | null): string {
  return (identityId?.trim().toLowerCase() ?? '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function normalizeFallbackProviderId(providerId?: string | null): string {
  return normalizeProviderIdentityId(providerId).replace(/^provider-+/u, '');
}

function matchesProviderAlias(identityId: string, alias: string): boolean {
  return `-${identityId}-`.includes(`-${alias}-`);
}

function resolveExecutionProviderVisualIdentity(
  identityId?: string | null,
): ProviderVisualIdentity | null {
  const normalizedIdentityId = normalizeProviderIdentityId(identityId);
  if (!normalizedIdentityId) {
    return null;
  }

  const visualIdentity = EXECUTION_PROVIDER_VISUAL_IDENTITIES.find((candidate) =>
    candidate.aliases.some((alias) => matchesProviderAlias(normalizedIdentityId, alias)),
  );
  if (!visualIdentity) {
    return null;
  }

  return {
    abbreviation: visualIdentity.abbreviation,
    id: visualIdentity.id,
    label: visualIdentity.label,
    tone: visualIdentity.tone,
  };
}

function buildProviderAbbreviation(providerId: string): string {
  const segments = providerId.split('-').filter(Boolean);
  if (segments.length > 1) {
    return segments
      .slice(0, 2)
      .map((segment) => segment[0])
      .join('')
      .toUpperCase();
  }

  return providerId.replace(/[^a-z0-9]/giu, '').slice(0, 2).toUpperCase() || '??';
}

function buildProviderLabel(providerId: string): string {
  return providerId
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ') || 'Unknown';
}

function resolveFallbackProviderVisualTone(providerId: string): ProviderVisualTone {
  if (!providerId) {
    return 'neutral';
  }

  let hash = 0;
  for (const character of providerId) {
    hash = ((hash * 31) + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return FALLBACK_PROVIDER_VISUAL_TONES[
    hash % FALLBACK_PROVIDER_VISUAL_TONES.length
  ] ?? 'neutral';
}

export function resolveProviderVisualIdentity(
  identityOrProviderId?: ProviderVisualIdentityInput | string | null,
): ProviderVisualIdentity {
  const identity: ProviderVisualIdentityInput = typeof identityOrProviderId === 'string'
    ? { providerId: identityOrProviderId }
    : identityOrProviderId ?? {};
  const executionProviderVisualIdentity =
    resolveExecutionProviderVisualIdentity(identity.engineId)
    ?? resolveExecutionProviderVisualIdentity(identity.agentId)
    ?? resolveExecutionProviderVisualIdentity(identity.providerId);
  if (executionProviderVisualIdentity) {
    return executionProviderVisualIdentity;
  }

  const fallbackProviderId = identity.providerId ?? identity.engineId ?? identity.agentId;
  const id = normalizeFallbackProviderId(fallbackProviderId);
  const knownVisualIdentity = PROVIDER_VISUAL_IDENTITIES[id];

  return {
    abbreviation: knownVisualIdentity?.abbreviation ?? buildProviderAbbreviation(id),
    id,
    label: knownVisualIdentity?.label ?? buildProviderLabel(id),
    tone: knownVisualIdentity?.tone ?? resolveFallbackProviderVisualTone(id),
  };
}

export function resolveProviderVisualToneClassName(tone: ProviderVisualTone): string {
  return PROVIDER_VISUAL_TONE_CLASS_NAMES[tone];
}
