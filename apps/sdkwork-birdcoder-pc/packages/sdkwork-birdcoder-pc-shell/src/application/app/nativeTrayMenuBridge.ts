import { useEffect, useRef } from 'react';
import {
  parseDesktopTrayAction,
  type DesktopTrayAction,
  type DesktopTraySessionMenuSnapshot,
} from '@sdkwork/birdcoder-pc-workbench/workbench/desktopTraySessionMenu';

const DESKTOP_TRAY_ACTION_EVENT = 'birdcoder-tray-action';
const DESKTOP_TRAY_UPDATE_COMMAND = 'desktop_tray_update_menu';
const TRAY_MENU_RETRY_INITIAL_DELAY_MS = 250;
const TRAY_MENU_RETRY_MAX_DELAY_MS = 4_000;

type TrayMenuUpdate = (snapshot: DesktopTraySessionMenuSnapshot) => void;

export function useNativeTrayMenuBridge(
  snapshot: DesktopTraySessionMenuSnapshot,
  onAction: (action: DesktopTrayAction) => void,
): void {
  const latestActionHandlerRef = useRef(onAction);
  const latestSnapshotRef = useRef(snapshot);
  const requestMenuUpdateRef = useRef<TrayMenuUpdate | null>(null);

  latestActionHandlerRef.current = onAction;
  latestSnapshotRef.current = snapshot;

  useEffect(() => {
    let cancelled = false;
    let disposeListener: (() => void) | undefined;
    let pendingSnapshot: DesktopTraySessionMenuSnapshot | null = null;
    let pendingSignature = '';
    let appliedSignature = '';
    let failedSignature = '';
    let syncInFlight = false;
    let retryAttempt = 0;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      const { invoke, isTauri } = await import('@tauri-apps/api/core');
      if (!isTauri() || cancelled) {
        return;
      }

      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<unknown>(DESKTOP_TRAY_ACTION_EVENT, ({ payload }) => {
        const action = parseDesktopTrayAction(payload);
        if (action) {
          latestActionHandlerRef.current(action);
        }
      });
      if (cancelled) {
        unlisten();
        return;
      }
      disposeListener = unlisten;

      const clearScheduledRetry = () => {
        if (retryTimeout !== undefined) {
          clearTimeout(retryTimeout);
          retryTimeout = undefined;
        }
      };

      const flushMenuUpdates = async () => {
        if (syncInFlight || cancelled) {
          return;
        }
        syncInFlight = true;
        try {
          while (pendingSnapshot && !cancelled) {
            const nextSnapshot = pendingSnapshot;
            const nextSignature = pendingSignature;
            pendingSnapshot = null;
            try {
              await invoke(DESKTOP_TRAY_UPDATE_COMMAND, { snapshot: nextSnapshot });
              appliedSignature = nextSignature;
              failedSignature = '';
              retryAttempt = 0;
            } catch (error) {
              if (!pendingSnapshot) {
                pendingSnapshot = nextSnapshot;
                pendingSignature = nextSignature;
              }
              if (failedSignature !== nextSignature) {
                failedSignature = nextSignature;
                console.error('Failed to synchronize the BirdCoder desktop tray menu.', error);
              }

              const retryExponent = Math.min(retryAttempt, 4);
              const retryDelay = Math.min(
                TRAY_MENU_RETRY_INITIAL_DELAY_MS * (2 ** retryExponent),
                TRAY_MENU_RETRY_MAX_DELAY_MS,
              );
              retryAttempt = retryExponent + 1;
              retryTimeout = setTimeout(() => {
                retryTimeout = undefined;
                void flushMenuUpdates();
              }, retryDelay);
              break;
            }
          }
        } finally {
          syncInFlight = false;
          if (
            pendingSnapshot
            && !cancelled
            && retryTimeout === undefined
            && pendingSignature !== appliedSignature
          ) {
            void flushMenuUpdates();
          }
        }
      };

      requestMenuUpdateRef.current = (nextSnapshot) => {
        const nextSignature = JSON.stringify(nextSnapshot);
        if (nextSignature === pendingSignature) {
          return;
        }
        if (nextSignature === appliedSignature && !syncInFlight) {
          pendingSnapshot = null;
          pendingSignature = '';
          failedSignature = '';
          retryAttempt = 0;
          clearScheduledRetry();
          return;
        }
        clearScheduledRetry();
        retryAttempt = 0;
        pendingSnapshot = nextSnapshot;
        pendingSignature = nextSignature;
        void flushMenuUpdates();
      };
      requestMenuUpdateRef.current(latestSnapshotRef.current);
    })().catch((error) => {
      if (!cancelled) {
        console.error('Failed to initialize the BirdCoder desktop tray menu.', error);
      }
    });

    return () => {
      cancelled = true;
      if (retryTimeout !== undefined) {
        clearTimeout(retryTimeout);
      }
      requestMenuUpdateRef.current = null;
      disposeListener?.();
    };
  }, []);

  useEffect(() => {
    requestMenuUpdateRef.current?.(snapshot);
  }, [snapshot]);
}
