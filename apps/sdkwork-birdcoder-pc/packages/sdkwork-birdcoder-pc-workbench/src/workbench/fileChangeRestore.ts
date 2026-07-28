import {
  MAX_AGENT_SESSION_FILE_CHANGES,
  MAX_FILE_CHANGE_PATH_CHARACTERS,
  MAX_FILE_CHANGE_TEXT_CHARACTERS,
  MAX_FILE_CHANGE_TOTAL_TEXT_CHARACTERS,
  type FileChange,
} from '@sdkwork/birdcoder-pc-contracts-commons';

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

  if (value.length > MAX_FILE_CHANGE_PATH_CHARACTERS) {
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
  if (diff.length > MAX_FILE_CHANGE_TEXT_CHARACTERS) {
    return null;
  }
  let lineCount = 1;
  for (let index = 0; index < diff.length; index += 1) {
    if (diff.charCodeAt(index) === 10) {
      lineCount += 1;
      if (lineCount > 100_000) {
        return null;
      }
    }
  }
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
  if (currentContent.length > MAX_FILE_CHANGE_TEXT_CHARACTERS) {
    return null;
  }
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
  if (
    !Array.isArray(fileChanges)
    || fileChanges.length === 0
    || fileChanges.length > MAX_AGENT_SESSION_FILE_CHANGES
  ) {
    return {
      fileChanges: [],
      operations: [],
      restorable: false,
    };
  }

  let retainedTextCharacters = 0;
  for (const change of fileChanges) {
    const normalizedPath = normalizeFileChangePath(change.path);
    const textFields = [change.diff, change.content, change.originalContent];
    if (
      !normalizedPath
      || textFields.some((value) => (
        typeof value === 'string' && value.length > MAX_FILE_CHANGE_TEXT_CHARACTERS
      ))
    ) {
      return {
        fileChanges: [],
        operations: [],
        restorable: false,
      };
    }
    retainedTextCharacters += textFields.reduce(
      (total, value) => total + (typeof value === 'string' ? value.length : 0),
      0,
    );
    if (retainedTextCharacters > MAX_FILE_CHANGE_TOTAL_TEXT_CHARACTERS) {
      return {
        fileChanges: [],
        operations: [],
        restorable: false,
      };
    }
  }

  const normalizedFileChanges = fileChanges.map((change) => structuredClone(change));

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
