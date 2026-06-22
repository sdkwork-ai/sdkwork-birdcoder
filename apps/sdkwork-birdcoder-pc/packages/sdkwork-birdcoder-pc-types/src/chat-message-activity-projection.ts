import type { FileChange } from './file-change.ts';
import type { ChatMessageViewSource } from './chat-message-view.ts';

const FILE_UPDATE_SUMMARY_HEADER_PATTERN = /^(?:Success\.\s+)?Updated the following files:\s*$/i;
const FILE_UPDATE_SUMMARY_ENTRY_PATTERN = /^([A-Z?]{1,2})\s+(.+)$/;

export interface ProjectedActivityFileChange extends FileChange {
  lineImpactKnown?: boolean;
  updateStatus?: string;
}

interface FileUpdateSummaryBlock {
  endLineIndex: number;
  fileChanges: ProjectedActivityFileChange[];
  startLineIndex: number;
}

function normalizeFileUpdateSummaryPath(path: string): string {
  return path.trim().replace(/^["'`]+|["'`]+$/g, '');
}

function parseFileUpdateSummaryEntry(line: string): ProjectedActivityFileChange | null {
  const match = FILE_UPDATE_SUMMARY_ENTRY_PATTERN.exec(line.trim());
  if (!match) {
    return null;
  }

  const statusToken = match[1] ?? '';
  const path = normalizeFileUpdateSummaryPath(match[2] ?? '');
  if (!path) {
    return null;
  }

  return {
    path,
    additions: 0,
    deletions: 0,
    lineImpactKnown: false,
    updateStatus: statusToken,
  };
}

function parseFileUpdateSummaryBlock(
  lines: readonly string[],
  startLineIndex: number,
): FileUpdateSummaryBlock | null {
  const fileChanges: ProjectedActivityFileChange[] = [];
  let endLineIndex = startLineIndex;

  for (let lineIndex = startLineIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const currentLine = lines[lineIndex]?.trim() ?? '';
    if (!currentLine) {
      endLineIndex = lineIndex;
      break;
    }

    if (FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(currentLine)) {
      endLineIndex = lineIndex - 1;
      break;
    }

    const fileChange = parseFileUpdateSummaryEntry(currentLine);
    if (!fileChange) {
      endLineIndex = lineIndex - 1;
      break;
    }

    fileChanges.push(fileChange);
    endLineIndex = lineIndex;
  }

  return fileChanges.length > 0
    ? { endLineIndex, fileChanges, startLineIndex }
    : null;
}

export function parseFileUpdateSummaryContent(content: string): ProjectedActivityFileChange[] {
  if (!content.trim()) {
    return [];
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const fileChanges: ProjectedActivityFileChange[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (!FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(lines[lineIndex]?.trim() ?? '')) {
      continue;
    }

    const summaryBlock = parseFileUpdateSummaryBlock(lines, lineIndex);
    if (!summaryBlock) {
      continue;
    }

    fileChanges.push(...summaryBlock.fileChanges);
    lineIndex = summaryBlock.endLineIndex;
  }

  return fileChanges;
}

function normalizeActivityFileChangePathKey(path: string): string {
  return normalizeFileUpdateSummaryPath(path).replace(/\\/g, '/').toLowerCase();
}

export function resolveProjectedActivityFileChanges(
  message: ChatMessageViewSource,
): ProjectedActivityFileChange[] {
  const structuredFileChanges = (message.fileChanges ?? [])
    .filter((fileChange): fileChange is FileChange => {
      if (typeof fileChange !== 'object' || fileChange === null) {
        return false;
      }

      const path = (fileChange as FileChange).path;
      return typeof path === 'string' && path.trim().length > 0;
    })
    .map<ProjectedActivityFileChange>((fileChange) => ({
      ...fileChange,
      lineImpactKnown: true,
    }));
  const parsedFileChanges = parseFileUpdateSummaryContent(message.content).map<ProjectedActivityFileChange>(
    (fileChange) => ({
      ...fileChange,
      lineImpactKnown: false,
    }),
  );

  if (structuredFileChanges.length === 0) {
    return parsedFileChanges;
  }
  if (parsedFileChanges.length === 0) {
    return structuredFileChanges;
  }

  const fileChangesByPath = new Map<string, ProjectedActivityFileChange>();
  for (const fileChange of parsedFileChanges) {
    fileChangesByPath.set(normalizeActivityFileChangePathKey(fileChange.path), fileChange);
  }
  for (const fileChange of structuredFileChanges) {
    fileChangesByPath.set(normalizeActivityFileChangePathKey(fileChange.path), fileChange);
  }

  return [...fileChangesByPath.values()];
}

export function stripFileUpdateSummaryContent(content: string): string {
  if (!content.trim()) {
    return content;
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let didStripSummaryBlock = false;
  const remainingLines: string[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const currentLine = lines[lineIndex] ?? '';
    if (!FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(currentLine.trim())) {
      remainingLines.push(currentLine);
      continue;
    }

    const summaryBlock = parseFileUpdateSummaryBlock(lines, lineIndex);
    if (!summaryBlock) {
      remainingLines.push(currentLine);
      continue;
    }

    didStripSummaryBlock = true;
    lineIndex = summaryBlock.endLineIndex;
  }

  return didStripSummaryBlock ? remainingLines.join('\n').trim() : content;
}

export function shouldHideMessageContentAsFileUpdateSummary(
  content: string,
  activityFileChanges: readonly FileChange[] | undefined,
): boolean {
  if (!activityFileChanges || activityFileChanges.length === 0) {
    return false;
  }

  const strippedContent = stripFileUpdateSummaryContent(content);
  return strippedContent.length === 0;
}

export function resolveVisibleAssistantMessageContent(
  message: ChatMessageViewSource,
): string {
  const activityFileChanges = resolveProjectedActivityFileChanges(message);
  const strippedContent = stripFileUpdateSummaryContent(message.content).trim();

  if (shouldHideMessageContentAsFileUpdateSummary(message.content, activityFileChanges)) {
    return '';
  }

  if (activityFileChanges.length > 0) {
    const contentLines = message.content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (
      contentLines.length === 1 &&
      FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(contentLines[0] ?? '')
    ) {
      return '';
    }
  }

  return strippedContent || message.content;
}

export function resolveMessageCopyContent(message: ChatMessageViewSource): string {
  if (message.role === 'user') {
    return message.content;
  }

  return resolveVisibleAssistantMessageContent(message);
}

export function resolveVisibleMarkdownBlockContent(
  message: ChatMessageViewSource,
): string {
  if (message.role === 'user') {
    return message.content;
  }

  return resolveVisibleAssistantMessageContent(message);
}

export function hasParsedFileUpdateSummary(content: string): boolean {
  if (!content.trim()) {
    return false;
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  return lines.some((line) => FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(line.trim()));
}
