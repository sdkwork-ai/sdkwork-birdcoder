import { memo, useId } from 'react';
import { ChevronDown, ChevronRight, Copy, Lightbulb } from 'lucide-react';
import type { ChatMessageContentBlockRendererProps } from './registry.ts';

function formatReasoningDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return '';
  }
  if (durationMs < 1_000) {
    return `${Math.round(durationMs)}ms`;
  }
  if (durationMs < 60_000) {
    return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
  }
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export const ReasoningContentBlock = memo(function ReasoningContentBlock({
  block,
  context,
}: ChatMessageContentBlockRendererProps) {
  const detailsId = useId();
  if (block.type !== 'reasoning' || block.items.length === 0) {
    return null;
  }

  const sourceMessage = context.allMessages[context.index];
  const disclosureKey = `${context.sessionId}\u0001${
    sourceMessage?.id?.trim() || sourceMessage?.turnId?.trim() || String(context.index)
  }\u0001reasoning`;
  const isExpanded = context.expandedDisclosureKeys.has(disclosureKey);
  const summaryLabel = context.environment?.t('chat.reasoningSummary') ?? 'Reasoning summary';
  const expandLabel = context.environment?.t('chat.reasoningExpand') ?? 'Show reasoning summary';
  const collapseLabel = context.environment?.t('chat.reasoningCollapse') ?? 'Hide reasoning summary';
  const copyLabel = context.environment?.t('chat.reasoningCopy') ?? 'Copy reasoning summary';
  const singleItem = block.items.length === 1 ? block.items[0] : undefined;
  const collapsedTitle = singleItem?.title?.trim();
  const collapsedDuration = formatReasoningDuration(singleItem?.durationMs);

  return (
    <div
      className={context.layout === 'sidebar' ? 'mt-1.5 min-w-0' : 'mt-2 min-w-0'}
      data-chat-message-reasoning
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12px] text-gray-500 transition-colors hover:bg-white/[0.04] hover:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
        data-chat-reasoning-disclosure
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        aria-label={`${isExpanded ? collapseLabel : expandLabel}: ${summaryLabel}`}
        title={isExpanded ? collapseLabel : expandLabel}
        onClick={() => context.toggleDisclosure(disclosureKey)}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-violet-300/80">
          <Lightbulb size={13} aria-hidden="true" />
        </span>
        <span className="shrink-0 font-medium text-gray-400">{summaryLabel}</span>
        {block.items.length > 1 ? (
          <span className="shrink-0 tabular-nums text-[10px] text-gray-600" aria-hidden="true">
            {block.items.length}
          </span>
        ) : null}
        {collapsedTitle ? (
          <span className="min-w-0 flex-1 truncate text-gray-600" title={collapsedTitle}>
            {collapsedTitle}
          </span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        {collapsedDuration ? (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-gray-600">
            {collapsedDuration}
          </span>
        ) : null}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-600">
          {isExpanded
            ? <ChevronDown size={13} aria-hidden="true" />
            : <ChevronRight size={13} aria-hidden="true" />}
        </span>
      </button>

      {isExpanded ? (
        <div
          id={detailsId}
          className={`ml-3 overflow-y-auto border-l border-white/[0.08] pl-3 pr-1 custom-scrollbar ${
            context.layout === 'sidebar' ? 'max-h-72' : 'max-h-96'
          }`}
          role="region"
          aria-label={summaryLabel}
          tabIndex={0}
        >
          {block.items.map((item, index) => {
            const title = item.title?.trim();
            const duration = formatReasoningDuration(item.durationMs);
            return (
              <div
                key={item.id}
                className="group/reasoning relative min-w-0 py-2 pr-8 text-[12px] leading-5 text-gray-400"
                data-chat-reasoning-item
              >
                {title || duration || block.items.length > 1 ? (
                  <div className="mb-1 flex min-w-0 items-center gap-2 text-[10px] text-gray-600">
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-500" title={title}>
                      {title || `${summaryLabel} ${index + 1}`}
                    </span>
                    {duration ? (
                      <span className="shrink-0 font-mono tabular-nums">{duration}</span>
                    ) : null}
                  </div>
                ) : null}
                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {item.summary}
                </div>
                <button
                  type="button"
                  className="absolute right-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-gray-600 opacity-0 transition-colors hover:bg-white/[0.06] hover:text-gray-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70 group-hover/reasoning:opacity-100 [@media(hover:none)]:opacity-100"
                  aria-label={`${copyLabel}: ${title || summaryLabel}`}
                  title={copyLabel}
                  onClick={() => context.copyMessageToClipboard(item.summary)}
                >
                  <Copy size={11} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
