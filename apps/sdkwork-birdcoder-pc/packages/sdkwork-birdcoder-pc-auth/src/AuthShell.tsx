import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Code2, Moon, Sun, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useBirdcoderAppSettings,
  useBirdcoderTheme,
} from '@sdkwork/birdcoder-pc-workbench';

interface AuthShellProps {
  children: ReactNode;
}

type WindowControlAction = 'close' | 'minimize' | 'toggleMaximize';
type DesktopWindowLike = {
  isMaximized?: () => Promise<boolean> | boolean;
  maximize?: () => Promise<void> | void;
  minimize?: () => Promise<void> | void;
  startDragging?: () => Promise<void> | void;
  toggleMaximize?: () => Promise<void> | void;
  unmaximize?: () => Promise<void> | void;
};
type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

function isDesktopRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const win = window as unknown as Record<string, unknown>;
  return Boolean(win.__TAURI__ || win.__TAURI_INTERNALS__);
}

function resolveTauriWindowApi(): DesktopWindowLike | null {
  const tauri = (globalThis as {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
      window?: {
        getCurrentWindow?: () => DesktopWindowLike;
        appWindow?: DesktopWindowLike;
      };
    };
  }).__TAURI__?.window;
  return tauri?.getCurrentWindow?.() ?? tauri?.appWindow ?? null;
}

function resolveTauriInvoke(): TauriInvoke | null {
  const runtime = globalThis as {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
    };
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  };

  return runtime.__TAURI__?.core?.invoke
    ?? runtime.__TAURI_INTERNALS__?.invoke
    ?? null;
}

async function invokeDesktopWindowControl(action: WindowControlAction): Promise<boolean> {
  const invoke = resolveTauriInvoke();

  if (!invoke) {
    return false;
  }

  await invoke('desktop_perform_window_control_action', { action });
  return true;
}

async function handleWindowControl(action: WindowControlAction): Promise<void> {
  if (await invokeDesktopWindowControl(action)) {
    return;
  }

  if (action === 'close') {
    return;
  }

  const appWindow = resolveTauriWindowApi();
  if (!appWindow) {
    return;
  }
  if (action === 'minimize') {
    await appWindow.minimize?.();
    return;
  }
  if (action === 'toggleMaximize') {
    if (appWindow.toggleMaximize) {
      await appWindow.toggleMaximize();
      return;
    }

    if (appWindow.isMaximized && appWindow.unmaximize && await appWindow.isMaximized()) {
      await appWindow.unmaximize();
      return;
    }

    await appWindow.maximize?.();
    return;
  }
}

async function startAuthTitleBarDragging(): Promise<void> {
  const appWindow = resolveTauriWindowApi();
  await appWindow?.startDragging?.();
}

function ignoreWindowControlFailure(task: Promise<unknown>): void {
  void task.catch(() => undefined);
}

function isAuthHeaderNoDragTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') {
    return false;
  }

  const maybeElement = target as {
    closest?: (selector: string) => Element | null | unknown;
  };
  return typeof maybeElement.closest === 'function'
    ? Boolean(maybeElement.closest('[data-no-drag="true"]'))
    : false;
}

function WindowControlMinimizeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      shapeRendering="crispEdges"
      viewBox="0 0 10 10"
    >
      <path
        d="M2 7H8"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function WindowControlMaximizeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      shapeRendering="crispEdges"
      viewBox="0 0 10 10"
    >
      <path
        d="M2 2.5H8V8H2V2.5Z"
        stroke="currentColor"
        strokeLinejoin="miter"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2 3.5H8"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function WindowControlRestoreIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      shapeRendering="crispEdges"
      viewBox="0 0 10 10"
    >
      <path
        d="M3.5 2H8V6.5H6.5"
        stroke="currentColor"
        strokeLinejoin="miter"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M3.5 3H8"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2 3.5H6.5V8H2V3.5Z"
        stroke="currentColor"
        strokeLinejoin="miter"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2 4.5H6.5"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function AuthShell({ children }: AuthShellProps) {
  const { t } = useTranslation();
  const { updateSettings } = useBirdcoderAppSettings();
  const { colorMode } = useBirdcoderTheme();
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const isLightMode = colorMode === 'light';
  const shouldRenderDesktopAppHeader = isDesktopRuntime();

  const refreshWindowState = useCallback(async () => {
    const appWindow = resolveTauriWindowApi();
    if (!appWindow?.isMaximized) {
      setIsWindowMaximized(false);
      return;
    }

    try {
      setIsWindowMaximized(Boolean(await appWindow.isMaximized()));
    } catch {
      setIsWindowMaximized(false);
    }
  }, []);

  useEffect(() => {
    void refreshWindowState();
  }, [refreshWindowState]);

  const toggleAuthTheme = useCallback(() => {
    updateSettings({ theme: isLightMode ? 'Dark' : 'Light' });
  }, [isLightMode, updateSettings]);

  const onWindowControl = useCallback((action: WindowControlAction) => {
    ignoreWindowControlFailure(handleWindowControl(action)
      .then(() => {
        if (action === 'toggleMaximize') {
          return refreshWindowState();
        }
        return undefined;
      }));
  }, [refreshWindowState]);

  const handleTitleBarPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.isPrimary === false || isAuthHeaderNoDragTarget(event.target)) {
      return;
    }

    event.preventDefault();
    ignoreWindowControlFailure(startAuthTitleBarDragging());
  }, []);

  const handleTitleBarDoubleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || isAuthHeaderNoDragTarget(event.target)) {
      return;
    }

    ignoreWindowControlFailure(handleWindowControl('toggleMaximize').then(refreshWindowState));
  }, [refreshWindowState]);

  const handleTitleBarContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (isAuthHeaderNoDragTarget(event.target)) {
      return;
    }

    event.preventDefault();
  }, []);

  const handleTitleBarDragStart = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (isAuthHeaderNoDragTarget(event.target)) {
      return;
    }

    event.preventDefault();
  }, []);

  return (
    <div className="sdkwork-birdcoder-auth-shell">
      {shouldRenderDesktopAppHeader && (
        <header
          className="sdkwork-birdcoder-auth-header drag-region"
          data-tauri-drag-region
          onContextMenu={handleTitleBarContextMenu}
          onDoubleClick={handleTitleBarDoubleClick}
          onDragStart={handleTitleBarDragStart}
          onPointerDown={handleTitleBarPointerDown}
        >
          <div className="sdkwork-birdcoder-auth-header-brand" data-tauri-drag-region>
            <span className="sdkwork-birdcoder-auth-header-mark" aria-hidden="true">
              <Code2 size={12} />
            </span>
            <span>BirdCoder</span>
          </div>
          <div className="sdkwork-birdcoder-auth-header-center" data-tauri-drag-region />
          <div className="sdkwork-birdcoder-auth-header-actions no-drag" data-no-drag="true">
            <button
              aria-label={t(
                isLightMode
                  ? 'settings.appearance.switchToDark'
                  : 'settings.appearance.switchToLight',
              )}
              className="sdkwork-birdcoder-auth-theme-button"
              onClick={toggleAuthTheme}
              title={t(
                isLightMode
                  ? 'settings.appearance.switchToDark'
                  : 'settings.appearance.switchToLight',
              )}
              type="button"
            >
              {isLightMode ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <div className="sdkwork-birdcoder-auth-window-controls">
              <button
                aria-label="Minimize window"
                className="sdkwork-birdcoder-auth-window-button"
                onClick={() => onWindowControl('minimize')}
                title="Minimize"
                type="button"
              >
                <WindowControlMinimizeIcon />
              </button>
              <button
                aria-label={isWindowMaximized ? 'Restore window' : 'Maximize window'}
                className="sdkwork-birdcoder-auth-window-button"
                onClick={() => onWindowControl('toggleMaximize')}
                title={isWindowMaximized ? 'Restore' : 'Maximize'}
                type="button"
              >
                {isWindowMaximized ? <WindowControlRestoreIcon /> : <WindowControlMaximizeIcon />}
              </button>
              <button
                aria-label="Close window"
                className="sdkwork-birdcoder-auth-window-button sdkwork-birdcoder-auth-window-button-danger"
                onClick={() => onWindowControl('close')}
                title="Close"
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </header>
      )}
      <main className="sdkwork-birdcoder-auth-main">{children}</main>
    </div>
  );
}
