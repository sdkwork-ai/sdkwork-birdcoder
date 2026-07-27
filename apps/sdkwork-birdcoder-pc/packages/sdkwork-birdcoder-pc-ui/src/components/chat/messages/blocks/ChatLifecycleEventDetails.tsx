import { Copy } from 'lucide-react';
import type {
  AgentSessionItemLifecycleEventView,
  AgentSessionItemTokenUsageView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';
import { formatLifecycleTokenCount } from './lifecycleEventPresentation.ts';

interface ChatLifecycleEventDetailsProps {
  copyMessageToClipboard: (content: string) => void;
  detailsId: string;
  event: AgentSessionItemLifecycleEventView;
  t?: ChatMessageTranslate;
}

function buildUsageMetrics(
  usage: AgentSessionItemTokenUsageView | undefined,
  t?: ChatMessageTranslate,
): Array<{ label: string; value: string }> {
  if (!usage) return [];
  return [
    { label: t?.('chat.lifecycleInputTokens') ?? 'Input', value: formatLifecycleTokenCount(usage.inputTokens) },
    { label: t?.('chat.lifecycleOutputTokens') ?? 'Output', value: formatLifecycleTokenCount(usage.outputTokens) },
    { label: t?.('chat.lifecycleReasoningTokens') ?? 'Reasoning', value: formatLifecycleTokenCount(usage.reasoningTokens) },
    { label: t?.('chat.lifecycleCacheReadTokens') ?? 'Cache read', value: formatLifecycleTokenCount(usage.cacheReadTokens) },
    { label: t?.('chat.lifecycleCacheWriteTokens') ?? 'Cache write', value: formatLifecycleTokenCount(usage.cacheWriteTokens) },
    { label: t?.('chat.lifecycleTotalTokens') ?? 'Total', value: formatLifecycleTokenCount(usage.totalTokens) },
  ].filter((metric) => metric.value);
}

export function ChatLifecycleEventDetails({
  copyMessageToClipboard,
  detailsId,
  event,
  t,
}: ChatLifecycleEventDetailsProps) {
  const detail = event.detail?.trim() ?? '';
  const metrics = buildUsageMetrics(event.usage, t);
  const retryAt = event.retryAt
    ? new Date(event.retryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';
  const copyLabel = t?.('chat.lifecycleCopyDetails') ?? 'Copy execution details';

  return (
    <div
      id={detailsId}
      className="ml-7 min-w-0 border-l border-white/[0.08] pb-2 pl-3 pr-1 pt-1"
      data-chat-lifecycle-details="true"
      role="region"
      tabIndex={0}
    >
      {detail ? (
        <div className="group/lifecycle-detail relative min-w-0 pr-8">
          <div className="whitespace-pre-wrap break-words text-[11px] leading-5 text-gray-400 [overflow-wrap:anywhere]">
            {detail}
          </div>
          <button
            type="button"
            className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-md text-gray-600 opacity-0 transition-colors hover:bg-white/[0.06] hover:text-gray-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70 group-hover/lifecycle-detail:opacity-100 [@media(hover:none)]:opacity-100"
            aria-label={copyLabel}
            title={copyLabel}
            onClick={() => copyMessageToClipboard(detail)}
          >
            <Copy size={11} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {metrics.length > 0 ? (
        <dl className="mt-1.5 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[10px]" data-chat-lifecycle-usage="true">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex min-w-0 items-baseline gap-1.5">
              <dt className="text-gray-600">{metric.label}</dt>
              <dd className="font-mono tabular-nums text-gray-400">{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {retryAt ? (
        <div className="mt-1.5 text-[10px] text-gray-600">
          {t?.('chat.lifecycleRetryAt', { time: retryAt }) ?? `Next retry at ${retryAt}`}
        </div>
      ) : null}
      {event.automatic !== undefined ? (
        <div className="mt-1 text-[10px] text-gray-600">
          {event.automatic
            ? t?.('chat.lifecycleAutomatic') ?? 'Automatic'
            : t?.('chat.lifecycleManual') ?? 'Manual'}
        </div>
      ) : null}
    </div>
  );
}
