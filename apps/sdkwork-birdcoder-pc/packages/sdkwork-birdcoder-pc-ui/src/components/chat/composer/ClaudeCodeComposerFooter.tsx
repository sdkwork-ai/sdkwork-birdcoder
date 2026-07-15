import { memo } from 'react';
import { SharedComposerFooter } from './SharedComposerFooter';
import type { EngineComposerFooterProps } from './UniversalChatComposerFooter.types';

export const ClaudeCodeComposerFooter = memo(function ClaudeCodeComposerFooter(
  props: EngineComposerFooterProps,
) {
  return <SharedComposerFooter {...props} engineId="claude-code" />;
});
