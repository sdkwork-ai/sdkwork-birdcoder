import { useId } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  MessageCircleQuestion,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import type { AgentSessionItemInteractionView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';
import { revealChatDisclosureDetails } from '../revealChatDisclosureDetails.ts';
import { ChatInteractionEventDetails } from './ChatInteractionEventDetails.tsx';
import {
  hasInteractionEventDetails,
  resolveInteractionEventLabel,
  resolveInteractionEventMeta,
  resolveInteractionEventSummary,
} from './interactionEventPresentation.ts';

interface ChatInteractionEventRowProps {
  copyMessageToClipboard: (content: string) => void;
  interaction: AgentSessionItemInteractionView;
  isExpanded: boolean;
  onToggle: () => void;
  t?: ChatMessageTranslate;
}

function renderInteractionIcon(interaction: AgentSessionItemInteractionView) {
  if (interaction.status === 'failed') {
    return <TriangleAlert size={13} className="text-red-300/90" aria-hidden="true" />;
  }
  if (interaction.status === 'cancelled' || interaction.status === 'rejected' || interaction.status === 'denied') {
    return <Ban size={13} className="text-amber-300/80" aria-hidden="true" />;
  }
  if (interaction.status === 'approved' || interaction.status === 'answered' || interaction.status === 'completed') {
    return <CheckCircle2 size={13} className="text-emerald-400/80" aria-hidden="true" />;
  }
  if (interaction.kind === 'approval') {
    return <ShieldAlert size={13} className="text-amber-300/90" aria-hidden="true" />;
  }
  if (interaction.kind === 'question') {
    return <MessageCircleQuestion size={13} className="text-sky-300/90" aria-hidden="true" />;
  }
  return <CircleDashed size={13} className="text-gray-500" aria-hidden="true" />;
}

export function ChatInteractionEventRow({
  copyMessageToClipboard,
  interaction,
  isExpanded,
  onToggle,
  t,
}: ChatInteractionEventRowProps) {
  const detailsId = useId();
  const label = resolveInteractionEventLabel(interaction, t);
  const summary = resolveInteractionEventSummary(interaction);
  const meta = resolveInteractionEventMeta(interaction, t);
  const hasDetails = hasInteractionEventDetails(interaction);
  const expandLabel = t?.('chat.interactionExpand') ?? 'Show interaction details';
  const collapseLabel = t?.('chat.interactionCollapse') ?? 'Hide interaction details';
  const statusTone = interaction.status === 'pending'
    ? 'text-amber-200/90'
    : interaction.status === 'failed'
      ? 'text-red-300/90'
      : 'text-gray-300';

  const content = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {renderInteractionIcon(interaction)}
      </span>
      <span className={`shrink-0 font-medium ${statusTone}`}>{label}</span>
      {summary && summary !== label ? (
        <span className="min-w-0 flex-1 truncate text-gray-400" title={summary}>{summary}</span>
      ) : <span className="min-w-0 flex-1" />}
      {meta ? (
        <span className="max-w-[35%] shrink-0 truncate text-[10px] text-gray-400" title={meta}>{meta}</span>
      ) : null}
      {hasDetails ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-400">
          {isExpanded
            ? <ChevronDown size={13} aria-hidden="true" />
            : <ChevronRight size={13} aria-hidden="true" />}
        </span>
      ) : null}
    </>
  );

  return (
    <div data-chat-interaction-kind={interaction.kind} data-chat-interaction-status={interaction.status}>
      {hasDetails ? (
        <button
          type="button"
          className="flex min-h-9 w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
          data-chat-interaction-toggle="true"
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
        <div className="flex min-h-9 w-full min-w-0 items-center gap-1.5 px-1.5 py-1 text-[11px]">
          {content}
        </div>
      )}
      {hasDetails && isExpanded ? (
        <ChatInteractionEventDetails
          copyMessageToClipboard={copyMessageToClipboard}
          detailsId={detailsId}
          interaction={interaction}
          t={t}
        />
      ) : null}
    </div>
  );
}
