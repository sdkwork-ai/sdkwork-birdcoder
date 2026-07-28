import { memo, useId } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import type { ChatMessageTranslate } from '../types.ts';
import { ToolCallCard } from './ToolCallCard.tsx';
import type { ContextToolCallPresentationGroup } from './toolCallPresentation.ts';

export interface ContextToolCallGroupProps {
  compact: boolean;
  copyMessageToClipboard: (content: string) => void;
  disclosureScopeKey: string;
  expandedDisclosureKeys: ReadonlySet<string>;
  group: ContextToolCallPresentationGroup;
  isExpanded: boolean;
  onToggle: () => void;
  t?: ChatMessageTranslate;
  toggleDisclosure: (key: string) => void;
}

function translate(
  t: ChatMessageTranslate | undefined,
  key: string,
  fallback: string,
  options?: Record<string, unknown>,
): string {
  const value = t?.(key, options);
  return value && value !== key ? value : fallback;
}

function resolveCountLabel(
  category: keyof ContextToolCallPresentationGroup['summary'],
  count: number,
  t?: ChatMessageTranslate,
): string {
  const labels = {
    list: {
      fallback: `${count} ${count === 1 ? 'listing' : 'listings'}`,
      key: 'chat.toolContextListCount',
    },
    read: {
      fallback: `${count} ${count === 1 ? 'read' : 'reads'}`,
      key: 'chat.toolContextReadCount',
    },
    search: {
      fallback: `${count} ${count === 1 ? 'search' : 'searches'}`,
      key: 'chat.toolContextSearchCount',
    },
  } as const;
  const label = labels[category];
  return translate(t, label.key, label.fallback, { count });
}

export const ContextToolCallGroup = memo(function ContextToolCallGroup({
  compact,
  copyMessageToClipboard,
  disclosureScopeKey,
  expandedDisclosureKeys,
  group,
  isExpanded,
  onToggle,
  t,
  toggleDisclosure,
}: ContextToolCallGroupProps) {
  const detailsId = useId();
  const isRunning = group.calls.some((call) =>
    call.status === 'pending' || call.status === 'running' || call.status === 'waiting',
  );
  const hasError = group.calls.some((call) => call.status === 'error');
  const title = isRunning
    ? translate(t, 'chat.toolContextGathering', 'Gathering context')
    : translate(t, 'chat.toolContextGathered', 'Gathered context');
  const summary = (['read', 'search', 'list'] as const)
    .flatMap((category) => {
      const count = group.summary[category];
      return count > 0 ? [resolveCountLabel(category, count, t)] : [];
    })
    .join(' · ');
  const disclosureLabel = isExpanded
    ? translate(t, 'chat.toolContextCollapse', 'Hide context tools')
    : translate(t, 'chat.toolContextExpand', 'Show context tools');

  return (
    <div
      className="w-full min-w-0"
      data-chat-context-tool-group="true"
      data-chat-context-tool-status={isRunning ? 'running' : hasError ? 'error' : 'success'}
    >
      <button
        aria-controls={detailsId}
        aria-expanded={isExpanded}
        aria-label={`${title}${summary ? `. ${summary}` : ''}. ${disclosureLabel}`}
        className="flex min-h-7 w-full min-w-0 items-center gap-2 rounded-md py-1 text-left transition-colors hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
        data-chat-context-tool-disclosure="true"
        onClick={onToggle}
        title={disclosureLabel}
        type="button"
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-500">
          {isRunning ? (
            <Loader2
              aria-hidden="true"
              className="motion-safe:animate-spin motion-reduce:animate-none"
              size={compact ? 12 : 13}
            />
          ) : hasError ? (
            <AlertCircle aria-hidden="true" className="text-red-400/80" size={compact ? 12 : 13} />
          ) : (
            <CheckCircle2 aria-hidden="true" className="text-gray-500" size={compact ? 12 : 13} />
          )}
        </span>
        <span className="shrink-0 text-[13px] font-medium text-gray-300">{title}</span>
        {summary ? (
          <span className="min-w-0 flex-1 truncate text-[12px] text-gray-500">{summary}</span>
        ) : (
          <span className="min-w-0 flex-1" aria-hidden="true" />
        )}
        <span className="shrink-0 text-gray-600" aria-hidden="true">
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {isExpanded ? (
        <div
          className="ml-2 flex min-w-0 flex-col gap-0.5 border-l border-white/[0.07] pb-1 pl-4"
          data-chat-context-tool-list="true"
          id={detailsId}
        >
          {group.calls.map((call) => {
            const disclosureKey = `${disclosureScopeKey}\u0001${call.id}`;
            return (
              <ToolCallCard
                key={call.id}
                call={call}
                compact={compact}
                copyMessageToClipboard={copyMessageToClipboard}
                isExpanded={expandedDisclosureKeys.has(disclosureKey)}
                onToggle={() => toggleDisclosure(disclosureKey)}
                t={t}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
