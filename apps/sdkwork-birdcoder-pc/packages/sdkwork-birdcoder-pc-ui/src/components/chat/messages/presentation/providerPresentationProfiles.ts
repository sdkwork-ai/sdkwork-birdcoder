import {
  AGENT_SESSION_ITEM_TOOL_PROTOCOL_ADAPTER_ID_BY_ENGINE,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type {
  AgentSessionItemToolProtocolAdapterId,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageLayout } from '../types.ts';

export const CHAT_PROVIDER_ENGINE_IDS = [
  'codex',
  'claude-code',
  'opencode',
  'gemini',
] as const;

export type ChatProviderEngineId = (typeof CHAT_PROVIDER_ENGINE_IDS)[number];

const OPENCODE_ALIGNED_ACTIVITY_PRESENTATION = Object.freeze({
  lifecycle: 'inline',
  reasoning: 'summary-disclosure',
  tools: 'compact-disclosure',
} as const);

export const OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY = Object.freeze({
  activeTail: Object.freeze({
    fallbackLabel: 'Working',
    labelKey: 'chat.providerWorking',
  } as const),
  activityPresentation: OPENCODE_ALIGNED_ACTIVITY_PRESENTATION,
  density: 'comfortable',
  providerIdentity: Object.freeze({
    main: 'hidden',
    sidebar: 'authored-markdown',
  } as const),
  transcriptStyle: 'opencode-aligned',
  tools: Object.freeze({
    context: 'grouped-disclosure',
  } as const),
} as const);

export type ChatTranscriptPresentationPolicy =
  typeof OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY;

export interface ChatProviderPresentationProfile {
  engineId: ChatProviderEngineId;
  presentation: ChatTranscriptPresentationPolicy;
  protocolAdapterId: AgentSessionItemToolProtocolAdapterId;
  surfaceLabel: string;
}

export const CHAT_PROVIDER_PRESENTATION_PROFILES:
  readonly ChatProviderPresentationProfile[] = Object.freeze([
  Object.freeze({
    engineId: 'codex',
    presentation: OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY,
    protocolAdapterId: AGENT_SESSION_ITEM_TOOL_PROTOCOL_ADAPTER_ID_BY_ENGINE.codex,
    surfaceLabel: 'Codex',
  }),
  Object.freeze({
    engineId: 'claude-code',
    presentation: OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY,
    protocolAdapterId: AGENT_SESSION_ITEM_TOOL_PROTOCOL_ADAPTER_ID_BY_ENGINE['claude-code'],
    surfaceLabel: 'Claude Code',
  }),
  Object.freeze({
    engineId: 'opencode',
    presentation: OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY,
    protocolAdapterId: AGENT_SESSION_ITEM_TOOL_PROTOCOL_ADAPTER_ID_BY_ENGINE.opencode,
    surfaceLabel: 'OpenCode',
  }),
  Object.freeze({
    engineId: 'gemini',
    presentation: OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY,
    protocolAdapterId: AGENT_SESSION_ITEM_TOOL_PROTOCOL_ADAPTER_ID_BY_ENGINE.gemini,
    surfaceLabel: 'Gemini',
  }),
]);

export function shouldShowChatProviderByline(
  profile: ChatProviderPresentationProfile,
  input: {
    hasAuthoredMarkdown: boolean;
    isAuthoredReply: boolean;
    layout: ChatMessageLayout;
  },
): boolean {
  const placement = profile.presentation.providerIdentity[input.layout];
  return placement === 'authored-markdown'
    && input.isAuthoredReply
    && input.hasAuthoredMarkdown;
}

export function resolveChatProviderPresentationProfile(
  engineId: string | undefined,
): ChatProviderPresentationProfile | undefined {
  const normalizedEngineId = engineId?.trim().toLowerCase();
  return CHAT_PROVIDER_PRESENTATION_PROFILES.find(
    (profile) => profile.engineId === normalizedEngineId,
  );
}
