import React, { memo, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileCode2,
} from 'lucide-react';
import type { FileChange } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageEnvironment } from '../types.ts';
import { revealChatDisclosureDetails } from '../revealChatDisclosureDetails.ts';
import {
  buildFileChangeDiffPreview,
  resolveActivityFileChangeLineImpact,
  resolveActivityFileChangeStatusLabel,
  resolveDiffPreviewLineClassName,
} from './activityPresentation.ts';

export type FileChangeDisclosureRowKind = 'inline' | 'turn-card';

export interface FileChangeDisclosureRowProps {
  compact: boolean;
  detailsId: string;
  environment?: ChatMessageEnvironment | null;
  fileChange: FileChange;
  fileKey: string;
  isExpanded: boolean;
  onToggle: () => void;
  rowKind: FileChangeDisclosureRowKind;
}

function splitFilePath(path: string): { fileName: string; parentPath: string } {
  const pathParts = path.replace(/\\/gu, '/').split('/').filter(Boolean);
  return {
    fileName: pathParts.at(-1) || path,
    parentPath: pathParts.slice(0, -1).join('/'),
  };
}

export const FileChangeDisclosureRow = memo(function FileChangeDisclosureRow({
  compact,
  detailsId,
  environment,
  fileChange,
  fileKey,
  isExpanded,
  onToggle,
  rowKind,
}: FileChangeDisclosureRowProps) {
  const pathParts = useMemo(() => splitFilePath(fileChange.path), [fileChange.path]);
  const diffPreview = useMemo(
    () => (isExpanded ? buildFileChangeDiffPreview(fileChange) : null),
    [fileChange, isExpanded],
  );
  const lineImpact = useMemo(
    () => resolveActivityFileChangeLineImpact(fileChange),
    [fileChange],
  );
  const updateStatusLabel = resolveActivityFileChangeStatusLabel(fileChange, environment?.t);
  const hasDiffEvidence = Boolean(
    fileChange.diff?.trim()
    || typeof fileChange.content === 'string'
    || typeof fileChange.originalContent === 'string',
  );
  const toggleDiffPreviewLabel = environment?.t('chat.toggleDiffPreview') ?? 'Toggle diff preview';
  const openFullDiffLabel = environment?.t('chat.openFullDiff') ?? 'Open full diff';
  const openFileInEditorLabel = environment?.t('chat.openFileInEditor') ?? 'Open file in editor';
  const diffPreviewLabel = environment?.t('chat.diffPreview') ?? 'Diff preview';
  const noInlineDiffLabel = environment?.t('chat.noInlineDiff') ?? 'No inline diff available';
  const lineImpactUnknownLabel = environment?.t('chat.changedLinesUnknown')
    ?? 'Line impact not captured';
  const contentPreviewFallbackLabel = environment?.t('chat.contentPreviewFallback')
    ?? 'content preview';
  const toggleDetails = () => {
    onToggle();
    if (!isExpanded) {
      revealChatDisclosureDetails(detailsId);
    }
  };

  return (
    <div
      className={rowKind === 'turn-card' ? 'border-b border-white/[0.045] last:border-b-0' : 'overflow-hidden'}
      data-chat-file-change-item="true"
    >
      <div
        data-chat-file-change-row={rowKind}
        className={`flex h-9 w-full min-w-0 items-center gap-1 transition-colors hover:bg-white/[0.035] ${
          rowKind === 'turn-card' ? 'px-0.5' : 'rounded-md px-1.5'
        }`}
      >
        <button
          type="button"
          data-chat-file-disclosure="true"
          className="group/file flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          aria-label={`${toggleDiffPreviewLabel}: ${fileChange.path}`}
          title={`${toggleDiffPreviewLabel}: ${fileChange.path}`}
          onClick={toggleDetails}
        >
          <span className="flex h-7 w-5 shrink-0 items-center justify-center text-gray-500 transition-colors group-hover/file:text-gray-300">
            {isExpanded
              ? <ChevronDown size={14} aria-hidden="true" />
              : <ChevronRight size={14} aria-hidden="true" />}
          </span>
          <span className="flex min-w-0 flex-1 items-baseline font-mono text-[12px]">
            {pathParts.parentPath ? (
              <>
                <span className="min-w-0 max-w-[45%] shrink truncate text-right text-gray-500 [direction:rtl]">
                  <span className="[direction:ltr]">{pathParts.parentPath}</span>
                </span>
                <span className="shrink-0 text-gray-500">/</span>
              </>
            ) : null}
            <span className="min-w-0 flex-1 truncate font-medium text-gray-200 group-hover/file:text-white">
              {pathParts.fileName}
            </span>
          </span>
          {updateStatusLabel && !compact ? (
            <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 max-[760px]:hidden">
              {updateStatusLabel}
            </span>
          ) : null}
          {lineImpact.isKnown ? (
            <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] tabular-nums">
              <span className="text-emerald-300">+{lineImpact.additions}</span>
              <span className="text-red-300">-{lineImpact.deletions}</span>
            </span>
          ) : (
            <span
              className="shrink-0 text-[10px] text-gray-500"
              aria-label={lineImpactUnknownLabel}
              title={lineImpactUnknownLabel}
            >
              ?
            </span>
          )}
        </button>

        {environment?.onOpenFile ? (
          <button
            type="button"
            data-chat-file-open="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
            title={`${openFileInEditorLabel}: ${fileChange.path}`}
            aria-label={`${openFileInEditorLabel}: ${fileChange.path}`}
            onClick={() => environment.onOpenFile?.(fileChange.path)}
          >
            <FileCode2 size={13} aria-hidden="true" />
          </button>
        ) : null}

        {environment?.onViewChanges && hasDiffEvidence ? (
          <button
            type="button"
            data-chat-file-diff="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
            title={`${openFullDiffLabel}: ${fileChange.path}`}
            aria-label={`${openFullDiffLabel}: ${fileChange.path}`}
            onClick={() => environment.onViewChanges?.(fileChange)}
          >
            <Eye size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {isExpanded && diffPreview ? (
        <div
          id={detailsId}
          data-chat-file-inline-diff="true"
          data-chat-file-before-after={diffPreview.isFallback ? 'true' : undefined}
          className={rowKind === 'turn-card' ? 'pb-3 pl-7 pr-1 pt-1' : 'px-7 pb-2 pt-1'}
        >
          <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-gray-500">{diffPreviewLabel}</span>
            {diffPreview.isFallback && diffPreview.lines.length > 0 ? (
              <span className="shrink-0 text-[10px] text-gray-400/80">
                {contentPreviewFallbackLabel}
              </span>
            ) : null}
          </div>
          {diffPreview.lines.length > 0 ? (
            <div
              className="max-h-80 min-w-0 overflow-auto bg-black/20 py-2 font-mono text-[11px] leading-relaxed custom-scrollbar"
              role="region"
              aria-label={`${diffPreviewLabel}: ${fileChange.path}`}
              tabIndex={0}
            >
              {diffPreview.lines.map((line, lineIndex) => (
                <div
                  key={`${fileKey}\u0001${lineIndex}`}
                  className={`grid min-w-max grid-cols-[2rem_minmax(0,1fr)] gap-2 px-2 ${resolveDiffPreviewLineClassName(line.tone)}`}
                >
                  <span className="select-none text-right text-gray-500">{line.marker}</span>
                  <span className="min-w-0 whitespace-pre-wrap break-words">{line.text || ' '}</span>
                </div>
              ))}
              {diffPreview.isTruncated ? (
                <div className="px-2 pt-1 text-[11px] text-gray-500">...</div>
              ) : null}
            </div>
          ) : (
            <div className="bg-white/[0.025] px-2 py-2 text-[11px] text-gray-500">
              {noInlineDiffLabel}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
});
