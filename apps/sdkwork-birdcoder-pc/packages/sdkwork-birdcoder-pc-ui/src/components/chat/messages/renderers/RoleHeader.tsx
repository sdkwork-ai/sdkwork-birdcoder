import React, { memo } from 'react';
import type { AgentSessionItemViewKind } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';

const ROLE_HEADER_LABELS: Partial<Record<AgentSessionItemViewKind, {
  fallback: string;
  translationKey: string;
}>> = {
  'planner.plan': { fallback: 'Planner', translationKey: 'chat.rolePlanner' },
  'reviewer.feedback': { fallback: 'Reviewer', translationKey: 'chat.roleReviewer' },
  'system.notice': { fallback: 'System', translationKey: 'chat.roleSystem' },
};

export const RoleHeader = memo(function RoleHeader({
  viewKind,
  layout,
  t,
}: {
  viewKind: AgentSessionItemViewKind;
  layout: 'main' | 'sidebar';
  t?: ChatMessageTranslate;
}) {
  const labelDefinition = ROLE_HEADER_LABELS[viewKind];
  if (!labelDefinition) {
    return null;
  }
  const label = t?.(labelDefinition.translationKey) ?? labelDefinition.fallback;

  return (
    <div
      className={`mb-1 font-medium uppercase tracking-normal text-gray-500 ${
        layout === 'sidebar' ? 'text-[10px]' : 'text-[11px]'
      }`}
      data-chat-message-view-kind={viewKind}
    >
      {label}
    </div>
  );
});
