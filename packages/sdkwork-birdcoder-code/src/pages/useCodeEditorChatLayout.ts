import {
  normalizeWorkbenchCodeEditorChatWidth,
  type WorkbenchPreferences,
} from '@sdkwork/birdcoder-commons/workbench';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveCodeEditorResponsiveChatWidth } from './codeEditorChatLayout';

const CODE_EDITOR_CHAT_WIDTH_PERSIST_DELAY_MS = 160;

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
  const [effectiveEditorChatWidth, setEffectiveEditorChatWidth] = useState(() =>
    resolveCodeEditorResponsiveChatWidth(initialChatWidth, 0),
  );
  const editorWorkspaceHostRef = useRef<HTMLDivElement>(null);
  const requestedChatWidthRef = useRef(initialChatWidth);
  const editorWorkspaceWidthRef = useRef(0);

  const syncEffectiveEditorChatWidth = useCallback(
    (requestedWidth: number, workspaceWidth: number) => {
      const nextEffectiveChatWidth = resolveCodeEditorResponsiveChatWidth(
        requestedWidth,
        workspaceWidth,
      );
      setEffectiveEditorChatWidth((previousState) =>
        previousState === nextEffectiveChatWidth ? previousState : nextEffectiveChatWidth,
      );
    },
    [],
  );

  useEffect(() => {
    setChatWidth(initialChatWidth);
    requestedChatWidthRef.current = initialChatWidth;
    syncEffectiveEditorChatWidth(initialChatWidth, editorWorkspaceWidthRef.current);
  }, [initialChatWidth, syncEffectiveEditorChatWidth]);

  useEffect(() => {
    requestedChatWidthRef.current = chatWidth;
    syncEffectiveEditorChatWidth(chatWidth, editorWorkspaceWidthRef.current);
  }, [chatWidth, syncEffectiveEditorChatWidth]);

  useEffect(() => {
    if (chatWidth === initialChatWidth) {
      return undefined;
    }

    const persist = () => {
      updatePreferences((previousPreferences) => ({
        ...previousPreferences,
        codeEditorChatWidth: chatWidth,
      }));
    };

    if (typeof window === 'undefined') {
      persist();
      return undefined;
    }

    const timeoutHandle = window.setTimeout(
      persist,
      CODE_EDITOR_CHAT_WIDTH_PERSIST_DELAY_MS,
    );

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [chatWidth, initialChatWidth, updatePreferences]);

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
      if (editorWorkspaceWidthRef.current === nextWidth) {
        return;
      }

      editorWorkspaceWidthRef.current = nextWidth;
      syncEffectiveEditorChatWidth(requestedChatWidthRef.current, nextWidth);
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
  }, [activeTab, syncEffectiveEditorChatWidth]);

  const handleEditorChatResize = useCallback((delta: number) => {
    setChatWidth((previousState) =>
      normalizeWorkbenchCodeEditorChatWidth(previousState - delta),
    );
  }, []);

  return {
    editorWorkspaceHostRef,
    effectiveEditorChatWidth,
    handleEditorChatResize,
  } as const;
}
