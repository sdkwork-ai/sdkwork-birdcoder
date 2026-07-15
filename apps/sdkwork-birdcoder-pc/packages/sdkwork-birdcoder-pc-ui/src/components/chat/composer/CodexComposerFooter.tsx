import { memo } from 'react';
import { SharedComposerFooter } from './SharedComposerFooter';
import type { EngineComposerFooterProps } from './UniversalChatComposerFooter.types';

export const CodexComposerFooter = memo(function CodexComposerFooter(
  props: EngineComposerFooterProps,
) {
  return <SharedComposerFooter {...props} engineId="codex" />;
});
