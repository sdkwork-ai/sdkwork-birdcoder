import {
  MAX_WORKBENCH_CODE_EDITOR_CHAT_WIDTH,
  normalizeWorkbenchCodeEditorChatWidth,
} from '@sdkwork/birdcoder-pc-workbench/workbench/preferences';

export const CODE_EDITOR_FILE_EXPLORER_WIDTH = 256;
export const CODE_EDITOR_RESIZE_HANDLE_WIDTH = 1;
export const CODE_EDITOR_MIN_SURFACE_WIDTH = 360;
export const CODE_EDITOR_MIN_READABLE_CHAT_WIDTH = 320;
export const CODE_EDITOR_RESPONSIVE_GUTTER = 24;

export type CodeEditorDiffLayoutMode = 'standard' | 'diff-focused' | 'diff-only';

export interface CodeEditorDiffResponsiveLayout {
  chatWidth: number;
  mode: CodeEditorDiffLayoutMode;
  showChatPanel: boolean;
  showFileExplorer: boolean;
}

export function resolveCodeEditorResponsiveChatWidth(
  requestedWidth: number,
  workspaceWidth: number,
): number {
  const normalizedRequestedWidth = normalizeWorkbenchCodeEditorChatWidth(requestedWidth);
  if (workspaceWidth <= 0) {
    return normalizedRequestedWidth;
  }

  const availableChatWidth = Math.floor(
    workspaceWidth -
      CODE_EDITOR_FILE_EXPLORER_WIDTH -
      CODE_EDITOR_RESIZE_HANDLE_WIDTH -
      CODE_EDITOR_MIN_SURFACE_WIDTH -
      CODE_EDITOR_RESPONSIVE_GUTTER,
  );

  if (availableChatWidth <= 0) {
    return 0;
  }

  return Math.min(normalizedRequestedWidth, Math.min(MAX_WORKBENCH_CODE_EDITOR_CHAT_WIDTH, availableChatWidth));
}

export function resolveCodeEditorDiffResponsiveLayout(
  isViewingDiff: boolean,
  effectiveChatWidth: number,
): CodeEditorDiffResponsiveLayout {
  const safeChatWidth = Number.isFinite(effectiveChatWidth)
    ? Math.max(0, Math.floor(effectiveChatWidth))
    : 0;

  if (!isViewingDiff || safeChatWidth >= CODE_EDITOR_MIN_READABLE_CHAT_WIDTH) {
    return {
      chatWidth: safeChatWidth,
      mode: 'standard',
      showChatPanel: true,
      showFileExplorer: true,
    };
  }

  if (safeChatWidth === 0) {
    return {
      chatWidth: 0,
      mode: 'diff-only',
      showChatPanel: false,
      showFileExplorer: false,
    };
  }

  return {
    chatWidth: CODE_EDITOR_MIN_READABLE_CHAT_WIDTH,
    mode: 'diff-focused',
    showChatPanel: true,
    showFileExplorer: false,
  };
}
