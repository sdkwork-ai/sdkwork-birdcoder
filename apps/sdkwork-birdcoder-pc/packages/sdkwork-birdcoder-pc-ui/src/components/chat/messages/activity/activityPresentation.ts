import type { FileChange } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import {
  buildChatContentPreview,
  buildChatLinePreview,
  MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
} from '../contentPreview.ts';
import type { ActivityFileChange } from '../messageActivity.ts';
import type { ChatMessageTranslate } from '../types.ts';

export const MAX_ACTIVITY_DIFF_PREVIEW_LINES = 80;
export const MAX_ACTIVITY_CONTENT_PREVIEW_LINES = 60;
export const MAX_ACTIVITY_PREVIEW_CHARACTERS = MAX_CHAT_CONTENT_PREVIEW_CHARACTERS;

export type ActivityDiffPreviewLineTone = 'addition' | 'deletion' | 'hunk' | 'meta' | 'context';

export interface ActivityDiffPreviewLine {
  marker: string;
  text: string;
  tone: ActivityDiffPreviewLineTone;
}

export interface ActivityDiffPreview {
  isFallback: boolean;
  isTruncated: boolean;
  lines: ActivityDiffPreviewLine[];
}

export interface ActivityFileChangeLineImpact {
  additions: number;
  deletions: number;
  isKnown: boolean;
}

function normalizeActivityLineCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function resolveActivityFileChangeStatusLabel(
  fileChange: ActivityFileChange,
  t?: ChatMessageTranslate,
): string {
  const updateStatus = fileChange.updateStatus?.trim() ?? '';
  if (!updateStatus) {
    return '';
  }

  const movedFromMatch = /^moved from\s+(.+)$/iu.exec(updateStatus);
  if (movedFromMatch?.[1]) {
    return t?.('chat.fileOperationMovedFrom', { path: movedFromMatch[1] })
      ?? `Moved from ${movedFromMatch[1]}`;
  }

  const operationLabels: Readonly<Record<string, string>> = {
    '??': t?.('chat.fileOperationCreated') ?? 'Created',
    A: t?.('chat.fileOperationCreated') ?? 'Created',
    D: t?.('chat.fileOperationDeleted') ?? 'Deleted',
    M: t?.('chat.fileOperationModified') ?? 'Modified',
    R: t?.('chat.fileOperationMoved') ?? 'Moved',
  };
  if (operationLabels[updateStatus]) {
    return operationLabels[updateStatus];
  }
  if (/^[A-Z?]{1,2}$/u.test(updateStatus)) {
    return t?.('chat.fileOperationUpdated') ?? 'Updated';
  }

  return buildChatContentPreview(updateStatus, {
    maxCharacters: 160,
    tailCharacters: 0,
  }).text;
}

function resolveDiffPreviewLineTone(line: string): ActivityDiffPreviewLineTone {
  if (line.startsWith('+++') || line.startsWith('---')) {
    return 'meta';
  }
  if (line.startsWith('+')) {
    return 'addition';
  }
  if (line.startsWith('-')) {
    return 'deletion';
  }
  if (line.startsWith('@@')) {
    return 'hunk';
  }
  if (
    line.startsWith('diff --git')
    || line.startsWith('index ')
    || line.startsWith('new file ')
    || line.startsWith('deleted file ')
  ) {
    return 'meta';
  }
  return 'context';
}

function buildActivityDiffPreviewLine(line: string): ActivityDiffPreviewLine {
  const tone = resolveDiffPreviewLineTone(line);
  if (tone === 'addition') {
    return { marker: '+', text: line.slice(1), tone };
  }
  if (tone === 'deletion') {
    return { marker: '-', text: line.slice(1), tone };
  }
  if (tone === 'hunk') {
    return { marker: '@', text: line, tone };
  }
  return { marker: ' ', text: line, tone };
}

function buildFileChangeContentPreview(fileChange: FileChange): ActivityDiffPreview {
  const previewLines: ActivityDiffPreviewLine[] = [];
  const originalContent = typeof fileChange.originalContent === 'string'
    ? fileChange.originalContent
    : '';
  const content = typeof fileChange.content === 'string' ? fileChange.content : '';
  const halfPreviewLimit = Math.max(1, Math.floor(MAX_ACTIVITY_CONTENT_PREVIEW_LINES / 2));
  const halfPreviewCharacterLimit = Math.max(
    1,
    Math.floor(MAX_ACTIVITY_PREVIEW_CHARACTERS / 2),
  );
  let isTruncated = false;

  if (originalContent) {
    previewLines.push({ marker: ' ', text: `--- ${fileChange.path}`, tone: 'meta' });
    const originalPreview = buildChatLinePreview(originalContent, {
      maxCharacters: content ? halfPreviewCharacterLimit : MAX_ACTIVITY_PREVIEW_CHARACTERS,
      maxLines: content ? halfPreviewLimit : MAX_ACTIVITY_CONTENT_PREVIEW_LINES,
    });
    isTruncated = isTruncated || originalPreview.isTruncated;
    for (const line of originalPreview.lines) {
      previewLines.push({ marker: '-', text: line, tone: 'deletion' });
    }
  }

  if (content) {
    previewLines.push({ marker: ' ', text: `+++ ${fileChange.path}`, tone: 'meta' });
    const contentPreview = buildChatLinePreview(content, {
      maxCharacters: originalContent
        ? halfPreviewCharacterLimit
        : MAX_ACTIVITY_PREVIEW_CHARACTERS,
      maxLines: originalContent ? halfPreviewLimit : MAX_ACTIVITY_CONTENT_PREVIEW_LINES,
    });
    isTruncated = isTruncated || contentPreview.isTruncated;
    for (const line of contentPreview.lines) {
      previewLines.push({ marker: '+', text: line, tone: 'addition' });
    }
  }

  return { isFallback: true, isTruncated, lines: previewLines };
}

export function buildFileChangeDiffPreview(fileChange: FileChange): ActivityDiffPreview {
  const diffContent = typeof fileChange.diff === 'string' ? fileChange.diff.trim() : '';
  if (!diffContent) {
    return buildFileChangeContentPreview(fileChange);
  }

  const diffPreview = buildChatLinePreview(diffContent, {
    maxCharacters: MAX_ACTIVITY_PREVIEW_CHARACTERS,
    maxLines: MAX_ACTIVITY_DIFF_PREVIEW_LINES,
  });
  return {
    isFallback: false,
    isTruncated: diffPreview.isTruncated,
    lines: diffPreview.lines.map(buildActivityDiffPreviewLine),
  };
}

export function resolveActivityFileChangeKey(fileChange: FileChange, index: number): string {
  return JSON.stringify([index, fileChange.path.trim().replace(/\\/gu, '/')]);
}

export function countDiffLineImpacts(
  diff: string | undefined,
): ActivityFileChangeLineImpact | null {
  if (!diff?.trim()) {
    return null;
  }

  let additions = 0;
  let deletions = 0;
  const normalizedDiff = diff.replace(/\r\n?/gu, '\n');
  let lineStart = 0;
  while (lineStart <= normalizedDiff.length) {
    const lineEnd = normalizedDiff.indexOf('\n', lineStart);
    const line = normalizedDiff.slice(
      lineStart,
      lineEnd === -1 ? normalizedDiff.length : lineEnd,
    );
    if (line.startsWith('+++') || line.startsWith('---')) {
      // Diff metadata does not contribute to the line impact.
    } else if (line.startsWith('+')) {
      additions += 1;
    } else if (line.startsWith('-')) {
      deletions += 1;
    }
    if (lineEnd === -1) {
      break;
    }
    lineStart = lineEnd + 1;
  }

  return additions === 0 && deletions === 0
    ? null
    : { additions, deletions, isKnown: true };
}

export function resolveActivityFileChangeLineImpact(
  fileChange: ActivityFileChange,
): ActivityFileChangeLineImpact {
  const additions = normalizeActivityLineCount(fileChange.additions);
  const deletions = normalizeActivityLineCount(fileChange.deletions);
  if (additions > 0 || deletions > 0) {
    return { additions, deletions, isKnown: true };
  }

  const diffLineImpact = countDiffLineImpacts(fileChange.diff);
  if (diffLineImpact) {
    return diffLineImpact;
  }

  return {
    additions,
    deletions,
    isKnown: fileChange.lineImpactKnown !== false,
  };
}

export function resolveDiffPreviewLineClassName(tone: ActivityDiffPreviewLineTone): string {
  if (tone === 'addition') {
    return 'bg-emerald-500/10 text-emerald-200';
  }
  if (tone === 'deletion') {
    return 'bg-red-500/10 text-red-200';
  }
  if (tone === 'hunk') {
    return 'bg-sky-500/10 text-sky-200';
  }
  if (tone === 'meta') {
    return 'text-gray-500';
  }
  return 'text-gray-300';
}

export function revealChatActivityDetails(detailsId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.requestAnimationFrame(() => {
    document.getElementById(detailsId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}
