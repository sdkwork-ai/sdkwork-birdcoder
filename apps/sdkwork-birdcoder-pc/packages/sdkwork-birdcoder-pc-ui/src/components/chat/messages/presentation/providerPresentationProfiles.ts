export const CHAT_PROVIDER_ENGINE_IDS = [
  'codex',
  'claude-code',
  'opencode',
  'gemini',
] as const;

export type ChatProviderEngineId = (typeof CHAT_PROVIDER_ENGINE_IDS)[number];

export interface ChatProviderPresentationProfile {
  engineId: ChatProviderEngineId;
  protocolAdapterId:
    | 'claude.content-block'
    | 'codex.item'
    | 'gemini.event'
    | 'opencode.part';
  surfaceLabel: string;
  transcriptStyle: 'opencode-aligned';
}

export const CHAT_PROVIDER_PRESENTATION_PROFILES:
  readonly ChatProviderPresentationProfile[] = [
  {
    engineId: 'codex',
    protocolAdapterId: 'codex.item',
    surfaceLabel: 'Codex',
    transcriptStyle: 'opencode-aligned',
  },
  {
    engineId: 'claude-code',
    protocolAdapterId: 'claude.content-block',
    surfaceLabel: 'Claude Code',
    transcriptStyle: 'opencode-aligned',
  },
  {
    engineId: 'opencode',
    protocolAdapterId: 'opencode.part',
    surfaceLabel: 'OpenCode',
    transcriptStyle: 'opencode-aligned',
  },
  {
    engineId: 'gemini',
    protocolAdapterId: 'gemini.event',
    surfaceLabel: 'Gemini',
    transcriptStyle: 'opencode-aligned',
  },
];

export function resolveChatProviderPresentationProfile(
  engineId: string | undefined,
): ChatProviderPresentationProfile | undefined {
  return CHAT_PROVIDER_PRESENTATION_PROFILES.find(
    (profile) => profile.engineId === engineId,
  );
}
