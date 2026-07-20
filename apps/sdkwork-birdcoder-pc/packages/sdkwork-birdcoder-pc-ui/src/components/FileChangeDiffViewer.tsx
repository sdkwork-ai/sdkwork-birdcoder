import { memo } from 'react';
import type { FileChange } from '@sdkwork/birdcoder-pc-contracts-commons';
import { DeferredDiffEditor } from './DeferredDiffEditor.tsx';

export interface FileChangeDiffViewerProps {
  ariaLabel: string;
  emptyLabel: string;
  fileChange: FileChange;
  language: string;
}

export const FileChangeDiffViewer = memo(function FileChangeDiffViewer({
  ariaLabel,
  emptyLabel,
  fileChange,
  language,
}: FileChangeDiffViewerProps) {
  if (fileChange.diff?.trim()) {
    return (
      <pre
        className="min-h-0 flex-1 overflow-auto bg-[#0e0e11] p-4 font-mono text-[12px] leading-relaxed text-gray-300 whitespace-pre custom-scrollbar"
        data-chat-full-unified-diff="true"
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        {fileChange.diff}
      </pre>
    );
  }

  if (typeof fileChange.originalContent === 'string' || typeof fileChange.content === 'string') {
    return (
      <DeferredDiffEditor
        language={language}
        original={fileChange.originalContent ?? ''}
        modified={fileChange.content ?? ''}
        readOnly={true}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-gray-400">
      {emptyLabel}
    </div>
  );
});
