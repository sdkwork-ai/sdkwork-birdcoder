import { List } from 'lucide-react';
import type { ChatMessageViewSource } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import {
  resolveTaskProgressDisplayState,
  type ChatMessageTaskProgressDisplayState,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';

export {
  normalizeTaskProgressCounter,
  readTaskProgressCounter,
  resolveTaskProgressDisplayState,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';

export function ChatTaskProgress({
  taskProgress,
  t,
}: {
  taskProgress: ChatMessageViewSource['taskProgress'];
  t?: ChatMessageTranslate;
}) {
  const taskProgressDisplayState = resolveTaskProgressDisplayState(taskProgress);
  if (!taskProgressDisplayState) {
    return null;
  }

  return (
    <ChatTaskProgressInline displayState={taskProgressDisplayState} t={t} />
  );
}

function ChatTaskProgressInline({
  displayState,
  t,
}: {
  displayState: ChatMessageTaskProgressDisplayState;
  t?: ChatMessageTranslate;
}) {
  const { completed, percent, total } = displayState;
  const progressLabel = t?.('chat.taskProgress') ?? 'Task progress';

  return (
    <div
      data-chat-task-progress="inline"
      className="mt-2 w-full rounded-md px-1.5 py-1.5 text-xs text-gray-300"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <List size={13} className="shrink-0 text-blue-400" aria-hidden="true" />
          <span className="truncate">{progressLabel}</span>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-gray-500">
          {completed}/{total}
        </span>
      </div>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-valuetext={`${completed}/${total}`}
      >
        <div
          className="h-full rounded-full bg-blue-400 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
