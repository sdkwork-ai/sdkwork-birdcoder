import React, { memo } from 'react';
import { CheckCircle2, FileCode2, RotateCcw } from 'lucide-react';
import { hasRestorableFileChanges } from '@sdkwork/birdcoder-pc-workbench/workbench/fileChangeRestore';
import type { ActivityFileChange } from '../messageActivity.ts';
import type { ChatMessageEnvironment } from '../types.ts';
import { resolveActivityFileChangeKey } from './activityPresentation.ts';
import { FileChangeDisclosureRow } from './FileChangeDisclosureRow.tsx';

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

          return (
            <FileChangeDisclosureRow
              key={fileKey}
              compact={compact}
              detailsId={`${detailsIdPrefix}-file-${fileIndex}`}
              environment={environment}
              fileChange={fileChange}
              fileKey={fileKey}
              isExpanded={isExpanded}
              onToggle={() => toggleDisclosure(disclosureKey)}
              rowKind="inline"
            />
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-gray-500">
        <div className="flex min-w-0 items-center gap-1.5">
          <CheckCircle2 size={12} className="shrink-0 text-emerald-400/60" aria-hidden="true" />
          <span className="truncate">{changesAppliedLabel}</span>
        </div>
        {hasRestorableChanges && environment?.onRestore ? (
          <button
            type="button"
            className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
            title={restoreLabel}
            onClick={() => environment.onRestore?.(messageId, fileChanges)}
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>{restoreLabel}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
});
