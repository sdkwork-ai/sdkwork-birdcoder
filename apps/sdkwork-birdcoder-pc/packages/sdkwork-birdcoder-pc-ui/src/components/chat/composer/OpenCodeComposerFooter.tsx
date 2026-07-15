import { memo } from 'react';
import { SharedComposerFooter } from './SharedComposerFooter';
import type { EngineComposerFooterProps } from './UniversalChatComposerFooter.types';

export const OpenCodeComposerFooter = memo(function OpenCodeComposerFooter(
  props: EngineComposerFooterProps,
) {
  return <SharedComposerFooter {...props} engineId="opencode" />;
});
