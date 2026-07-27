import React, { memo, useMemo } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileCode2,
  RotateCcw,
} from 'lucide-react';
import { hasRestorableFileChanges } from '@sdkwork/birdcoder-pc-workbench/workbench/fileChangeRestore';
import type { ActivityFileChange } from '../messageActivity.ts';
import type { ChatMessageEnvironment } from '../types.ts';
import {
  buildFileChangeDiffPreview,
  resolveActivityFileChangeKey,
  resolveActivityFileChangeLineImpact,
  resolveActivityFileChangeStatusLabel,
  resolveDiffPreviewLineClassName,
} from './activityPresentation.ts';
import { revealChatDisclosureDetails } from '../revealChatDisclosureDetails.ts';

export interface ChatFileActivityListProps {
  compact: boolean;
  detailsIdPrefix: string;
  disclosureScopeKey: string;
  environment?: ChatMessageEnvironment | null;
  expandedDisclosureKeys: ReadonlySet<string>;
  fileChanges: readonly ActivityFileChange[];
  messageId: string;
  sectionLabel: string;
  toggleDisclosure: (key: string) => void;
}

function splitActivityFilePath(path: string): { fileName: string; parentPath: string } {
  const parts = path.replace(/\\/gu, '/').split('/').filter(Boolean);
  return {
    fileName: parts.at(-1) || path,
    parentPath: parts.slice(0, -1).join('/'),
  };
}

export const ChatFileActivityList = memo(function ChatFileActivityList({
  compact,
  detailsIdPrefix,
  disclosureScopeKey,
  environment,
  expandedDisclosureKeys,
  fileChanges,
  messageId,
  sectionLabel,
  toggleDisclosure,
}: ChatFileActivityListProps) {
  const lineImpacts = useMemo(
    () => fileChanges.map(resolveActivityFileChangeLineImpact),
    [fileChanges],
  );
  const toggleDiffPreviewLabel = environment?.t('chat.toggleDiffPreview') ?? 'Toggle diff preview';
  const openFullDiffLabel = environment?.t('chat.openFullDiff') ?? 'Open full diff';
  const openFileInEditorLabel = environment?.t('chat.openFileInEditor') ?? 'Open file in editor';
  const diffPreviewLabel = environment?.t('chat.diffPreview') ?? 'Diff preview';
  const noInlineDiffLabel = environment?.t('chat.noInlineDiff') ?? 'No inline diff available';
  const lineImpactUnknownLabel = environment?.t('chat.changedLinesUnknown')
    ?? 'Line impact not captured';
  const changesAppliedLabel = environment?.t('chat.changesApplied') ?? 'Changes applied';
  const restoreLabel = environment?.t('chat.restoreChanges') ?? 'Restore';
  const hasRestorableChanges = hasRestorableFileChanges(fileChanges);

  return (
    <section aria-label={sectionLabel}>
      <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium text-gray-500">
        <FileCode2 size={12} aria-hidden="true" />
        <span>{sectionLabel}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {fileChanges.map((fileChange, fileIndex) => {
          const fileKey = resolveActivityFileChangeKey(fileChange, fileIndex);
          const disclosureKey = `${disclosureScopeKey}\u0001file\u0001${fileKey}`;
          const isExpanded = expandedDisclosureKeys.has(disclosureKey);
          const detailsId = `${detailsIdPrefix}-file-${fileIndex}`;
          const pathParts = splitActivityFilePath(fileChange.path);
          const updateStatusLabel = resolveActivityFileChangeStatusLabel(fileChange, environment?.t);
          const diffPreview = isExpanded ? buildFileChangeDiffPreview(fileChange) : null;
          const lineImpact = lineImpacts[fileIndex]
            ?? resolveActivityFileChangeLineImpact(fileChange);
          const hasFullDiff = Boolean(
            fileChange.diff?.trim()
            || typeof fileChange.content === 'string'
            || typeof fileChange.originalContent === 'string',
          );
          const toggleDetails = () => {
            toggleDisclosure(disclosureKey);
            if (!isExpanded) revealChatDisclosureDetails(detailsId);
          };

          return (
            <div key={fileKey} className="overflow-hidden">
              <div
                data-chat-file-change-row="inline"
                className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/[0.035]"
              >
                <button
                  type="button"
                  data-chat-file-disclosure="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                  aria-expanded={isExpanded}
                  aria-controls={detailsId}
                  aria-label={`${toggleDiffPreviewLabel}: ${fileChange.path}`}
                  title={toggleDiffPreviewLabel}
                  onClick={toggleDetails}
                >
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                <button
                  type="button"
                  data-chat-file-open="true"
                  className="group/file flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                  title={`${environment?.onOpenFile ? openFileInEditorLabel : toggleDiffPreviewLabel}: ${fileChange.path}`}
                  aria-label={`${environment?.onOpenFile ? openFileInEditorLabel : toggleDiffPreviewLabel}: ${fileChange.path}`}
                  aria-expanded={environment?.onOpenFile ? undefined : isExpanded}
                  aria-controls={environment?.onOpenFile ? undefined : detailsId}
                  onClick={() => {
                    if (environment?.onOpenFile) {
                      environment.onOpenFile(fileChange.path);
                    } else {
                      toggleDetails();
                    }
                  }}
                >
                  <FileCode2 size={13} className="shrink-0 text-sky-300/80 max-[760px]:hidden" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-gray-300 group-hover/file:text-sky-100 max-[900px]:hidden">
                    {fileChange.path}
                  </span>
                  <span className="hidden min-w-0 flex-1 flex-col items-start font-mono text-gray-200 group-hover/file:text-sky-100 max-[900px]:flex">
                    <span className="block w-full truncate text-[12px]">{pathParts.fileName}</span>
                    {pathParts.parentPath ? (
                      <span className="block w-full truncate text-[10px] text-gray-500">
                        {pathParts.parentPath}
                      </span>
                    ) : null}
                  </span>
                </button>
                {updateStatusLabel && !compact ? (
                  <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 max-[900px]:hidden">
                    {updateStatusLabel}
                  </span>
                ) : null}
                {lineImpact.isKnown ? (
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[11px]">
                    <span className="text-emerald-300">+{lineImpact.additions}</span>
                    <span className="text-red-300">-{lineImpact.deletions}</span>
                  </span>
                ) : (
                  <span
                    className="shrink-0 rounded bg-white/[0.025] px-1.5 py-0.5 text-[10px] text-gray-500"
                    aria-label={lineImpactUnknownLabel}
                    title={lineImpactUnknownLabel}
                  >
                    {compact ? '?' : <span className="max-[760px]:sr-only">{lineImpactUnknownLabel}</span>}
                  </span>
                )}
                {environment?.onViewChanges && hasFullDiff ? (
                  <button
                    type="button"
                    data-chat-file-diff="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                    title={`${openFullDiffLabel}: ${fileChange.path}`}
                    aria-label={`${openFullDiffLabel}: ${fileChange.path}`}
                    onClick={() => environment.onViewChanges?.(fileChange)}
                  >
                    <Eye size={12} />
                  </button>
                ) : null}
              </div>

              {isExpanded && diffPreview ? (
                <div id={detailsId} data-chat-file-inline-diff="true" className="px-7 pb-2 pt-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-gray-500">{diffPreviewLabel}</span>
                    {diffPreview.isFallback && diffPreview.lines.length > 0 ? (
                      <span className="text-[10px] text-gray-400/80">
                        {environment?.t('chat.contentPreviewFallback') ?? 'content preview'}
                      </span>
                    ) : null}
                  </div>
                  {diffPreview.lines.length > 0 ? (
                    <div
                      className="max-h-72 overflow-auto rounded-md bg-black/20 py-2 font-mono text-[11px] leading-relaxed custom-scrollbar"
                      role="region"
                      aria-label={`${diffPreviewLabel}: ${fileChange.path}`}
                      tabIndex={0}
                    >
                      {diffPreview.lines.map((line, lineIndex) => (
                        <div
                          key={`${fileKey}\u0001${lineIndex}`}
                          className={`grid grid-cols-[2rem_1fr] gap-2 px-2 ${resolveDiffPreviewLineClassName(line.tone)}`}
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
                    <div className="rounded-md bg-white/[0.025] px-2 py-2 text-[11px] text-gray-500">
                      {noInlineDiffLabel}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-gray-500">
        <div className="flex min-w-0 items-center gap-1.5">
          <CheckCircle2 size={12} className="shrink-0 text-emerald-400/60" />
          <span className="truncate">{changesAppliedLabel}</span>
        </div>
        {hasRestorableChanges && environment?.onRestore ? (
          <button
            type="button"
            className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
            title={restoreLabel}
            onClick={() => environment.onRestore?.(messageId, fileChanges)}
          >
            <RotateCcw size={12} />
            <span>{restoreLabel}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
});
