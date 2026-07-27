import { useId } from 'react';
import {
  Archive,
  Ban,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleStop,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import type { AgentSessionItemLifecycleEventView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';
import { revealChatDisclosureDetails } from '../revealChatDisclosureDetails.ts';
import { ChatLifecycleEventDetails } from './ChatLifecycleEventDetails.tsx';
import {
  hasLifecycleEventDetails,
  resolveLifecycleEventLabel,
  resolveLifecycleEventMeta,
} from './lifecycleEventPresentation.ts';

interface ChatLifecycleEventRowProps {
  copyMessageToClipboard: (content: string) => void;
  event: AgentSessionItemLifecycleEventView;
  isExpanded: boolean;
  onToggle: () => void;
  t?: ChatMessageTranslate;
}

function renderLifecycleIcon(event: AgentSessionItemLifecycleEventView) {
  const className = event.kind === 'retrying' ? 'animate-spin motion-reduce:animate-none' : undefined;
  switch (event.kind) {
    case 'started': return <CircleDashed size={13} className="text-sky-300/80" aria-hidden="true" />;
    case 'completed': return <CheckCircle2 size={13} className="text-emerald-400/80" aria-hidden="true" />;
    case 'retrying': return <RefreshCw size={13} className={`text-amber-300/80 ${className ?? ''}`} aria-hidden="true" />;
    case 'compacted': return <Archive size={13} className="text-violet-300/80" aria-hidden="true" />;
    case 'checkpoint': return <BookmarkCheck size={13} className="text-cyan-300/80" aria-hidden="true" />;
    case 'blocked': return <ShieldAlert size={13} className="text-amber-300/80" aria-hidden="true" />;
    case 'stopped': return <CircleStop size={13} className="text-orange-300/80" aria-hidden="true" />;
    case 'cancelled': return <Ban size={13} className="text-gray-400" aria-hidden="true" />;
    case 'failed': return <TriangleAlert size={13} className="text-red-300/90" aria-hidden="true" />;
    default: return <CircleDashed size={13} className="text-gray-500" aria-hidden="true" />;
  }
}

export function ChatLifecycleEventRow({
  copyMessageToClipboard,
  event,
  isExpanded,
  onToggle,
  t,
}: ChatLifecycleEventRowProps) {
  const detailsId = useId();
  const label = resolveLifecycleEventLabel(event, t);
  const meta = resolveLifecycleEventMeta(event, t);
  const hasDetails = hasLifecycleEventDetails(event);
  const expandLabel = t?.('chat.lifecycleExpand') ?? 'Show execution details';
  const collapseLabel = t?.('chat.lifecycleCollapse') ?? 'Hide execution details';
  const detailPreview = event.detail?.replace(/\s+/gu, ' ').trim() ?? '';

  const content = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {renderLifecycleIcon(event)}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-gray-400">{label}</span>
      {detailPreview ? (
        <span className="hidden min-w-0 max-w-[45%] flex-1 truncate text-gray-500 lg:block" title={detailPreview}>
          {detailPreview}
        </span>
      ) : null}
      {meta.length > 0 ? (
        <span className="shrink-0 truncate font-mono text-[10px] tabular-nums text-gray-400/80">
          {meta.join(' / ')}
        </span>
      ) : null}
      {hasDetails ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-400/80">
          {isExpanded
            ? <ChevronDown size={13} aria-hidden="true" />
            : <ChevronRight size={13} aria-hidden="true" />}
        </span>
      ) : null}
    </>
  );

  return (
    <div data-chat-lifecycle-event={event.kind}>
      {hasDetails ? (
        <button
          type="button"
          className="flex min-h-8 w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
          data-chat-lifecycle-toggle="true"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          aria-label={`${isExpanded ? collapseLabel : expandLabel}: ${label}`}
          title={isExpanded ? collapseLabel : expandLabel}
          onClick={() => {
            onToggle();
            if (!isExpanded) revealChatDisclosureDetails(detailsId);
          }}
        >
          {content}
        </button>
      ) : (
        <div className="flex min-h-8 w-full min-w-0 items-center gap-1.5 px-1.5 py-1 text-[11px]">
          {content}
        </div>
      )}
      {hasDetails && isExpanded ? (
        <ChatLifecycleEventDetails
          copyMessageToClipboard={copyMessageToClipboard}
          detailsId={detailsId}
          event={event}
          t={t}
        />
      ) : null}
    </div>
  );
}
