import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Code2, Loader2, Moon, Sun, X } from 'lucide-react';
import {
  SdkworkIamAuthRoutes,
} from '@sdkwork/auth-pc-react';
import {
  resolveBirdCoderAuthAppearance,
  resolveBirdCoderAuthRuntimeConfig,
} from '@sdkwork/birdcoder-pc-auth';
import {
  getBirdCoderIamRuntime,
  loadStoredAppSessionToken,
  APP_SESSION_CHANGE_EVENT_NAME,
  type StoredAppSessionToken,
} from '@sdkwork/birdcoder-pc-infrastructure';

interface AuthGateProps {
  children: ReactNode;
}

const AUTH_BASE_PATH = '/auth';
const BIRDCODER_SETTINGS_STORAGE_KEY = 'birdcoder-settings';

function isAuthenticatedSession(token: StoredAppSessionToken | null): boolean {
  return Boolean(token?.accessToken && token?.authToken);
}

function isDesktopRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const win = window as unknown as Record<string, unknown>;
  return Boolean(win.__TAURI__ || win.__TAURI_INTERNALS__);
}

function isAuthRoute(pathname: string): boolean {
  return pathname === AUTH_BASE_PATH || pathname.startsWith(`${AUTH_BASE_PATH}/`);
}

function resolveRedirectTarget(locationPathname: string, locationSearch: string, locationHash: string): string {
  const target = `${locationPathname}${locationSearch}${locationHash}`;
  if (isAuthRoute(locationPathname)) {
    return '/';
  }

  return target || '/';
}

function buildAuthLoginPath(redirectTarget: string): string {
  const params = new URLSearchParams();
  params.set('redirect', redirectTarget || '/');
  return `${AUTH_BASE_PATH}/login?${params.toString()}`;
}

function resolveAuthLocale(): string | null {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const language = navigator.language.trim();
  return language || null;
}

type WindowControlAction = 'close' | 'minimize' | 'toggleMaximize';
type NativeWindowControlAction = 'closeToTray' | 'minimize' | 'show' | 'startDragging' | 'toggleMaximize';
type AuthThemeMode = 'dark' | 'light';
type DesktopWindowLike = {
  isMaximized?: () => Promise<boolean> | boolean;
  maximize?: () => Promise<void> | void;
  minimize?: () => Promise<void> | void;
  startDragging?: () => Promise<void> | void;
  toggleMaximize?: () => Promise<void> | void;
  unmaximize?: () => Promise<void> | void;
};
type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

type StoredBirdCoderSettings = {
  theme?: 'system' | AuthThemeMode;
  [key: string]: unknown;
};

function readStoredBirdCoderSettings(): StoredBirdCoderSettings {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(BIRDCODER_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as StoredBirdCoderSettings : {};
  } catch {
    return {};
  }
}

function persistAuthThemeMode(theme: AuthThemeMode): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(BIRDCODER_SETTINGS_STORAGE_KEY, JSON.stringify({
      ...readStoredBirdCoderSettings(),
      theme,
    }));
  } catch {
  }
}

function resolveSystemAuthThemeMode(): AuthThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveInitialAuthThemeMode(): AuthThemeMode {
  const storedTheme = readStoredBirdCoderSettings().theme;
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return resolveSystemAuthThemeMode();
}

function applyAuthThemeMode(theme: AuthThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('light-mode', theme === 'light');
  document.documentElement.style.colorScheme = theme;
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
  return (globalThis as {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
    };
  }).__TAURI__?.core?.invoke ?? null;
}

async function invokeDesktopWindowControl(action: NativeWindowControlAction): Promise<boolean> {
  const invoke = resolveTauriInvoke();

  if (!invoke) {
    return false;
  }

  await invoke('sdkwork_birdcoder_pc_window_control', { action });
  return true;
}

async function handleWindowControl(action: WindowControlAction): Promise<void> {
  const nativeAction = action === 'close' ? 'closeToTray' : action;
  if (await invokeDesktopWindowControl(nativeAction)) {
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
  if (await invokeDesktopWindowControl('startDragging')) {
    return;
  }

  const appWindow = resolveTauriWindowApi();
  await appWindow?.startDragging?.();
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

function BirdCoderAuthShell({ children }: { children: ReactNode }) {
  const [authThemeMode, setAuthThemeMode] = useState<AuthThemeMode>(() => resolveInitialAuthThemeMode());
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const isLightMode = authThemeMode === 'light';
  const shouldRenderDesktopAppHeader = isDesktopRuntime();

  useEffect(() => {
    applyAuthThemeMode(authThemeMode);
  }, [authThemeMode]);

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
    setAuthThemeMode((currentTheme) => {
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      persistAuthThemeMode(nextTheme);
      return nextTheme;
    });
  }, []);

  const onWindowControl = useCallback((action: WindowControlAction) => {
    void handleWindowControl(action)
      .then(() => {
        if (action === 'toggleMaximize') {
          void refreshWindowState();
        }
      });
  }, [refreshWindowState]);

  const handleTitleBarPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.isPrimary === false || isAuthHeaderNoDragTarget(event.target)) {
      return;
    }

    event.preventDefault();
    void startAuthTitleBarDragging();
  }, []);

  const handleTitleBarDoubleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || isAuthHeaderNoDragTarget(event.target)) {
      return;
    }

    void handleWindowControl('toggleMaximize').then(refreshWindowState);
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
              aria-label={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
              className="sdkwork-birdcoder-auth-theme-button"
              onClick={toggleAuthTheme}
              title={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
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

export function AuthGate({ children }: AuthGateProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [session, setSession] = useState<StoredAppSessionToken | null>(null);

  const redirectTarget = useMemo(
    () => resolveRedirectTarget(location.pathname, location.search, location.hash),
    [location.hash, location.pathname, location.search],
  );
  const isAuthenticated = isAuthenticatedSession(session) && isAuthenticatedSession(loadStoredAppSessionToken());
  const isAuthPath = isAuthRoute(location.pathname);

  useEffect(() => {
    let disposed = false;
    const storedSession = loadStoredAppSessionToken();

    if (!isAuthenticatedSession(storedSession)) {
      setSession(null);
      setIsBootstrapped(true);
      return () => {
        disposed = true;
      };
    }

    setIsBootstrapped(false);

    const runtime = getBirdCoderIamRuntime();
    runtime.service.auth.sessions.current.retrieve()
      .then(() => {
        if (disposed) {
          return;
        }

        setSession(loadStoredAppSessionToken());
        setIsBootstrapped(true);
      })
      .catch(() => {
        if (disposed) {
          return;
        }

        setSession(null);
        setIsBootstrapped(true);
      });

    return () => {
      disposed = true;
    };
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleSessionChanged = () => {
      setSession(loadStoredAppSessionToken());
      setIsBootstrapped(true);
    };

    window.addEventListener(APP_SESSION_CHANGE_EVENT_NAME, handleSessionChanged);
    return () => {
      window.removeEventListener(APP_SESSION_CHANGE_EVENT_NAME, handleSessionChanged);
    };
  }, []);

  useEffect(() => {
    if (!isBootstrapped || isAuthenticated || isAuthPath) {
      return;
    }

    navigate(buildAuthLoginPath(redirectTarget), { replace: true });
  }, [isAuthPath, isAuthenticated, isBootstrapped, navigate, redirectTarget]);

  if (!isBootstrapped) {
    return (
      <div className="sdkwork-birdcoder-auth-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading authentication...</span>
      </div>
    );
  }

  if (isAuthenticated && isAuthPath) {
    return <Navigate replace to={redirectTarget} />;
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <BirdCoderAuthShell>
      <SdkworkIamAuthRoutes
        appearance={resolveBirdCoderAuthAppearance()}
        basePath="/auth"
        getRuntime={getBirdCoderIamRuntime}
        homePath="/"
        locale={resolveAuthLocale()}
        runtimeConfig={resolveBirdCoderAuthRuntimeConfig()}
        viewportMode="flow"
      />
    </BirdCoderAuthShell>
  );
}
