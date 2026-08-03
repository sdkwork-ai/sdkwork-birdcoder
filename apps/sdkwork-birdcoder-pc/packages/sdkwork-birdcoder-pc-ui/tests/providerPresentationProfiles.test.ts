import { describe, expect, it } from 'vitest';

import {
  CHAT_PROVIDER_PRESENTATION_PROFILES,
  GEMINI_CHAT_TRANSCRIPT_POLICY,
  OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY,
  resolveChatProviderPresentationProfile,
  shouldShowChatProviderByline,
} from '../src/components/chat/messages/presentation/providerPresentationProfiles.ts';

describe('provider presentation profiles', () => {
  it('registers one profile per engine with distinct surface labels', () => {
    expect(CHAT_PROVIDER_PRESENTATION_PROFILES.map((p) => p.engineId)).toEqual([
      'codex',
      'claude-code',
      'opencode',
      'gemini',
      'openclaw',
      'hermes',
    ]);
    expect(new Set(CHAT_PROVIDER_PRESENTATION_PROFILES.map((p) => p.surfaceLabel)).size)
      .toBe(CHAT_PROVIDER_PRESENTATION_PROFILES.length);
  });

  it('keeps the Codex-aligned policy as the baseline for every engine', () => {
    for (const profile of CHAT_PROVIDER_PRESENTATION_PROFILES) {
      expect(profile.presentation.density).toBe('comfortable');
      expect(profile.presentation.transcriptStyle).toBe('opencode-aligned');
      expect(profile.presentation.tools.context).toBe('grouped-disclosure');
      expect(profile.presentation.providerIdentity.sidebar).toBe('authored-markdown');
    }
  });

  it('differentiates the Gemini streaming tail with Thinking language', () => {
    const gemini = resolveChatProviderPresentationProfile('gemini');
    expect(gemini?.presentation.activeTail.fallbackLabel).toBe('Thinking');
    expect(gemini?.presentation.activeTail.labelKey).toBe('chat.providerThinking');
    expect(gemini?.presentation).toBe(GEMINI_CHAT_TRANSCRIPT_POLICY);

    // Every non-Gemini engine keeps the Codex "Working" streaming language.
    for (const profile of CHAT_PROVIDER_PRESENTATION_PROFILES) {
      if (profile.engineId === 'gemini') {
        continue;
      }
      expect(profile.presentation.activeTail.fallbackLabel).toBe('Working');
      expect(profile.presentation.activeTail.labelKey).toBe('chat.providerWorking');
    }
  });

  it('keeps the Gemini transcript structure aligned with the baseline policy', () => {
    expect(GEMINI_CHAT_TRANSCRIPT_POLICY.density)
      .toBe(OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY.density);
    expect(GEMINI_CHAT_TRANSCRIPT_POLICY.transcriptStyle)
      .toBe(OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY.transcriptStyle);
    expect(GEMINI_CHAT_TRANSCRIPT_POLICY.tools)
      .toEqual(OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY.tools);
    expect(GEMINI_CHAT_TRANSCRIPT_POLICY.activityPresentation)
      .toEqual(OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY.activityPresentation);
  });

  it('shows the provider byline only for authored markdown replies in the sidebar', () => {
    const codex = resolveChatProviderPresentationProfile('codex');
    expect(codex).toBeDefined();
    expect(shouldShowChatProviderByline(codex!, {
      hasAuthoredMarkdown: true,
      isAuthoredReply: true,
      layout: 'sidebar',
    })).toBe(true);
    expect(shouldShowChatProviderByline(codex!, {
      hasAuthoredMarkdown: false,
      isAuthoredReply: true,
      layout: 'sidebar',
    })).toBe(false);
    expect(shouldShowChatProviderByline(codex!, {
      hasAuthoredMarkdown: true,
      isAuthoredReply: true,
      layout: 'main',
    })).toBe(false);
    expect(shouldShowChatProviderByline(codex!, {
      hasAuthoredMarkdown: true,
      isAuthoredReply: false,
      layout: 'sidebar',
    })).toBe(false);
  });

  it('resolves unknown engines to undefined without throwing', () => {
    expect(resolveChatProviderPresentationProfile(undefined)).toBeUndefined();
    expect(resolveChatProviderPresentationProfile('unknown-engine')).toBeUndefined();
  });
});
