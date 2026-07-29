import { useId } from 'react';
import type { AgentSessionItemViewSource } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import {
  resolveTaskProgressDisplayState,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';
import { revealChatDisclosureDetails } from '../revealChatDisclosureDetails.ts';
import { ChatTaskProgressItemList } from './ChatTaskProgressItemList.tsx';
import { ChatTaskProgressSummary } from './ChatTaskProgressSummary.tsx';

export {
  normalizeTaskProgressCounter,
  readTaskProgressCounter,
  resolveTaskProgressDisplayState,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';

export function ChatTaskProgress({
  isExpanded = false,
  onToggle,
  taskProgress,
  t,
}: {
  isExpanded?: boolean;
  onToggle?: () => void;
  taskProgress: AgentSessionItemViewSource['taskProgress'];
  t?: ChatMessageTranslate;
}) {
  const detailsId = useId();
  const displayState = resolveTaskProgressDisplayState(taskProgress);
  if (!displayState) {
    return null;
  }

  const canExpand = displayState.items.length > 0 && Boolean(onToggle);
  const expanded = canExpand && isExpanded;
  const progressLabel = t?.('chat.taskProgress') ?? 'Task progress';
  const activeItemIndex = displayState.activeItem
    ? displayState.items.indexOf(displayState.activeItem)
    : -1;
  const currentStep = activeItemIndex >= 0
    ? activeItemIndex + 1
    : Math.min(displayState.total, Math.max(1, displayState.completed));
  const stepLabel = t?.('chat.taskStep', {
    current: currentStep,
    total: displayState.total,
  }) ?? `Step ${currentStep} / ${displayState.total}`;
  const toggleDetails = canExpand
    ? () => {
        onToggle?.();
        if (!expanded) {
          revealChatDisclosureDetails(detailsId);
        }
      }
    : undefined;

  return (
    <div
      data-chat-task-progress="inline"
      className="w-full min-w-0 overflow-hidden py-1 text-xs text-gray-300"
    >
      <ChatTaskProgressSummary
        activeItemText={displayState.activeItem?.text}
        canExpand={canExpand}
        completed={displayState.completed}
        detailsId={detailsId}
        expanded={expanded}
        onToggle={toggleDetails}
        percent={displayState.percent}
        progressLabel={progressLabel}
        stepLabel={stepLabel}
        total={displayState.total}
      />
      {expanded ? (
        <ChatTaskProgressItemList
          id={detailsId}
          items={displayState.items}
          t={t}
        />
      ) : null}
    </div>
  );
}
