import { memo } from 'react';
import { ClaudeCodeComposerFooter } from './ClaudeCodeComposerFooter';
import { CodexComposerFooter } from './CodexComposerFooter';
import { GeminiComposerFooter } from './GeminiComposerFooter';
import { OpenCodeComposerFooter } from './OpenCodeComposerFooter';
import type { UniversalChatComposerFooterProps } from './UniversalChatComposerFooter.types';

export const UniversalChatComposerFooter = memo(function UniversalChatComposerFooter({
  engineId,
  ...props
}: UniversalChatComposerFooterProps) {
  switch (engineId) {
    case 'claude-code':
      return <ClaudeCodeComposerFooter {...props} />;
    case 'gemini':
      return <GeminiComposerFooter {...props} />;
    case 'opencode':
      return <OpenCodeComposerFooter {...props} />;
    case 'codex':
    default:
      return <CodexComposerFooter {...props} />;
  }
});
