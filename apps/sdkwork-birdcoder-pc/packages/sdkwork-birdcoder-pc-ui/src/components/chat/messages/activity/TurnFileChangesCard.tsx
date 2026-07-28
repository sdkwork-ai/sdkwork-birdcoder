import React, { memo, useId, useMemo } from 'react';
import { ChevronDown, ChevronUp, FileCode2, FileDiff, RotateCcw } from 'lucide-react';
import { hasRestorableFileChanges } from '@sdkwork/birdcoder-pc-workbench/workbench/fileChangeRestore';
import type { ChatMessageEnvironment } from '../types.ts';
import {
  resolveActivityFileChangeKey,
  resolveActivityFileChangeLineImpact,
} from './activityPresentation.ts';
import type { TurnFileChangesCardPresentation } from './turnFileChanges.ts';

export const TURN_FILE_CHANGES_PREVIEW_LIMIT = 3;

export interface TurnFileChangesCardProps {
  compact?: boolean;
  environment?: ChatMessageEnvironment | null;
  expandedDisclosureKeys: ReadonlySet<string>;
  presentation: TurnFileChangesCardPresentation;
  toggleDisclosure: (key: string) => void;
}

function splitFilePath(path: string): { fileName: string; parentPath: string } {
  const pathParts = path.replace(/\\/gu, '/').split('/').filter(Boolean);
  return {
    fileName: pathParts.at(-1) || path,
    parentPath: pathParts.slice(0, -1).join('/'),
  };
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
  const reviewLabel = environment?.t('chat.reviewChanges') ?? 'Review';
  const showMoreLabel = environment?.t('chat.showMoreFiles', { count: hiddenFileCount })
    ?? `Show ${hiddenFileCount} more file${hiddenFileCount === 1 ? '' : 's'}`;
  const showFewerLabel = environment?.t('chat.showFewerFiles') ?? 'Show fewer files';
  const openFileLabel = environment?.t('chat.openFileInEditor') ?? 'Open file in editor';
  const canUndo = Boolean(environment?.onRestore && hasRestorableFileChanges(fileChanges));
  const reviewFile = fileChanges.find((fileChange) => (
    fileChange.diff?.trim()
    || typeof fileChange.content === 'string'
    || typeof fileChange.originalContent === 'string'
  )) ?? fileChanges[0];

  return (
    <section
      aria-label={editedFilesLabel}
      className={`mt-4 w-full overflow-hidden border-y border-white/[0.07] bg-transparent ${
        compact ? 'text-xs' : 'text-sm'
      }`}
      data-chat-turn-file-changes="true"
    >
      <div className={`flex min-w-0 flex-wrap items-center gap-3 border-b border-white/[0.055] ${
        compact ? 'px-1 py-2.5' : 'px-0 py-3'
      }`}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center text-gray-500">
            <FileDiff size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-gray-200">{editedFilesLabel}</span>
            <span
              className="mt-0.5 flex items-center gap-1.5 font-mono text-[12px]"
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
          </span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {canUndo ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
              data-chat-turn-file-undo="true"
              title={undoLabel}
              onClick={() => environment?.onRestore?.(presentation.messageId, fileChanges)}
            >
              <span>{undoLabel}</span>
              <RotateCcw size={13} aria-hidden="true" />
            </button>
          ) : null}
          {environment?.onViewChanges && reviewFile ? (
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md border border-white/10 bg-white/[0.035] px-2.5 font-medium text-gray-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
              data-chat-turn-file-review="true"
              title={reviewLabel}
              onClick={() => environment.onViewChanges?.(reviewFile)}
            >
              {reviewLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div id={detailsId} data-chat-turn-file-list="true">
        {visibleFileChanges.map((fileChange, fileIndex) => {
          const { fileName, parentPath } = splitFilePath(fileChange.path);
          const lineImpact = lineImpacts[fileIndex] ?? resolveActivityFileChangeLineImpact(fileChange);
          return (
            <button
              type="button"
              key={resolveActivityFileChangeKey(fileChange, fileIndex)}
              className="group/file flex min-h-10 w-full min-w-0 items-center gap-2 border-b border-white/[0.045] px-1 text-left transition-colors last:border-b-0 hover:bg-white/[0.035] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-400/70"
              data-chat-file-change-row="turn-card"
              data-chat-file-open="true"
              aria-label={`${openFileLabel}: ${fileChange.path}`}
              title={`${openFileLabel}: ${fileChange.path}`}
              onClick={() => environment?.onOpenFile?.(fileChange.path)}
            >
              <FileCode2 size={14} className="shrink-0 text-gray-500 group-hover/file:text-sky-300" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 items-baseline gap-1 font-mono text-[12px]">
                {parentPath ? (
                  <span className="min-w-0 flex-1 truncate text-gray-500 max-[640px]:hidden">
                    {parentPath}/
                  </span>
                ) : null}
                <span className="max-w-[58%] shrink-0 truncate text-gray-200 group-hover/file:text-white max-[640px]:max-w-full max-[640px]:flex-1">
                  {fileName}
                </span>
              </span>
              {lineImpact.isKnown ? (
                <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px]">
                  <span className="text-emerald-300">+{lineImpact.additions}</span>
                  <span className="text-red-300">-{lineImpact.deletions}</span>
                </span>
              ) : (
                <span className="shrink-0 text-[10px] text-gray-500" title={changedLinesUnknownLabel}>?</span>
              )}
            </button>
          );
        })}
      </div>

      {hiddenFileCount > 0 ? (
        <button
          type="button"
          className="flex h-10 w-full items-center gap-2 px-1 text-left text-[12px] text-gray-400 transition-colors hover:bg-white/[0.035] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-400/70"
          data-chat-turn-file-toggle="true"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          onClick={() => toggleDisclosure(disclosureKey)}
        >
          <span>{isExpanded ? showFewerLabel : showMoreLabel}</span>
          {isExpanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        </button>
      ) : null}
    </section>
  );
});
