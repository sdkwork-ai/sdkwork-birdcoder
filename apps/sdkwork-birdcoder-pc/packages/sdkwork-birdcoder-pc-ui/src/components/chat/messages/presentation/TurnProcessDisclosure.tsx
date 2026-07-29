import React, { memo, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { ContentBlockList } from '../contentBlocks/ContentBlockList.tsx';
import type { ChatMessageRenderContext } from '../types.ts';
import type { ChatTurnProcessPresentation } from './turnProcessPresentation.ts';

export interface TurnProcessDisclosureProps {
  context: ChatMessageRenderContext;
  presentation: ChatTurnProcessPresentation;
}

function formatTurnDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const TurnProcessDisclosure = memo(function TurnProcessDisclosure({
  context,
  presentation,
}: TurnProcessDisclosureProps) {
  const [clock, setClock] = useState(() => Date.now());
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const expandedDisclosureKey = `${presentation.key}\u0001turn-process`;
  const isExplicitlyExpanded = context.expandedDisclosureKeys.has(expandedDisclosureKey);
  const isExpanded = presentation.isActive
    ? !activeCollapsed || isExplicitlyExpanded
    : isExplicitlyExpanded;

  useEffect(() => {
    if (!presentation.isActive) return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [presentation.isActive]);

  const duration = useMemo(() => {
    if (presentation.startedAtMs === undefined) return '';
    if (!presentation.isActive && presentation.completedAtMs === undefined) return '';
    const end = presentation.isActive
      ? clock
      : presentation.completedAtMs!;
    return formatTurnDuration(Math.max(0, end - presentation.startedAtMs));
  }, [clock, presentation.completedAtMs, presentation.isActive, presentation.startedAtMs]);

  const workingLabel = context.environment?.t('chat.providerWorking') ?? 'Working';
  const processedLabel = context.environment?.t('chat.turnProcessed') ?? 'Processed';
  const expandLabel = context.environment?.t('chat.turnProcessExpand') ?? 'Show execution process';
  const collapseLabel = context.environment?.t('chat.turnProcessCollapse') ?? 'Hide execution process';
  const stepsLabel = context.environment?.t('chat.turnProcessSteps', {
    count: presentation.processBlockCount,
  }) ?? `${presentation.processBlockCount} steps`;
  const title = presentation.isActive ? workingLabel : processedLabel;
  const actionLabel = isExpanded ? collapseLabel : expandLabel;

  return (
    <section
      className={`w-full min-w-0 border-b border-white/[0.07] ${context.layout === 'sidebar' ? 'mb-1' : 'mb-2'}`}
      data-chat-turn-process="true"
      data-chat-turn-process-state={presentation.isActive ? 'active' : 'completed'}
      data-chat-turn-process-expanded={isExpanded ? 'true' : 'false'}
    >
      <button
        type="button"
        className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-2 text-left text-gray-400 transition-colors hover:bg-white/[0.035] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
        aria-expanded={isExpanded}
        aria-label={`${title}${duration ? `, ${duration}` : ''}. ${actionLabel}`}
        title={actionLabel}
        onClick={() => {
          if (presentation.isActive && !isExplicitlyExpanded) {
            setActiveCollapsed((value) => !value);
            return;
          }
          context.toggleDisclosure(expandedDisclosureKey);
        }}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-500">
          {presentation.isActive
            ? <Loader2 size={14} className="animate-spin text-blue-300/80" aria-hidden="true" />
            : <CheckCircle2 size={14} className="text-emerald-300/70" aria-hidden="true" />}
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium text-gray-300">{title}</span>
        {duration ? (
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-gray-500">{duration}</span>
        ) : null}
        <span className="min-w-0 flex-1" aria-hidden="true" />
        <span className="shrink-0 text-[10px] text-gray-600 max-[680px]:hidden">{stepsLabel}</span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-600">
          {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </span>
      </button>

      {isExpanded ? (
        <div className="space-y-2 pb-3 pl-1.5 pr-1.5 pt-1" data-chat-turn-process-details="true">
          {presentation.items.map((item) => (
            <div
              key={`${item.sourceIndex}:${item.view.sessionItemId}`}
              className="min-w-0"
              data-chat-turn-process-item="true"
            >
              <ContentBlockList
                view={item.view}
                context={{
                  ...context,
                  index: item.sourceIndex,
                  actionTarget: null,
                  showMessageActions: false,
                  turnFileChanges: undefined,
                  turnProcess: undefined,
                  suppressProcessBlocks: false,
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
});
