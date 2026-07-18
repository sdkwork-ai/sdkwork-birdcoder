import React, { memo } from 'react';
import type { BirdCoderChatMessageViewKind } from '@sdkwork/birdcoder-pc-workbench/chat/types';

const ROLE_HEADER_LABELS: Partial<Record<BirdCoderChatMessageViewKind, string>> = {
  'planner.plan': 'Planner',
  'reviewer.feedback': 'Reviewer',
  'tool.result': 'Tool',
  'system.notice': 'System',
};

export const RoleHeader = memo(function RoleHeader({
  viewKind,
  layout,
}: {
  viewKind: BirdCoderChatMessageViewKind;
  layout: 'main' | 'sidebar';
}) {
  const label = ROLE_HEADER_LABELS[viewKind];
  if (!label) {
    return null;
  }

  return (
    <div
      className={`mb-1 font-medium uppercase tracking-wide text-gray-500 ${
        layout === 'sidebar' ? 'text-[10px]' : 'text-[11px]'
      }`}
      data-chat-message-view-kind={viewKind}
    >
      {label}
    </div>
  );
});
