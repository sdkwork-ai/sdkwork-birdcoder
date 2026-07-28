import React, { memo, useId, useMemo } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { hasRestorableFileChanges } from '@sdkwork/birdcoder-pc-workbench/workbench/fileChangeRestore';
import type { ChatMessageEnvironment } from '../types.ts';
import {
  resolveActivityFileChangeKey,
  resolveActivityFileChangeLineImpact,
} from './activityPresentation.ts';
import { FileChangeDisclosureRow } from './FileChangeDisclosureRow.tsx';
import type { TurnFileChangesCardPresentation } from './turnFileChanges.ts';

export const TURN_FILE_CHANGES_PREVIEW_LIMIT = 10;

export interface TurnFileChangesCardProps {
  compact?: boolean;
  environment?: ChatMessageEnvironment | null;
  expandedDisclosureKeys: ReadonlySet<string>;
  presentation: TurnFileChangesCardPresentation;
  toggleDisclosure: (key: string) => void;
}

export const TurnFileChangesCard = memo(function TurnFileChangesCard({
  compact = false,
  environment,
  expandedDisclosureKeys,
  presentation,
  toggleDisclosure,
}: TurnFileChangesCardProps) {
  const detailsId = useId();
  const fileChanges = presentation.fileChanges;
  const disclosureKey = `${presentation.scopeKey}\u0001turn-file-changes`;
  const isExpanded = expandedDisclosureKeys.has(disclosureKey);
  const lineImpacts = useMemo(
    () => fileChanges.map(resolveActivityFileChangeLineImpact),
    [fileChanges],
  );
  const knownLineImpacts = lineImpacts.filter((lineImpact) => lineImpact.isKnown);
  const additions = knownLineImpacts.reduce((total, lineImpact) => total + lineImpact.additions, 0);
  const deletions = knownLineImpacts.reduce((total, lineImpact) => total + lineImpact.deletions, 0);
  const hasCompleteLineImpact = knownLineImpacts.length === fileChanges.length;
  const hiddenFileCount = Math.max(0, fileChanges.length - TURN_FILE_CHANGES_PREVIEW_LIMIT);
  const visibleFileChanges = isExpanded
    ? fileChanges
    : fileChanges.slice(0, TURN_FILE_CHANGES_PREVIEW_LIMIT);
  const editedFilesLabel = environment?.t('chat.editedFilesSummary', { count: fileChanges.length })
    ?? `Edited ${fileChanges.length} file${fileChanges.length === 1 ? '' : 's'}`;
  const changedLinesUnknownLabel = environment?.t('chat.changedLinesUnknown')
    ?? 'Line impact not captured';
  const undoLabel = environment?.t('chat.undoChanges') ?? 'Undo';
  const showMoreLabel = environment?.t('chat.showMoreFiles', { count: hiddenFileCount })
    ?? `Show ${hiddenFileCount} more file${hiddenFileCount === 1 ? '' : 's'}`;
  const showFewerLabel = environment?.t('chat.showFewerFiles') ?? 'Show fewer files';
  const canUndo = Boolean(environment?.onRestore && hasRestorableFileChanges(fileChanges));

  return (
    <section
      aria-label={editedFilesLabel}
      className={`mt-4 w-full min-w-0 border-t border-white/[0.07] bg-transparent ${
        compact ? 'text-xs' : 'text-sm'
      }`}
      data-chat-turn-file-changes="true"
      data-chat-turn-file-count={fileChanges.length}
      data-chat-turn-file-show-all={isExpanded ? 'true' : undefined}
    >
      <div className="flex min-h-11 min-w-0 items-center gap-2 border-b border-white/[0.055] py-2">
        <span className="min-w-0 truncate text-[13px] font-medium text-gray-200 tabular-nums">
          {editedFilesLabel}
        </span>
        <span
          className="flex shrink-0 items-center gap-1.5 font-mono text-[12px] tabular-nums"
          data-chat-turn-file-impact="true"
          title={hasCompleteLineImpact ? undefined : changedLinesUnknownLabel}
        >
          {hasCompleteLineImpact ? (
            <>
              <span className="text-emerald-300">+{additions}</span>
              <span className="text-red-300">-{deletions}</span>
            </>
          ) : (
            <span className="font-sans text-[11px] text-gray-500">{changedLinesUnknownLabel}</span>
          )}
        </span>
        <span className="min-w-0 flex-1" aria-hidden="true" />
        {hiddenFileCount > 0 ? (
          <button
            type="button"
            className="shrink-0 rounded-md px-1.5 py-1 text-[12px] text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
            data-chat-turn-file-toggle="true"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            onClick={() => toggleDisclosure(disclosureKey)}
          >
            <span className="max-[640px]:sr-only">{isExpanded ? showFewerLabel : showMoreLabel}</span>
            {isExpanded
              ? <ChevronUp size={15} aria-hidden="true" />
              : <ChevronDown size={15} aria-hidden="true" />}
          </button>
        ) : null}
        {canUndo ? (
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
            data-chat-turn-file-undo="true"
            title={undoLabel}
            aria-label={undoLabel}
            onClick={() => environment?.onRestore?.(presentation.messageId, fileChanges)}
          >
            <RotateCcw size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div id={detailsId} data-chat-turn-file-list="true">
        {visibleFileChanges.map((fileChange, fileIndex) => {
          const fileKey = resolveActivityFileChangeKey(fileChange, fileIndex);
          const fileDisclosureKey = `${presentation.scopeKey}\u0001turn-file\u0001${fileKey}`;
          return (
            <FileChangeDisclosureRow
              key={fileKey}
              compact={compact}
              detailsId={`${detailsId}-file-${fileIndex}`}
              environment={environment}
              fileChange={fileChange}
              fileKey={fileKey}
              isExpanded={expandedDisclosureKeys.has(fileDisclosureKey)}
              onToggle={() => toggleDisclosure(fileDisclosureKey)}
              rowKind="turn-card"
            />
          );
        })}
      </div>
    </section>
  );
});
