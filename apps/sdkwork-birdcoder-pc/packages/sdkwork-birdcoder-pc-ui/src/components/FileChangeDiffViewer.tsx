import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_FILE_CHANGE_TEXT_CHARACTERS,
  type FileChange,
} from '@sdkwork/birdcoder-pc-contracts-commons';
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

const MAX_RENDERED_UNIFIED_DIFF_LINES = 20_000;

export function readBoundedUnifiedDiffLines(diff: string): {
  lines: string[];
  truncated: boolean;
} {
  if (diff.length > MAX_FILE_CHANGE_TEXT_CHARACTERS) {
    return { lines: [], truncated: true };
  }

  const lines: string[] = [];
  let lineStart = 0;
  while (lineStart <= diff.length && lines.length < MAX_RENDERED_UNIFIED_DIFF_LINES) {
    const lineFeedIndex = diff.indexOf('\n', lineStart);
    const lineEnd = lineFeedIndex < 0 ? diff.length : lineFeedIndex;
    const contentEnd = lineEnd > lineStart && diff.charCodeAt(lineEnd - 1) === 13
      ? lineEnd - 1
      : lineEnd;
    lines.push(diff.slice(lineStart, contentEnd));
    if (lineFeedIndex < 0) {
      return { lines, truncated: false };
    }
    lineStart = lineFeedIndex + 1;
  }
  return { lines, truncated: lineStart <= diff.length };
}

export const FileChangeDiffViewer = memo(function FileChangeDiffViewer({
  ariaLabel,
  emptyLabel,
  fileChange,
  language,
}: FileChangeDiffViewerProps) {
  const { t } = useTranslation();
  const hasBeforeAfterContent = (
    typeof fileChange.originalContent === 'string'
    || typeof fileChange.content === 'string'
  );
  const hasOversizedBeforeAfterContent = (
    (fileChange.originalContent?.length ?? 0) > MAX_FILE_CHANGE_TEXT_CHARACTERS
    || (fileChange.content?.length ?? 0) > MAX_FILE_CHANGE_TEXT_CHARACTERS
  );
  if (hasBeforeAfterContent && !hasOversizedBeforeAfterContent) {
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

  const unifiedDiff = fileChange.diff;
  const hasUnifiedDiff = typeof unifiedDiff === 'string' && (
    unifiedDiff.length > MAX_FILE_CHANGE_TEXT_CHARACTERS
    || Boolean(unifiedDiff.trim())
  );
  if (hasUnifiedDiff && !hasOversizedBeforeAfterContent) {
    const diffPreview = readBoundedUnifiedDiffLines(unifiedDiff);
    return (
      <pre
        className="min-h-0 flex-1 overflow-auto bg-[#0e0e11] py-3 font-mono text-[12px] leading-relaxed text-gray-300 whitespace-pre custom-scrollbar"
        data-chat-full-unified-diff="true"
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        {diffPreview.lines.map((line, lineIndex) => {
          const tone = resolveDiffPreviewLineTone(line);
          return (
            <span
              key={`${lineIndex}\u0001${line}`}
              className={`block min-w-max px-4 ${resolveDiffPreviewLineClassName(tone)}`}
              data-chat-full-diff-line-tone={tone}
            >
              {line || ' '}
              {lineIndex < diffPreview.lines.length - 1 || diffPreview.truncated ? '\n' : null}
            </span>
          );
        })}
        {diffPreview.truncated ? (
          <span className="block min-w-max border-t border-white/10 px-4 py-2 text-gray-400">
            {t('chat.fileDiffTruncated')}
          </span>
        ) : null}
      </pre>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-gray-400">
      {hasOversizedBeforeAfterContent ? t('chat.fileDiffTruncated') : emptyLabel}
    </div>
  );
});
