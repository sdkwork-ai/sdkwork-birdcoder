import { List } from 'lucide-react';
import type { ChatMessageViewSource } from '@sdkwork/birdcoder-pc-commons/chat/types';
import {
  resolveTaskProgressDisplayState,
  type ChatMessageTaskProgressDisplayState,
} from '@sdkwork/birdcoder-pc-commons/chat/types';

export {
  normalizeTaskProgressCounter,
  readTaskProgressCounter,
  resolveTaskProgressDisplayState,
} from '@sdkwork/birdcoder-pc-commons/chat/types';

export function ChatTaskProgress({
  taskProgress,
}: {
  taskProgress: ChatMessageViewSource['taskProgress'];
}) {
  const taskProgressDisplayState = resolveTaskProgressDisplayState(taskProgress);
  if (!taskProgressDisplayState) {
    return null;
  }

  return (
    <ChatTaskProgressInline displayState={taskProgressDisplayState} />
  );
}

function ChatTaskProgressInline({
  displayState,
}: {
  displayState: ChatMessageTaskProgressDisplayState;
}) {
  const { completed, percent, total } = displayState;

  return (
    <div
      data-chat-task-progress="inline"
      className="mt-2 w-full rounded-md px-1.5 py-1.5 text-xs text-gray-300"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <List size={13} className="shrink-0 text-blue-400" />
          <span className="truncate">Task progress</span>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-gray-500">
          {completed}/{total}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-blue-400 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
