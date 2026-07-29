import { ChevronDown, ListTodo } from 'lucide-react';

interface ChatTaskProgressSummaryProps {
  activeItemText?: string;
  canExpand: boolean;
  completed: number;
  detailsId: string;
  expanded: boolean;
  onToggle?: () => void;
  percent: number;
  progressLabel: string;
  stepLabel: string;
  total: number;
}

function SummaryContent({
  activeItemText,
  canExpand,
  completed,
  expanded,
  percent,
  progressLabel,
  stepLabel,
  total,
}: Omit<ChatTaskProgressSummaryProps, 'detailsId' | 'onToggle'>) {
  return (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-blue-300">
        <ListTodo size={13} aria-hidden="true" />
      </span>
      <span className="shrink-0 text-[12px] font-medium text-gray-300">{progressLabel}</span>
      {activeItemText ? (
        <span
          className="min-w-0 flex-1 truncate text-[11px] text-gray-500"
          title={activeItemText}
        >
          {activeItemText}
        </span>
      ) : (
        <span className="min-w-0 flex-1" aria-hidden="true" />
      )}
      <span className="shrink-0 text-[11px] text-gray-400">
        {stepLabel}
      </span>
      {canExpand ? (
        <ChevronDown
          size={13}
          className={`shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      ) : null}
      <span
        className="absolute inset-x-1.5 bottom-0 h-px overflow-hidden bg-white/[0.06]"
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-valuetext={`${completed}/${total}`}
      >
        <span
          className="block h-full bg-blue-400/80 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </span>
    </>
  );
}

export function ChatTaskProgressSummary(props: ChatTaskProgressSummaryProps) {
  const className = 'relative flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md px-1.5 pb-2 pt-1.5 text-left transition-colors';
  const content = <SummaryContent {...props} />;
  if (!props.canExpand) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      data-chat-task-progress-toggle="true"
      className={`${className} hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70`}
      aria-controls={props.detailsId}
      aria-expanded={props.expanded}
      aria-label={`${props.progressLabel}: ${props.stepLabel}`}
      onClick={props.onToggle}
    >
      {content}
    </button>
  );
}
