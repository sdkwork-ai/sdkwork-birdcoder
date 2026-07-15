import { memo } from 'react';
import { SharedComposerFooter } from './SharedComposerFooter';
import type { EngineComposerFooterProps } from './UniversalChatComposerFooter.types';

export const GeminiComposerFooter = memo(function GeminiComposerFooter(
  props: EngineComposerFooterProps,
) {
  return <SharedComposerFooter {...props} engineId="gemini" />;
});
