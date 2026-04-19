import {
  normalizeWorkbenchCodeEditorChatWidth,
  type WorkbenchPreferences,
} from '@sdkwork/birdcoder-commons/workbench';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveCodeEditorResponsiveChatWidth } from './codeEditorChatLayout';

interface UseCodeEditorChatLayoutOptions {
  activeTab: 'ai' | 'editor';
  initialChatWidth: number;
  updatePreferences: (
    value:
      | Partial<WorkbenchPreferences>
      | ((previousState: WorkbenchPreferences) => Partial<WorkbenchPreferences>),
  ) => void;
}

export function useCodeEditorChatLayout({
  activeTab,
  initialChatWidth,
  updatePreferences,
}: UseCodeEditorChatLayoutOptions) {
  const [chatWidth, setChatWidth] = useState(initialChatWidth);
  const [editorWorkspaceWidth, setEditorWorkspaceWidth] = useState(0);
  const editorWorkspaceHostRef = useRef<HTMLDivElement>(null);
  const effectiveEditorChatWidth = resolveCodeEditorResponsiveChatWidth(
    chatWidth,
    editorWorkspaceWidth,
  );

  useEffect(() => {
    setChatWidth(initialChatWidth);
  }, [initialChatWidth]);

  useEffect(() => {
    if (activeTab !== 'editor') {
      return undefined;
    }

    const host = editorWorkspaceHostRef.current;
    if (!host) {
      return undefined;
    }

    let resizeAnimationFrame = 0;

    const syncEditorWorkspaceWidth = () => {
      const nextWidth = host.clientWidth;
      setEditorWorkspaceWidth((previousState) => previousState === nextWidth ? previousState : nextWidth);
    };

    const scheduleEditorWorkspaceWidthSync = () => {
      if (typeof window === 'undefined') {
        syncEditorWorkspaceWidth();
        return;
      }

      if (resizeAnimationFrame !== 0) {
        return;
      }

      resizeAnimationFrame = window.requestAnimationFrame(() => {
        resizeAnimationFrame = 0;
        syncEditorWorkspaceWidth();
      });
    };

    scheduleEditorWorkspaceWidthSync();

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        if (resizeAnimationFrame !== 0 && typeof window !== 'undefined') {
          window.cancelAnimationFrame(resizeAnimationFrame);
        }
      };
    }

    const observer = new ResizeObserver(() => {
      scheduleEditorWorkspaceWidthSync();
    });

    observer.observe(host);
    return () => {
      if (resizeAnimationFrame !== 0 && typeof window !== 'undefined') {
        window.cancelAnimationFrame(resizeAnimationFrame);
      }
      observer.disconnect();
    };
  }, [activeTab]);

  const handleEditorChatResize = useCallback((delta: number) => {
    setChatWidth((previousState) => {
      const nextChatWidth = normalizeWorkbenchCodeEditorChatWidth(previousState - delta);
      updatePreferences((previousPreferences) => ({
        ...previousPreferences,
        codeEditorChatWidth: nextChatWidth,
      }));
      return nextChatWidth;
    });
  }, [updatePreferences]);

  return {
    editorWorkspaceHostRef,
    effectiveEditorChatWidth,
    handleEditorChatResize,
  } as const;
}
