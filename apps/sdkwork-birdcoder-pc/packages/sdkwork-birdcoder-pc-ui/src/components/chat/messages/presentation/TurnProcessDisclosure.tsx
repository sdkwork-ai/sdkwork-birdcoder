import React, { memo, useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ContentBlockList } from '../contentBlocks/ContentBlockList.tsx';
import type { ChatMessageRenderContext } from '../types.ts';
import type { ChatTurnProcessPresentation } from './turnProcessPresentation.ts';

export interface TurnProcessDisclosureProps {
  context: ChatMessageRenderContext;
  presentation: ChatTurnProcessPresentation;
}

export function formatTurnDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  if (totalSeconds < 1) return '0s';
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hoursInDay = 24;
  const days = Math.floor(totalSeconds / (3_600 * hoursInDay));
  const hours = Math.floor(totalSeconds / 3_600) % hoursInDay;
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0 || hours > 0) {
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  }
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
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
  const elapsedMs = useMemo(() => {
    if (presentation.startedAtMs === undefined) return 0;
    const end = presentation.isActive
      ? clock
      : presentation.completedAtMs ?? clock;
    return Math.max(0, end - presentation.startedAtMs);
  }, [clock, presentation.completedAtMs, presentation.isActive, presentation.startedAtMs]);

  const workingLabel = context.environment?.t('chat.providerWorking') ?? 'Working';
  const workedForLabel = context.environment?.t('chat.workedFor', { time: duration })
    ?? `Worked for ${duration}`;
  const workingForLabel = context.environment?.t('chat.workingFor', { time: duration })
    ?? `Working for ${duration}`;
  const processedLabel = context.environment?.t('chat.turnProcessed') ?? 'Processed';
  const expandLabel = context.environment?.t('chat.turnProcessExpand') ?? 'Show execution process';
  const collapseLabel = context.environment?.t('chat.turnProcessCollapse') ?? 'Hide execution process';
  const stepsLabel = context.environment?.t('chat.turnProcessSteps', {
    count: presentation.processBlockCount,
  }) ?? `${presentation.processBlockCount} steps`;
  const title = !duration
    ? (presentation.isActive ? workingLabel : processedLabel)
    : presentation.isActive
      ? (elapsedMs >= 1_000 ? workingForLabel : workingLabel)
      : workedForLabel;
  const actionLabel = isExpanded ? collapseLabel : expandLabel;

  return (
    <section
      className={`flex w-full min-w-0 flex-col ${context.layout === 'sidebar' ? 'mb-1' : 'mb-4'}`}
      data-chat-turn-process="true"
      data-chat-turn-process-state={presentation.isActive ? 'active' : 'completed'}
      data-chat-turn-process-expanded={isExpanded ? 'true' : 'false'}
    >
      <button
        type="button"
        className="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1 p-0 text-left text-[13px] text-gray-400 transition-colors hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
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
        <span className="min-w-0 truncate text-gray-400 group-hover/activity-header:text-gray-200">{title}</span>
        <span className="shrink-0 text-gray-500">{stepsLabel}</span>
        <span className="flex size-4 shrink-0 items-center justify-center text-gray-500 opacity-0 transition-opacity group-hover/activity-header:opacity-100 group-focus-visible/activity-header:opacity-100">
          <ChevronRight
            size={12}
            aria-hidden="true"
            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </span>
      </button>

      {isExpanded ? (
        <div
          className="mt-2 flex max-h-56 flex-col gap-1 overflow-x-hidden overflow-y-auto"
          data-chat-turn-process-details="true"
        >
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
