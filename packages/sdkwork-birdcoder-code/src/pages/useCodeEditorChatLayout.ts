import {
  normalizeWorkbenchCodeEditorChatWidth,
  type WorkbenchPreferences,
} from '@sdkwork/birdcoder-commons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveCodeEditorResponsiveChatWidth } from './codeEditorChatLayout';

const CODE_EDITOR_CHAT_WIDTH_PERSIST_DELAY_MS = 160;

interface UseCodeEditorChatLayoutOptions {
  activeTab: 'ai' | 'editor' | 'mobile';
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
  const requestedChatWidthRef = useRef(
    normalizeWorkbenchCodeEditorChatWidth(initialChatWidth),
  );
  const persistedChatWidthRef = useRef(
    normalizeWorkbenchCodeEditorChatWidth(initialChatWidth),
  );
  const workspaceWidthRef = useRef(0);
  const persistTimeoutRef = useRef<number | null>(null);
  const [effectiveEditorChatWidth, setEffectiveEditorChatWidth] = useState(() =>
    resolveCodeEditorResponsiveChatWidth(requestedChatWidthRef.current, 0),
  );
  const editorWorkspaceHostRef = useRef<HTMLDivElement>(null);

  const clearScheduledPersistence = useCallback(() => {
    if (persistTimeoutRef.current === null || typeof window === 'undefined') {
      return;
    }

    window.clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = null;
  }, []);

  const syncEffectiveEditorChatWidth = useCallback(
    (requestedChatWidth: number, workspaceWidth: number) => {
      setEffectiveEditorChatWidth((previousState) => {
        const nextEffectiveWidth = resolveCodeEditorResponsiveChatWidth(
          requestedChatWidth,
          workspaceWidth,
        );
        return previousState === nextEffectiveWidth ? previousState : nextEffectiveWidth;
      });
    },
    [],
  );

  const scheduleRequestedChatWidthPersistence = useCallback(
    (requestedChatWidth: number) => {
      clearScheduledPersistence();

      if (requestedChatWidth === persistedChatWidthRef.current) {
        return;
      }

      const nextChatWidth = requestedChatWidth;
      const persist = () => {
        persistTimeoutRef.current = null;
        persistedChatWidthRef.current = nextChatWidth;
        updatePreferences((previousPreferences) => ({
          ...previousPreferences,
          codeEditorChatWidth: nextChatWidth,
        }));
      };

      if (typeof window === 'undefined') {
        persist();
        return;
      }

      persistTimeoutRef.current = window.setTimeout(
        persist,
        CODE_EDITOR_CHAT_WIDTH_PERSIST_DELAY_MS,
      );
    },
    [clearScheduledPersistence, updatePreferences],
  );

  useEffect(() => {
    const normalizedInitialChatWidth =
      normalizeWorkbenchCodeEditorChatWidth(initialChatWidth);
    if (
      normalizedInitialChatWidth === persistedChatWidthRef.current &&
      normalizedInitialChatWidth === requestedChatWidthRef.current
    ) {
      return;
    }

    persistedChatWidthRef.current = normalizedInitialChatWidth;
    requestedChatWidthRef.current = normalizedInitialChatWidth;
    clearScheduledPersistence();
    syncEffectiveEditorChatWidth(
      normalizedInitialChatWidth,
      workspaceWidthRef.current,
    );
  }, [
    clearScheduledPersistence,
    initialChatWidth,
    syncEffectiveEditorChatWidth,
  ]);

  useEffect(() => {
    return () => {
      clearScheduledPersistence();
    };
  }, [clearScheduledPersistence]);

  useEffect(() => {
    if (activeTab !== 'editor') {
      return undefined;
    }

    const host = editorWorkspaceHostRef.current;
    if (!host) {
      return undefined;
    }

    let resizeAnimationFrame = 0;

    const syncMeasuredEditorWorkspaceWidth = () => {
      const nextWidth = host.clientWidth;
      if (workspaceWidthRef.current === nextWidth) {
        return;
      }

      workspaceWidthRef.current = nextWidth;
      syncEffectiveEditorChatWidth(requestedChatWidthRef.current, nextWidth);
    };

    const scheduleMeasuredEditorWorkspaceWidthSync = () => {
      if (typeof window === 'undefined') {
        syncMeasuredEditorWorkspaceWidth();
        return;
      }

      if (resizeAnimationFrame !== 0) {
        return;
      }

      resizeAnimationFrame = window.requestAnimationFrame(() => {
        resizeAnimationFrame = 0;
        syncMeasuredEditorWorkspaceWidth();
      });
    };

    scheduleMeasuredEditorWorkspaceWidthSync();

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        if (resizeAnimationFrame !== 0 && typeof window !== 'undefined') {
          window.cancelAnimationFrame(resizeAnimationFrame);
        }
      };
    }

    const observer = new ResizeObserver(() => {
      scheduleMeasuredEditorWorkspaceWidthSync();
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
    const nextRequestedChatWidth = normalizeWorkbenchCodeEditorChatWidth(
      requestedChatWidthRef.current - delta,
    );

    if (nextRequestedChatWidth === requestedChatWidthRef.current) {
      return;
    }

    requestedChatWidthRef.current = nextRequestedChatWidth;
    syncEffectiveEditorChatWidth(
      nextRequestedChatWidth,
      workspaceWidthRef.current,
    );
    scheduleRequestedChatWidthPersistence(nextRequestedChatWidth);
  }, [scheduleRequestedChatWidthPersistence, syncEffectiveEditorChatWidth]);

  return {
    editorWorkspaceHostRef,
    effectiveEditorChatWidth,
    handleEditorChatResize,
  } as const;
}
