import { memo } from 'react';
import type { FileChange } from '@sdkwork/birdcoder-pc-contracts-commons';
import { DeferredDiffEditor } from './DeferredDiffEditor.tsx';
import {
  resolveDiffPreviewLineClassName,
  resolveDiffPreviewLineTone,
} from './fileChangePresentation.ts';

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
  if (typeof fileChange.originalContent === 'string' || typeof fileChange.content === 'string') {
    return (
      <div
        className="flex min-h-0 flex-1"
        aria-label={ariaLabel}
        data-chat-full-before-after-diff="true"
        role="region"
      >
        <DeferredDiffEditor
          language={language}
          original={fileChange.originalContent ?? ''}
          modified={fileChange.content ?? ''}
          readOnly={true}
          renderSideBySide={true}
        />
      </div>
    );
  }

  if (fileChange.diff?.trim()) {
    const diffLines = fileChange.diff.replace(/\r\n?/gu, '\n').split('\n');
    return (
      <pre
        className="min-h-0 flex-1 overflow-auto bg-[#0e0e11] py-3 font-mono text-[12px] leading-relaxed text-gray-300 whitespace-pre custom-scrollbar"
        data-chat-full-unified-diff="true"
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        {diffLines.map((line, lineIndex) => {
          const tone = resolveDiffPreviewLineTone(line);
          return (
            <span
              key={`${lineIndex}\u0001${line}`}
              className={`block min-w-max px-4 ${resolveDiffPreviewLineClassName(tone)}`}
              data-chat-full-diff-line-tone={tone}
            >
              {line || ' '}
              {lineIndex < diffLines.length - 1 ? '\n' : null}
            </span>
          );
        })}
      </pre>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-gray-400">
      {emptyLabel}
    </div>
  );
});
