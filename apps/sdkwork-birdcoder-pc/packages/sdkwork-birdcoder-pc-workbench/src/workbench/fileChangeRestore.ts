import type { FileChange } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface FileChangeWriteRestoreOperation {
  content: string;
  path: string;
  type: 'write';
}

export interface FileChangeReversePatchRestoreOperation {
  diff: string;
  path: string;
  type: 'reverse-patch';
}

export type FileChangeRestoreOperation =
  | FileChangeReversePatchRestoreOperation
  | FileChangeWriteRestoreOperation;

export interface FileChangeRestorePlan {
  fileChanges: FileChange[];
  operations: FileChangeRestoreOperation[];
  restorable: boolean;
}

function normalizeFileChangePath(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

interface ReversePatchHunk {
  currentLines: string[];
  newStart: number;
  originalLines: string[];
}

interface ReversePatch {
  hunks: ReversePatchHunk[];
  oldEndsWithNewline?: boolean;
}

function parseReversePatch(diff: string): ReversePatch | null {
  const lines = diff.replace(/\r\n?/gu, '\n').split('\n');
  const hunks: ReversePatchHunk[] = [];
  let oldEndsWithNewline: boolean | undefined;
  let previousPrefix = '';
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;
    if (line.startsWith('diff --git') && hunks.length > 0) {
      return null;
    }
    const header = /^@@ -(?<oldStart>\d+)(?:,(?<oldCount>\d+))? \+(?<newStart>\d+)(?:,(?<newCount>\d+))? @@/u.exec(line);
    if (!header?.groups) {
      index += 1;
      continue;
    }

    const oldCount = Number(header.groups.oldCount ?? '1');
    const newCount = Number(header.groups.newCount ?? '1');
    const newStart = Number(header.groups.newStart);
    if (![oldCount, newCount, newStart].every(Number.isSafeInteger)) {
      return null;
    }

    const originalLines: string[] = [];
    const currentLines: string[] = [];
    let parsedOldCount = 0;
    let parsedNewCount = 0;
    previousPrefix = '';
    index += 1;
    while (index < lines.length && (parsedOldCount < oldCount || parsedNewCount < newCount)) {
      const patchLine = lines[index]!;
      const prefix = patchLine.slice(0, 1);
      const content = patchLine.slice(1);
      if (prefix === ' ') {
        originalLines.push(content);
        currentLines.push(content);
        parsedOldCount += 1;
        parsedNewCount += 1;
      } else if (prefix === '-') {
        originalLines.push(content);
        parsedOldCount += 1;
      } else if (prefix === '+') {
        currentLines.push(content);
        parsedNewCount += 1;
      } else if (prefix === '\\' && patchLine === '\\ No newline at end of file') {
        if (previousPrefix === '-' || previousPrefix === ' ') {
          oldEndsWithNewline = false;
        } else if (previousPrefix === '+') {
          oldEndsWithNewline = true;
        }
        index += 1;
        continue;
      } else {
        return null;
      }
      previousPrefix = prefix;
      index += 1;
    }
    if (parsedOldCount !== oldCount || parsedNewCount !== newCount) {
      return null;
    }
    if (lines[index] === '\\ No newline at end of file') {
      if (previousPrefix === '-' || previousPrefix === ' ') {
        oldEndsWithNewline = false;
      } else if (previousPrefix === '+') {
        oldEndsWithNewline = true;
      }
      index += 1;
    }
    hunks.push({ currentLines, newStart, originalLines });
  }

  return hunks.length > 0 ? { hunks, oldEndsWithNewline } : null;
}

export function reverseUnifiedFileChangeDiff(
  currentContent: string,
  diff: string,
): string | null {
  const patch = parseReversePatch(diff);
  if (!patch) {
    return null;
  }

  const lineEnding = currentContent.includes('\r\n') ? '\r\n' : '\n';
  const normalizedContent = currentContent.replace(/\r\n?/gu, '\n');
  const currentEndsWithNewline = normalizedContent.endsWith('\n');
  const currentLines = normalizedContent.split('\n');
  if (currentEndsWithNewline) {
    currentLines.pop();
  }

  let lineOffset = 0;
  for (const hunk of patch.hunks) {
    const startIndex = (hunk.newStart === 0 ? 0 : hunk.newStart - 1) + lineOffset;
    if (startIndex < 0 || startIndex + hunk.currentLines.length > currentLines.length) {
      return null;
    }
    const currentSlice = currentLines.slice(startIndex, startIndex + hunk.currentLines.length);
    if (currentSlice.some((line, index) => line !== hunk.currentLines[index])) {
      return null;
    }
    currentLines.splice(startIndex, hunk.currentLines.length, ...hunk.originalLines);
    lineOffset += hunk.originalLines.length - hunk.currentLines.length;
  }

  const restoredEndsWithNewline = patch.oldEndsWithNewline ?? currentEndsWithNewline;
  const restored = currentLines.join(lineEnding);
  return restoredEndsWithNewline ? `${restored}${lineEnding}` : restored;
}

export function buildFileChangeRestorePlan(
  fileChanges?: readonly FileChange[] | null,
): FileChangeRestorePlan {
  const normalizedFileChanges = Array.isArray(fileChanges)
    ? fileChanges.map((change) => structuredClone(change))
    : [];

  if (normalizedFileChanges.length === 0) {
    return {
      fileChanges: normalizedFileChanges,
      operations: [],
      restorable: false,
    };
  }

  const operations: FileChangeRestoreOperation[] = [];

  for (const change of normalizedFileChanges) {
    const normalizedPath = normalizeFileChangePath(change.path);
    if (!normalizedPath) {
      return {
        fileChanges: normalizedFileChanges,
        operations: [],
        restorable: false,
      };
    }

    if (typeof change.originalContent === 'string') {
      operations.push({
        content: change.originalContent,
        path: normalizedPath,
        type: 'write',
      });
      continue;
    }
    if (typeof change.diff === 'string' && parseReversePatch(change.diff)) {
      operations.push({
        diff: change.diff,
        path: normalizedPath,
        type: 'reverse-patch',
      });
      continue;
    }
    return {
      fileChanges: normalizedFileChanges,
      operations: [],
      restorable: false,
    };
  }

  return {
    fileChanges: normalizedFileChanges,
    operations,
    restorable: true,
  };
}

export function hasRestorableFileChanges(
  fileChanges?: readonly FileChange[] | null,
): boolean {
  return buildFileChangeRestorePlan(fileChanges).restorable;
}
