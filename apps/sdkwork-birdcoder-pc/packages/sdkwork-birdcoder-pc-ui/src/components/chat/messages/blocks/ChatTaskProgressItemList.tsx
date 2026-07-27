import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Circle,
  CircleDashed,
} from 'lucide-react';
import type {
  AgentSessionTaskItemStatus,
  AgentSessionTaskItemView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';

function resolveStatusLabel(status: AgentSessionTaskItemStatus, t?: ChatMessageTranslate): string {
  const labels: Readonly<Record<AgentSessionTaskItemStatus, string>> = {
    blocked: t?.('chat.taskItemBlocked') ?? 'Blocked',
    cancelled: t?.('chat.taskItemCancelled') ?? 'Cancelled',
    completed: t?.('chat.taskItemCompleted') ?? 'Completed',
    pending: t?.('chat.taskItemPending') ?? 'Pending',
    running: t?.('chat.taskItemRunning') ?? 'In progress',
  };
  return labels[status];
}

function StatusIcon({ status }: { status: AgentSessionTaskItemStatus }) {
  if (status === 'completed') {
    return <CheckCircle2 size={13} className="text-emerald-400/80" aria-hidden="true" />;
  }
  if (status === 'running') {
    return <CircleDashed size={13} className="text-blue-300 motion-safe:animate-pulse" aria-hidden="true" />;
  }
  if (status === 'blocked') {
    return <AlertCircle size={13} className="text-amber-300" aria-hidden="true" />;
  }
  if (status === 'cancelled') {
    return <Ban size={13} className="text-gray-500" aria-hidden="true" />;
  }
  return <Circle size={13} className="text-gray-600" aria-hidden="true" />;
}

export function ChatTaskProgressItemList({
  id,
  items,
  t,
}: {
  id: string;
  items: readonly AgentSessionTaskItemView[];
  t?: ChatMessageTranslate;
}) {
  return (
    <ol id={id} className="max-h-52 space-y-0.5 overflow-y-auto px-1.5 pb-1.5 pt-1 custom-scrollbar">
      {items.map((item, index) => {
        const isInactive = item.status === 'completed' || item.status === 'cancelled';
        const statusLabel = resolveStatusLabel(item.status, t);
        return (
          <li
            key={item.id ?? `${index}:${item.text}`}
            data-chat-task-item-status={item.status}
            className="flex min-w-0 items-start gap-2 rounded px-1 py-1 text-[12px] leading-5"
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              <StatusIcon status={item.status} />
            </span>
            <span
              className={`min-w-0 flex-1 break-words [overflow-wrap:anywhere] ${
                isInactive ? 'text-gray-500 line-through decoration-gray-600' : 'text-gray-300'
              }`}
            >
              {item.text}
            </span>
            <span className="sr-only">{statusLabel}</span>
          </li>
        );
      })}
    </ol>
  );
}
