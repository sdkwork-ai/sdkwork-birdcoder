export const MAX_CHAT_CONTENT_PREVIEW_CHARACTERS = 24_000;
export const MAX_COMMAND_OUTPUT_PREVIEW_LINES = 24;

const DEFAULT_CHAT_CONTENT_PREVIEW_TAIL_CHARACTERS = 6_000;
const CHAT_CONTENT_PREVIEW_SEPARATOR = '\n\n...\n\n';

export interface ChatContentPreview {
  isTruncated: boolean;
  omittedCharacterCount: number;
  text: string;
}

export interface ChatLinePreview {
  isTruncated: boolean;
  lines: string[];
}

export interface CommandOutputPreview extends ChatContentPreview {
  isCharacterTruncated: boolean;
  omittedLineCount: number;
}

interface BuildChatContentPreviewOptions {
  maxCharacters?: number;
  tailCharacters?: number;
}

interface BuildChatLinePreviewOptions {
  maxCharacters?: number;
  maxLines: number;
}

interface BuildCommandOutputPreviewOptions {
  maxCharacters?: number;
  maxLines?: number;
}

function normalizePreviewLimit(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

export function buildChatContentPreview(
  content: string,
  options: BuildChatContentPreviewOptions = {},
): ChatContentPreview {
  const maxCharacters = normalizePreviewLimit(
    options.maxCharacters,
    MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
  );
  if (content.length <= maxCharacters) {
    return {
      isTruncated: false,
      omittedCharacterCount: 0,
      text: content,
    };
  }
  if (maxCharacters === 0) {
    return {
      isTruncated: content.length > 0,
      omittedCharacterCount: content.length,
      text: '',
    };
  }
  if (maxCharacters <= CHAT_CONTENT_PREVIEW_SEPARATOR.length) {
    return {
      isTruncated: true,
      omittedCharacterCount: content.length - maxCharacters,
      text: content.slice(0, maxCharacters),
    };
  }

  const availableContentCharacters = maxCharacters - CHAT_CONTENT_PREVIEW_SEPARATOR.length;
  const requestedTailCharacters = normalizePreviewLimit(
    options.tailCharacters,
    DEFAULT_CHAT_CONTENT_PREVIEW_TAIL_CHARACTERS,
  );
  const tailCharacters = Math.min(
    requestedTailCharacters,
    Math.floor(availableContentCharacters / 2),
  );
  const headCharacters = availableContentCharacters - tailCharacters;

  return {
    isTruncated: true,
    omittedCharacterCount: content.length - headCharacters - tailCharacters,
    text: [
      content.slice(0, headCharacters),
      CHAT_CONTENT_PREVIEW_SEPARATOR,
      tailCharacters > 0 ? content.slice(-tailCharacters) : '',
    ].join(''),
  };
}

function findNextLineBoundary(
  content: string,
  startIndex: number,
): {
  endIndex: number;
  hasSeparator: boolean;
  nextIndex: number;
} {
  let endIndex = startIndex;
  while (endIndex < content.length) {
    const characterCode = content.charCodeAt(endIndex);
    if (characterCode === 10 || characterCode === 13) {
      break;
    }
    endIndex += 1;
  }
  if (endIndex >= content.length) {
    return {
      endIndex: content.length,
      hasSeparator: false,
      nextIndex: content.length,
    };
  }

  const isWindowsLineBreak = content[endIndex] === '\r' && content[endIndex + 1] === '\n';
  return {
    endIndex,
    hasSeparator: true,
    nextIndex: endIndex + (isWindowsLineBreak ? 2 : 1),
  };
}

export function buildChatLinePreview(
  content: string,
  options: BuildChatLinePreviewOptions,
): ChatLinePreview {
  const maxCharacters = normalizePreviewLimit(
    options.maxCharacters,
    MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
  );
  const maxLines = normalizePreviewLimit(options.maxLines, 0);
  if (maxCharacters === 0 || maxLines === 0) {
    return {
      isTruncated: content.length > 0,
      lines: [],
    };
  }

  const lines: string[] = [];
  let consumedAllContent = false;
  let consumedCharacters = 0;
  let cursor = 0;

  while (lines.length < maxLines) {
    const boundary = findNextLineBoundary(content, cursor);
    const line = content.slice(cursor, boundary.endIndex);
    const separatorCharacters = lines.length > 0 ? 1 : 0;
    const availableCharacters = maxCharacters - consumedCharacters - separatorCharacters;
    if (availableCharacters <= 0) {
      break;
    }
    if (line.length > availableCharacters) {
      lines.push(line.slice(0, availableCharacters));
      consumedCharacters = maxCharacters;
      break;
    }

    lines.push(line);
    consumedCharacters += separatorCharacters + line.length;
    if (!boundary.hasSeparator) {
      consumedAllContent = true;
      break;
    }
    cursor = boundary.nextIndex;
  }

  return {
    isTruncated: !consumedAllContent,
    lines,
  };
}

export function buildCommandOutputPreview(
  output: string | undefined,
  options: BuildCommandOutputPreviewOptions = {},
): CommandOutputPreview {
  if (!output?.trim()) {
    return {
      isCharacterTruncated: false,
      isTruncated: false,
      omittedCharacterCount: 0,
      omittedLineCount: 0,
      text: '',
    };
  }

  const maxLines = normalizePreviewLimit(
    options.maxLines,
    MAX_COMMAND_OUTPUT_PREVIEW_LINES,
  );
  const normalizedMaxLines = Math.max(1, maxLines);
  const tailLineCount = Math.max(1, Math.floor(normalizedMaxLines / 3));
  const headLineCount = Math.max(0, normalizedMaxLines - tailLineCount);
  const headLines: string[] = [];
  const tailLines: string[] = [];
  const sourceOutput = output;
  let cursor = 0;
  let totalLineCount = 0;

  while (true) {
    const boundary = findNextLineBoundary(sourceOutput, cursor);
    const line = sourceOutput.slice(cursor, boundary.endIndex);
    if (totalLineCount < headLineCount) {
      headLines.push(line);
    } else {
      tailLines.push(line);
      if (tailLines.length > tailLineCount) {
        tailLines.shift();
      }
    }
    totalLineCount += 1;

    if (!boundary.hasSeparator) {
      break;
    }
    cursor = boundary.nextIndex;
  }

  const omittedLineCount = Math.max(
    0,
    totalLineCount - headLines.length - tailLines.length,
  );
  const lineBoundedText = [
    ...headLines,
    ...(omittedLineCount > 0 ? ['...'] : []),
    ...tailLines,
  ].join('\n');

  const contentPreview = buildChatContentPreview(lineBoundedText, {
    maxCharacters: options.maxCharacters,
  });
  return {
    ...contentPreview,
    isCharacterTruncated: contentPreview.isTruncated,
    isTruncated: omittedLineCount > 0 || contentPreview.isTruncated,
    omittedLineCount,
  };
}
