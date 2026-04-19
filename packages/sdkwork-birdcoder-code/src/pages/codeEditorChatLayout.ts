import {
  MAX_WORKBENCH_CODE_EDITOR_CHAT_WIDTH,
  normalizeWorkbenchCodeEditorChatWidth,
} from '@sdkwork/birdcoder-commons/workbench';

export const CODE_EDITOR_FILE_EXPLORER_WIDTH = 256;
export const CODE_EDITOR_RESIZE_HANDLE_WIDTH = 1;
export const CODE_EDITOR_MIN_SURFACE_WIDTH = 360;
export const CODE_EDITOR_RESPONSIVE_GUTTER = 24;

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
