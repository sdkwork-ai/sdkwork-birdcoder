/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, lazy, Suspense, startTransition, type ErrorInfo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Code2, Sparkles, PanelsTopLeft, Terminal, Settings, UserCircle, Shield, Zap, LayoutTemplate, X, AlertTriangle } from 'lucide-react';
import {
  AuthProvider,
  DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  buildDefaultTerminalCommandRequest,
  buildProjectCodingSessionIndex,
  buildWorkbenchRecoveryAnnouncement,
  buildWorkbenchRecoverySnapshot,
  emitOpenTerminalRequest,
  globalEventBus,
  hydrateImportedProjectFromAuthority,
  IDEProvider,
  importLocalFolderProject,
  isWorkbenchRecoverySelectionResolutionReady,
  normalizeWorkbenchRecoverySnapshot,
  normalizeWorkbenchRecoveryUserScope,
  openLocalFolder,
  openTauriShellPath,
  recoverySnapshotsEqual,
  resolveEffectiveWorkspaceId,
  resolveLocalFolderImportWorkspaceId,
  resolveWorkbenchRecoverySnapshotForUser,
  resolveStartupCodingSessionId,
  resolveStartupProjectId,
  resolveStartupWorkspaceId,
  resolveWorkbenchRecoveryPersistenceSelection,
  setStoredJson,
  type ProjectMountRecoveryEventPayload,
  subscribeProjectMountRecoveryState,
  ToastProvider,
  type TerminalCommandRequest,
  useBirdcoderTerminalLaunchPlanResolver,
  useIDEServices,
  usePersistedState,
  useProjects,
  useAuth,
  useToast,
  useWorkbenchChatSelection,
  useWorkbenchCodingSessionCreationActions,
  useWorkbenchPreferences,
  useWorkspaces,
  type WorkbenchRecoverySnapshot,
} from '@sdkwork/birdcoder-commons';
import { Button, TopMenu, type TopMenuItem } from '@sdkwork/birdcoder-ui-shell';
import type { AppTab, BirdCoderProject } from '@sdkwork/birdcoder-types';
import {
  resolveWorkbenchNewSessionEngineCatalog,
} from '@sdkwork/birdcoder-codeengine';
import { useTranslation } from 'react-i18next';
import {
  createAppHeaderWindowDragController,
  isAppHeaderNoDragTarget,
} from './appHeaderWindowDrag.ts';
import { AppShellDialogs } from './AppShellDialogs.tsx';
import { AppWorkspaceMenu } from './AppWorkspaceMenu.tsx';
import {
  performNativeWindowControlAction,
  useNativeWindowControlsBridge
} from './nativeWindowControlsBridge.ts';

const CodePage = lazy(async () => {
  const { loadCodePage } = await import('./pageLoaders.ts');
  return loadCodePage();
});

const StudioPage = lazy(async () => {
  const { loadStudioPage } = await import('./pageLoaders.ts');
  return loadStudioPage();
});

const MultiWindowProgrammingPage = lazy(async () => {
  const { loadMultiWindowProgrammingPage } = await import('./pageLoaders.ts');
  return loadMultiWindowProgrammingPage();
});

const TerminalDesktopApp = lazy(async () => {
  const { loadTerminalDesktopApp } = await import('./pageLoaders.ts');
  return loadTerminalDesktopApp();
});

const SettingsPage = lazy(async () => {
  const { loadSettingsPage } = await import('./pageLoaders.ts');
  return loadSettingsPage();
});

const AuthPage = lazy(async () => {
  const { loadAuthPage } = await import('./pageLoaders.ts');
  return loadAuthPage();
});

const UserCenterPage = lazy(async () => {
  const { loadUserCenterPage } = await import('./pageLoaders.ts');
  return loadUserCenterPage();
});

const VipPage = lazy(async () => {
  const { loadVipPage } = await import('./pageLoaders.ts');
  return loadVipPage();
});

const SkillsPage = lazy(async () => {
  const { loadSkillsPage } = await import('./pageLoaders.ts');
  return loadSkillsPage();
});

const TemplatesPage = lazy(async () => {
  const { loadTemplatesPage } = await import('./pageLoaders.ts');
  return loadTemplatesPage();
});

const PRIMARY_PERSISTED_APP_TABS = new Set<AppTab>(['code', 'studio', 'multiwindow', 'terminal']);
const GUEST_HOME_APP_TAB: AppTab = 'templates';
const AUTHENTICATED_DEFAULT_APP_TAB: AppTab = 'code';
const AUTH_SURFACE_BASE_PATH = '/auth';
const AUTH_SURFACE_DEFAULT_ROUTE = `${AUTH_SURFACE_BASE_PATH}/login`;
const AUTH_REQUIRED_APP_TABS = new Set<AppTab>([
  'code',
  'studio',
  'multiwindow',
  'terminal',
  'user',
  'vip',
]);

function requiresAuthenticatedSession(tab: AppTab): boolean {
  return AUTH_REQUIRED_APP_TABS.has(tab);
}

function resolveInitialAppTab(tab: AppTab, isAuthenticated: boolean): AppTab {
  if (isAuthenticated) {
    return tab === 'auth' ? AUTHENTICATED_DEFAULT_APP_TAB : tab;
  }

  if (tab === 'auth' || requiresAuthenticatedSession(tab)) {
    return GUEST_HOME_APP_TAB;
  }

  return tab;
}

function normalizeAuthSurfaceLocationPath(rawPath: string | null | undefined): string {
  const normalizedPath = (rawPath || '').trim();
  if (!normalizedPath) {
    return '';
  }

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}

function isAuthSurfaceLocationPath(path: string): boolean {
  return (
    path === AUTH_SURFACE_BASE_PATH
    || path.startsWith(`${AUTH_SURFACE_BASE_PATH}/`)
  );
}

function readAuthSurfaceHashPath(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeAuthSurfaceLocationPath(
    window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash,
  );
}

function replaceAuthSurfaceHashPath(path: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedPath = normalizeAuthSurfaceLocationPath(path);
  const baseUrl = `${window.location.pathname}${window.location.search}`;
  const nextUrl = normalizedPath ? `${baseUrl}#${normalizedPath}` : baseUrl;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentUrl === nextUrl) {
    return;
  }

  window.history.replaceState(window.history.state, '', nextUrl);
}

function shouldBootIntoAuthSurface(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const pathname = normalizeAuthSurfaceLocationPath(window.location.pathname);
  if (isAuthSurfaceLocationPath(pathname)) {
    return true;
  }

  return isAuthSurfaceLocationPath(readAuthSurfaceHashPath());
}

type ErrorBoundaryProps = {
  children: React.ReactNode;
  t: (key: string) => string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

type DesktopWindowHandle = {
  isMinimized: () => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  onResized: (handler: () => void) => Promise<() => void>;
  onFocusChanged: (handler: () => void) => Promise<() => void>;
  onScaleChanged: (handler: () => void) => Promise<() => void>;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  startDragging: () => Promise<void>;
};

const DESKTOP_WINDOW_FRAME_STATE_RECONCILIATION_DELAY_MS = 120;
const WORKBENCH_RECOVERY_PERSIST_DELAY_MS = 80;

function persistWorkbenchRecoverySnapshot(snapshot: WorkbenchRecoverySnapshot): void {
  void setStoredJson('workbench', 'recovery-context', snapshot).catch(() => {
  });
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-full w-full bg-[#0e0e11] text-white items-center justify-center p-8">
          <AlertTriangle size={48} className="text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">{this.props.t('app.somethingWentWrong')}</h1>
          <p className="text-gray-400 mb-6 text-center max-w-md">
            {this.props.t('app.unexpectedError')}
          </p>
          <div className="bg-[#18181b] p-4 rounded-lg border border-white/10 w-full max-w-2xl overflow-auto text-sm text-red-400 font-mono">
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            {this.props.t('app.reloadApplication')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const ErrorBoundaryWithTranslation = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  return <ErrorBoundary t={t}>{children}</ErrorBoundary>;
};

function SurfaceLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className="flex h-full w-full bg-[#0e0e11] text-white items-center justify-center"
    >
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
    </div>
  );
}

function WindowControlMinimizeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className="h-3.5 w-3.5"
      fill="none"
      shapeRendering="crispEdges"
    >
      <path
        d="M2 7H8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function WindowControlMaximizeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className="h-3.5 w-3.5"
      fill="none"
      shapeRendering="crispEdges"
    >
      <path
        d="M2 2.5H8V8H2V2.5Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2 3.5H8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function WindowControlRestoreIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className="h-3.5 w-3.5"
      fill="none"
      shapeRendering="crispEdges"
    >
      <path
        d="M3.5 2H8V6.5H6.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M3.5 3H8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2 3.5H6.5V8H2V3.5Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2 4.5H6.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface BirdcoderAppHeaderProps {
  centerContent?: React.ReactNode;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  handleClose(): void;
  handleMaximize(): void;
  handleMinimize(): void;
  isDesktopWindowAvailable: boolean;
  isDesktopWindowMaximized: boolean;
  isDesktopWindowMinimized: boolean;
  leftAddon?: React.ReactNode;
  maximizeButtonRef: React.RefObject<HTMLButtonElement | null>;
  minimizeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onDoubleClick(event: React.MouseEvent<HTMLDivElement>): void;
  onDragStart(event: React.DragEvent<HTMLDivElement>): void;
  onPointerDown(event: React.PointerEvent<HTMLDivElement>): void;
  onContextMenu(event: React.MouseEvent<HTMLDivElement>): void;
  t: (key: string, options?: Record<string, unknown>) => string;
  titleBarDragSurfaceClass: string;
}

function BirdcoderAppHeader({
  centerContent,
  closeButtonRef,
  handleClose,
  handleMaximize,
  handleMinimize,
  isDesktopWindowAvailable,
  isDesktopWindowMaximized,
  isDesktopWindowMinimized,
  leftAddon,
  maximizeButtonRef,
  minimizeButtonRef,
  onDoubleClick,
  onDragStart,
  onPointerDown,
  onContextMenu,
  t,
  titleBarDragSurfaceClass,
}: BirdcoderAppHeaderProps) {
  return (
    <div
      className="grid h-10 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/[0.08] bg-[#0e0e11] px-2 shrink-0 select-none z-50 touch-none"
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="flex min-w-0 items-center gap-3 h-full animate-in fade-in slide-in-from-top-2 fill-mode-both"
        style={{ animationDelay: '0ms' }}
      >
        <div className={`flex h-8 min-w-[148px] items-center gap-2 rounded-lg px-2.5 transition-colors ${titleBarDragSurfaceClass}`}>
          <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
            <Code2 size={12} className="text-white" />
          </div>
          <div className="flex min-w-0 items-center">
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]">
              BirdCoder
            </span>
          </div>
        </div>

        {leftAddon ? (
          <div
            data-no-drag="true"
            className="flex min-w-0 items-center gap-1"
          >
            {leftAddon}
          </div>
        ) : null}
      </div>

      <div
        data-no-drag="true"
        className="flex min-w-0 items-center justify-center"
      >
        {centerContent}
      </div>

      <div
        data-no-drag="true"
        className="flex items-center justify-end h-full animate-in fade-in slide-in-from-top-2 fill-mode-both"
        style={{ animationDelay: '100ms' }}
      >
        {isDesktopWindowAvailable ? (
          <div className="flex h-full items-center">
            <button
              ref={minimizeButtonRef}
              type="button"
              onClick={handleMinimize}
              aria-label={t('app.menu.minimize')}
              aria-pressed={isDesktopWindowMinimized}
              title={t('app.menu.minimize')}
              className={`h-full px-3 hover:bg-white/10 transition-colors flex items-center justify-center rounded-md ${
                isDesktopWindowMinimized ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white'
              }`}
            >
              <WindowControlMinimizeIcon />
            </button>
            <button
              ref={maximizeButtonRef}
              type="button"
              onClick={handleMaximize}
              aria-label={isDesktopWindowMaximized ? t('common.restore') : t('app.menu.maximize')}
              title={isDesktopWindowMaximized ? t('common.restore') : t('app.menu.maximize')}
              className="h-full px-3 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-md"
            >
              {isDesktopWindowMaximized ? <WindowControlRestoreIcon /> : <WindowControlMaximizeIcon />}
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              aria-label={t('app.menu.close')}
              title={t('app.menu.close')}
              className="h-full px-3 hover:bg-red-500 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-md"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface AppMainBodyProps {
  activeTab: AppTab;
  isAuthenticated: boolean;
  terminalRequest?: TerminalCommandRequest;
  workspaceId: string;
  projectId: string;
  projectName?: string;
  codingSessionId: string;
  onActiveTabChange: (tab: AppTab) => void;
  onRequireAuth: (targetTab: AppTab) => void;
  onProjectChange: (projectId: string) => void;
  onCodingSessionChange: (codingSessionId: string) => void;
}

const PersistentAppTabPanel = React.memo(function PersistentAppTabPanel({
  children,
  isActive,
}: {
  children: React.ReactNode;
  isActive: boolean;
}) {
  return (
    <div
      aria-hidden={!isActive}
      className={`absolute inset-0 flex flex-col overflow-hidden ${isActive ? '' : 'hidden'}`}
    >
      {children}
    </div>
  );
});

PersistentAppTabPanel.displayName = 'PersistentAppTabPanel';

const isWorkspaceTerminalRequest = (request: TerminalCommandRequest): boolean =>
  request.surface === 'workspace';

const AppMainBody = React.memo(function AppMainBody({
  activeTab,
  isAuthenticated,
  terminalRequest,
  workspaceId,
  projectId,
  projectName,
  codingSessionId,
  onActiveTabChange,
  onRequireAuth,
  onProjectChange,
  onCodingSessionChange,
}: AppMainBodyProps) {
  const { t } = useTranslation();
  const resolveTerminalLaunchPlan = useBirdcoderTerminalLaunchPlanResolver(
    workspaceId,
    projectId || null,
  );
  const isAuthSurface = activeTab === 'auth';
  const [mountedPrimaryTabs, setMountedPrimaryTabs] = useState<Set<AppTab>>(() => new Set<AppTab>([activeTab]));

  useEffect(() => {
    if (!PRIMARY_PERSISTED_APP_TABS.has(activeTab)) {
      return;
    }

    setMountedPrimaryTabs((previousMountedTabs) => {
      if (previousMountedTabs.has(activeTab)) {
        return previousMountedTabs;
      }
      const nextMountedTabs = new Set(previousMountedTabs);
      nextMountedTabs.add(activeTab);
      return nextMountedTabs;
    });
  }, [activeTab]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {isAuthSurface ? null : (
        <div className="w-14 flex flex-col items-center py-4 border-r border-white/[0.08] bg-[#0e0e11] justify-between shrink-0">
          <div className="flex flex-col gap-3 items-center w-full px-2">
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('code')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'code' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '0ms' }} title={t('app.code')}>
              <Code2 size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('studio')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'studio' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '50ms' }} title={t('app.studio')}>
              <Sparkles size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('multiwindow')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'multiwindow' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '100ms' }} title={t('multiWindow.title')}>
              <PanelsTopLeft size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('terminal')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'terminal' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '150ms' }} title={t('app.terminal')}>
              <Terminal size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('skills')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'skills' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '200ms' }} title={t('app.skills')}>
              <Zap size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('templates')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'templates' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '250ms' }} title={t('app.templates')}>
              <LayoutTemplate size={22} strokeWidth={1.5} />
            </Button>
          </div>
          <div className="flex flex-col gap-3 items-center w-full px-2">
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('user')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'user' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '250ms' }} title={t('app.userProfile')}>
              <UserCircle size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('vip')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'vip' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '300ms' }} title="VIP Membership">
              <Shield size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('settings')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'settings' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '350ms' }} title={t('app.settings')}>
              <Settings size={22} strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative bg-[#0e0e11]">
        <Suspense fallback={<SurfaceLoader />}>
          {mountedPrimaryTabs.has('code') && (
            <PersistentAppTabPanel isActive={activeTab === 'code'}>
              <CodePage
                isVisible={activeTab === 'code'}
                workspaceId={workspaceId}
                projectId={projectId}
                initialCodingSessionId={codingSessionId}
                onProjectChange={onProjectChange}
                onCodingSessionChange={onCodingSessionChange}
              />
            </PersistentAppTabPanel>
          )}
          {mountedPrimaryTabs.has('studio') && (
            <PersistentAppTabPanel isActive={activeTab === 'studio'}>
              <StudioPage
                isVisible={activeTab === 'studio'}
                workspaceId={workspaceId}
                projectId={projectId}
                initialCodingSessionId={codingSessionId}
                onProjectChange={onProjectChange}
                onCodingSessionChange={onCodingSessionChange}
              />
            </PersistentAppTabPanel>
          )}
          {mountedPrimaryTabs.has('multiwindow') && (
            <PersistentAppTabPanel isActive={activeTab === 'multiwindow'}>
              <MultiWindowProgrammingPage
                isVisible={activeTab === 'multiwindow'}
                workspaceId={workspaceId}
                projectId={projectId}
                initialCodingSessionId={codingSessionId}
                onProjectChange={onProjectChange}
                onCodingSessionChange={onCodingSessionChange}
              />
            </PersistentAppTabPanel>
          )}
          {mountedPrimaryTabs.has('terminal') && (
            <PersistentAppTabPanel isActive={activeTab === 'terminal'}>
              <TerminalDesktopApp
                launchRequest={terminalRequest}
                launchRequestKey={terminalRequest?.timestamp ?? null}
                resolveLaunchPlan={resolveTerminalLaunchPlan}
                showWindowControls={false}
              />
            </PersistentAppTabPanel>
          )}
          {activeTab === 'skills' && (
            <SkillsPage
              isAuthenticated={isAuthenticated}
              onRequireAuth={() => onRequireAuth('skills')}
              workspaceId={workspaceId || undefined}
            />
          )}
          {activeTab === 'templates' && (
            <TemplatesPage
              isAuthenticated={isAuthenticated}
              onRequireAuth={() => onRequireAuth('templates')}
              workspaceId={workspaceId || undefined}
              onProjectCreated={(id) => {
                onProjectChange(id);
                onActiveTabChange('code');
              }}
            />
          )}
          {activeTab === 'auth' && <AuthPage />}
          {activeTab === 'user' && (
            <UserCenterPage
              onAuthenticationRequired={() => onRequireAuth('user')}
            />
          )}
          {activeTab === 'vip' && (
            <VipPage
              onAuthenticationRequired={() => onRequireAuth('vip')}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsPage
              currentProjectId={projectId || undefined}
              currentProjectName={projectName}
              onBack={() => onActiveTabChange('code')}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
});

AppMainBody.displayName = 'AppMainBody';

function createWorkbenchRecoverySessionId() {
  return `recovery-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  return (
    <ErrorBoundaryWithTranslation>
      <ToastProvider>
        <IDEProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </IDEProvider>
      </ToastProvider>
    </ErrorBoundaryWithTranslation>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const { fileSystemService, projectService } = useIDEServices();
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const { addToast } = useToast();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const [activeTab, setActiveTab] = useState<AppTab>(() =>
    shouldBootIntoAuthSurface() ? 'auth' : GUEST_HOME_APP_TAB,
  );
  const [recoverySnapshot, , isRecoveryHydrated] = usePersistedState<WorkbenchRecoverySnapshot>(
    'workbench',
    'recovery-context',
    DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  );
  const {
    workspaces,
    hasFetched: workspacesHasFetched,
    isLoading: isWorkspacesLoading,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    refreshWorkspaces,
  } = useWorkspaces({
    isActive: Boolean(user),
  });
  const currentWorkbenchUserScope = normalizeWorkbenchRecoveryUserScope(user?.id);
  const normalizedStoredRecoverySnapshot = normalizeWorkbenchRecoverySnapshot(recoverySnapshot);
  const normalizedRecoverySnapshot = resolveWorkbenchRecoverySnapshotForUser(
    normalizedStoredRecoverySnapshot,
    currentWorkbenchUserScope,
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [activeCodingSessionId, setActiveCodingSessionId] = useState<string>('');
  const previousWorkbenchUserScopeRef = useRef(currentWorkbenchUserScope);
  const isWorkbenchSelectionForCurrentUser =
    previousWorkbenchUserScopeRef.current === currentWorkbenchUserScope;
  const scopedActiveWorkspaceId = isWorkbenchSelectionForCurrentUser ? activeWorkspaceId : '';
  const scopedActiveProjectId = isWorkbenchSelectionForCurrentUser ? activeProjectId : '';
  const scopedActiveCodingSessionId =
    isWorkbenchSelectionForCurrentUser ? activeCodingSessionId : '';
  const workspacesById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces],
  );

  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [menuActiveWorkspaceId, setMenuActiveWorkspaceId] = useState<string>('');
  const resolvedWorkspaceId = resolveStartupWorkspaceId({
    workspaces,
    recoverySnapshot: normalizedRecoverySnapshot,
  });
  const fallbackWorkspaceId = workspaces[0]?.id ?? '';
  const effectiveWorkspaceId = (scopedActiveWorkspaceId || resolvedWorkspaceId || fallbackWorkspaceId).trim();
  const effectiveMenuWorkspaceId = (menuActiveWorkspaceId || effectiveWorkspaceId).trim();
  const projectsWorkspaceId = user ? effectiveWorkspaceId : '';
  const menuProjectsScopeWorkspaceId =
    user && showWorkspaceMenu ? effectiveMenuWorkspaceId : '';
  const shouldUseDistinctMenuProjectsStore =
    !!menuProjectsScopeWorkspaceId && menuProjectsScopeWorkspaceId !== projectsWorkspaceId;

  // Fetch projects for the active workspace to know the active project's name
  const {
    projects: activeProjects,
    hasFetched: activeProjectsHasFetched,
    createProject: createActiveProject,
    refreshProjects: refreshActiveProjects,
    updateProject: updateActiveProject,
    deleteProject: deleteActiveProject,
    createCodingSession: createActiveCodingSession,
  } = useProjects(projectsWorkspaceId);
  const activeProjectsIndex = useMemo(
    () => buildProjectCodingSessionIndex(activeProjects),
    [activeProjects],
  );
  const {
    projects: distinctMenuProjects,
    hasFetched: distinctMenuProjectsHasFetched,
    createProject: createDistinctMenuProject,
    createCodingSession: createDistinctMenuCodingSession,
    refreshProjects: refreshDistinctMenuProjects,
    updateProject: updateDistinctMenuProject,
    deleteProject: deleteDistinctMenuProject,
  } = useProjects(
    shouldUseDistinctMenuProjectsStore ? menuProjectsScopeWorkspaceId : '',
    {
      enableRealtime: false,
    },
  );
  const menuProjects = shouldUseDistinctMenuProjectsStore ? distinctMenuProjects : activeProjects;
  const menuProjectsIndex = useMemo(
    () => buildProjectCodingSessionIndex(menuProjects),
    [menuProjects],
  );
  const menuProjectsHasFetched =
    shouldUseDistinctMenuProjectsStore
      ? distinctMenuProjectsHasFetched
      : activeProjectsHasFetched;
  const createMenuProject =
    shouldUseDistinctMenuProjectsStore ? createDistinctMenuProject : createActiveProject;
  const createMenuCodingSession =
    shouldUseDistinctMenuProjectsStore
      ? createDistinctMenuCodingSession
      : createActiveCodingSession;
  const refreshMenuProjects =
    shouldUseDistinctMenuProjectsStore ? refreshDistinctMenuProjects : refreshActiveProjects;
  const updateMenuProject =
    shouldUseDistinctMenuProjectsStore ? updateDistinctMenuProject : updateActiveProject;
  const deleteProject =
    shouldUseDistinctMenuProjectsStore ? deleteDistinctMenuProject : deleteActiveProject;

  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renamingWorkspaceId, setRenamingWorkspaceId] = useState<string | null>(null);
  const [renameWorkspaceValue, setRenameWorkspaceValue] = useState('');
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameProjectValue, setRenameProjectValue] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [projectActionsMenuId, setProjectActionsMenuId] = useState<string | null>(null);
  const [projectMountRecoveryNotice, setProjectMountRecoveryNotice] =
    useState<ProjectMountRecoveryEventPayload | null>(null);
  const [projectMountRecoveryStartedAt, setProjectMountRecoveryStartedAt] = useState<number | null>(
    null,
  );
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const minimizeWindowControlButtonRef = useRef<HTMLButtonElement | null>(null);
  const maximizeWindowControlButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeWindowControlButtonRef = useRef<HTMLButtonElement | null>(null);
  const createCodingSessionCommandRef = useRef<(requestedEngineId?: string) => void>(() => {});
  const openFolderHandlerRef = useRef<() => void>(() => {});
  const zoomHandlerRef = useRef<(direction: 'in' | 'out' | 'reset') => void>(() => {});
  const toggleFullScreenHandlerRef = useRef<() => void>(() => {});

  const [terminalRequest, setTerminalRequest] = useState<TerminalCommandRequest | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showWhatsNewModal, setShowWhatsNewModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isDesktopWindowAvailable, setIsDesktopWindowAvailable] = useState(false);
  const [isDesktopWindowMaximized, setIsDesktopWindowMaximized] = useState(false);
  const [isDesktopWindowMinimized, setIsDesktopWindowMinimized] = useState(false);
  const [isDocumentFullscreen, setIsDocumentFullscreen] = useState(false);
  const titleBarWindowDragControllerRef = useRef<ReturnType<typeof createAppHeaderWindowDragController> | null>(null);
  const desktopWindowPromiseRef = useRef<Promise<DesktopWindowHandle | null> | null>(null);
  const isDesktopWindowAvailableRef = useRef(false);
  const isDesktopWindowMaximizedRef = useRef(false);
  const isDesktopWindowMinimizedRef = useRef(false);
  const isDocumentFullscreenRef = useRef(false);
  const desktopWindowStateSyncTokenRef = useRef(0);
  const desktopWindowFrameStateReconciliationTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoverySnapshotPersistTimeoutRef = useRef<number | null>(null);
  const desktopWindowToggleInFlightRef = useRef(false);
  const hasAppliedRecoveredTabRef = useRef(false);
  const hasAnnouncedRecoveryRef = useRef(false);
  const recoverySessionIdRef = useRef('');
  const lastPersistedRecoverySnapshotRef = useRef<WorkbenchRecoverySnapshot | null>(null);
  const pendingAuthTargetTabRef = useRef<AppTab | null>(null);
  const explicitLogoutRedirectRef = useRef(false);
  const pendingImportedProjectIdRef = useRef('');
  const pendingImportedWorkspaceIdRef = useRef('');
  const previousShowWorkspaceMenuRef = useRef(false);
  const projectMountRecoveryIdentityRef = useRef('');
  const projectMountRecoveryActiveSurfaceRef = useRef('');
  const workspaceBootstrapPromiseRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    if (
      !user ||
      isAuthLoading ||
      !isRecoveryHydrated ||
      !workspacesHasFetched ||
      workspaceBootstrapPromiseRef.current
    ) {
      return;
    }

    const activeWorkspaceStillExists =
      scopedActiveWorkspaceId &&
      workspacesById.has(scopedActiveWorkspaceId);
    if (activeWorkspaceStillExists) {
      return;
    }

    const request = resolveEffectiveWorkspaceId({
      createWorkspace,
      currentWorkspaceId: scopedActiveWorkspaceId,
      recoveryWorkspaceId: normalizedRecoverySnapshot.activeWorkspaceId,
      refreshWorkspaces,
      workspaces,
    });
    workspaceBootstrapPromiseRef.current = request;
    let isCancelled = false;
    void request
      .then((resolvedWorkspaceId) => {
        if (isCancelled) {
          return;
        }

        setActiveWorkspaceId((currentWorkspaceId) => {
          const normalizedCurrentWorkspaceId = currentWorkspaceId.trim();
          return normalizedCurrentWorkspaceId === resolvedWorkspaceId
            ? currentWorkspaceId
            : resolvedWorkspaceId;
        });
        setMenuActiveWorkspaceId((currentWorkspaceId) => {
          const normalizedCurrentWorkspaceId = currentWorkspaceId.trim();
          return normalizedCurrentWorkspaceId === resolvedWorkspaceId
            ? currentWorkspaceId
            : resolvedWorkspaceId;
        });

        if (
          scopedActiveWorkspaceId &&
          scopedActiveWorkspaceId !== resolvedWorkspaceId
        ) {
          setActiveProjectId('');
          setActiveCodingSessionId('');
        }
      })
      .catch((error) => {
        console.error('Failed to initialize workspace selection', error);
      })
      .finally(() => {
        if (workspaceBootstrapPromiseRef.current === request) {
          workspaceBootstrapPromiseRef.current = null;
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    createWorkspace,
    isAuthLoading,
    isRecoveryHydrated,
    normalizedRecoverySnapshot.activeWorkspaceId,
    refreshWorkspaces,
    scopedActiveWorkspaceId,
    user,
    workspaces,
    workspacesById,
    workspacesHasFetched,
  ]);

  const openAuthenticationSurface = useCallback((targetTab: AppTab) => {
    explicitLogoutRedirectRef.current = false;
    pendingAuthTargetTabRef.current = targetTab;
    setActiveTab('auth');
  }, []);

  const handleLogout = useCallback(async () => {
    explicitLogoutRedirectRef.current = true;
    pendingAuthTargetTabRef.current = null;
    await logout();
  }, [logout]);

  const handleActiveTabChange = useCallback((nextTab: AppTab) => {
    if (!user && requiresAuthenticatedSession(nextTab)) {
      openAuthenticationSurface(nextTab);
      return;
    }

    startTransition(() => {
      if (nextTab !== 'auth') {
        pendingAuthTargetTabRef.current = null;
      }
      setActiveTab(nextTab);
    });
  }, [openAuthenticationSurface, user]);

  const commitWorkspaceSelection = useCallback((workspaceId: string) => {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      return;
    }

    setActiveWorkspaceId(normalizedWorkspaceId);
    setMenuActiveWorkspaceId(normalizedWorkspaceId);
    setActiveProjectId('');
    setActiveCodingSessionId('');
    setProjectActionsMenuId(null);
  }, []);

  const previewWorkspaceSelection = useCallback((workspaceId: string) => {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      return;
    }

    setMenuActiveWorkspaceId(normalizedWorkspaceId);
    setProjectActionsMenuId(null);
  }, []);

  const closeWorkspaceMenuSurface = useCallback(() => {
    setShowWorkspaceMenu(false);
    setIsCreatingWorkspace(false);
    setNewWorkspaceName('');
    setIsCreatingProject(false);
    setNewProjectName('');
    setProjectActionsMenuId(null);
  }, []);

  const resolvedProjectId = resolveStartupProjectId({
    workspaceId: effectiveWorkspaceId,
    projects: activeProjects,
    recoverySnapshot: normalizedRecoverySnapshot,
  });
  const effectiveProjectId = (scopedActiveProjectId || resolvedProjectId).trim();
  const resolvedCodingSessionId = resolveStartupCodingSessionId({
    projectId: effectiveProjectId,
    projects: activeProjects,
    recoverySnapshot: normalizedRecoverySnapshot,
  });
  const effectiveCodingSessionId = (scopedActiveCodingSessionId || resolvedCodingSessionId).trim();
  const currentUserFallbackRecoverySnapshot =
    lastPersistedRecoverySnapshotRef.current?.userScope === currentWorkbenchUserScope
      ? lastPersistedRecoverySnapshotRef.current
      : normalizedRecoverySnapshot;
  const persistedRecoverySelection = useMemo(() => resolveWorkbenchRecoveryPersistenceSelection({
      currentWorkspaceId: effectiveWorkspaceId,
      currentProjectId: effectiveProjectId,
      currentCodingSessionId: effectiveCodingSessionId,
      fallbackSnapshot: currentUserFallbackRecoverySnapshot,
      hasProjectsFetched: activeProjectsHasFetched,
      hasWorkspacesFetched: workspacesHasFetched,
    }), [
      activeProjectsHasFetched,
      currentUserFallbackRecoverySnapshot,
      effectiveCodingSessionId,
      effectiveProjectId,
      effectiveWorkspaceId,
      workspacesHasFetched,
    ]);
  const recoverySelectionResolutionReady = useMemo(
    () => isWorkbenchRecoverySelectionResolutionReady({
      currentWorkspaceId: effectiveWorkspaceId,
      hasProjectsFetched: activeProjectsHasFetched,
      hasWorkspacesFetched: workspacesHasFetched,
    }),
    [
      activeProjectsHasFetched,
      effectiveWorkspaceId,
      workspacesHasFetched,
    ],
  );
  const recoveryAnnouncement = buildWorkbenchRecoveryAnnouncement({
    recoverySnapshot: normalizedRecoverySnapshot,
    activeWorkspaceId: effectiveWorkspaceId,
    activeProjectId: effectiveProjectId,
    activeCodingSessionId: effectiveCodingSessionId,
  });
  const activeProjectCodingSessions =
    activeProjectsIndex.projectsById.get(effectiveProjectId)?.codingSessions ?? [];
  const activeProjectCodingSessionIds = useMemo(
    () => new Set(activeProjectCodingSessions.map((codingSession) => codingSession.id)),
    [activeProjectCodingSessions],
  );
  const resolveImmediateProjectIndex = useCallback(
    (workspaceId: string) => {
      const normalizedWorkspaceId = workspaceId.trim();
      if (normalizedWorkspaceId === effectiveWorkspaceId) {
        return activeProjectsIndex;
      }
      if (normalizedWorkspaceId === effectiveMenuWorkspaceId) {
        return menuProjectsIndex;
      }
      return null;
    },
    [
      activeProjectsIndex,
      effectiveMenuWorkspaceId,
      effectiveWorkspaceId,
      menuProjectsIndex,
    ],
  );

  const activateImportedProject = useCallback(
    (workspaceId: string, projectId: string) => {
      pendingImportedWorkspaceIdRef.current = workspaceId;
      pendingImportedProjectIdRef.current = projectId;
      setActiveWorkspaceId(workspaceId);
      setMenuActiveWorkspaceId(workspaceId);
      setActiveProjectId(projectId);

      const immediateProjectIndex = resolveImmediateProjectIndex(workspaceId);
      const latestCodingSessionId =
        immediateProjectIndex?.latestCodingSessionIdByProjectId.get(projectId) ?? null;
      setActiveCodingSessionId(latestCodingSessionId ?? '');
    },
    [resolveImmediateProjectIndex],
  );

  const hydrateImportedProjectSelectionInBackground = useCallback(
    (workspaceId: string, projectId: string) => {
      void (async () => {
        try {
          if (
            pendingImportedWorkspaceIdRef.current !== workspaceId ||
            pendingImportedProjectIdRef.current !== projectId
          ) {
            return;
          }

          const hydratedProject = await hydrateImportedProjectFromAuthority({
            knownProjects:
              workspaceId === effectiveWorkspaceId
                ? activeProjects
                : workspaceId === effectiveMenuWorkspaceId
                  ? menuProjects
                  : [],
            projectId,
            projectService,
            userScope: user?.id,
            workspaceId,
          });
          if (!hydratedProject) {
            return;
          }

          setActiveCodingSessionId(hydratedProject.latestCodingSessionId ?? '');
          pendingImportedProjectIdRef.current = '';
          pendingImportedWorkspaceIdRef.current = '';
        } catch (error) {
          console.error('Failed to hydrate imported project state from server authority', error);
        }
      })();
    },
    [
      activeProjects,
      effectiveMenuWorkspaceId,
      effectiveWorkspaceId,
      menuProjects,
      projectService,
      user?.id,
    ],
  );

  useEffect(() => {
    if (isAuthLoading || !isRecoveryHydrated || hasAppliedRecoveredTabRef.current) {
      return;
    }

    hasAppliedRecoveredTabRef.current = true;
    if (shouldBootIntoAuthSurface()) {
      setActiveTab('auth');
      return;
    }
    setActiveTab(resolveInitialAppTab(normalizedRecoverySnapshot.activeTab, Boolean(user)));
  }, [isAuthLoading, isRecoveryHydrated, normalizedRecoverySnapshot.activeTab, user]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const pathname = normalizeAuthSurfaceLocationPath(window.location.pathname);
    if (isAuthSurfaceLocationPath(pathname)) {
      return;
    }

    const hashPath = readAuthSurfaceHashPath();
    if (activeTab === 'auth') {
      if (!isAuthSurfaceLocationPath(hashPath)) {
        replaceAuthSurfaceHashPath(AUTH_SURFACE_DEFAULT_ROUTE);
      }
      return;
    }

    if (isAuthSurfaceLocationPath(hashPath)) {
      replaceAuthSurfaceHashPath(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user) {
      if (activeTab !== 'auth' && requiresAuthenticatedSession(activeTab)) {
        if (explicitLogoutRedirectRef.current) {
          explicitLogoutRedirectRef.current = false;
          pendingAuthTargetTabRef.current = null;
          setActiveTab(GUEST_HOME_APP_TAB);
          return;
        }

        pendingAuthTargetTabRef.current ??= activeTab;
        setActiveTab('auth');
      }
      return;
    }

    explicitLogoutRedirectRef.current = false;
    if (activeTab !== 'auth') {
      return;
    }

    const nextTab = pendingAuthTargetTabRef.current ?? AUTHENTICATED_DEFAULT_APP_TAB;
    pendingAuthTargetTabRef.current = null;
    setActiveTab(nextTab);
  }, [activeTab, isAuthLoading, user]);

  useEffect(() => {
    const previousWorkbenchUserScope = previousWorkbenchUserScopeRef.current;
    if (previousWorkbenchUserScope === currentWorkbenchUserScope) {
      return;
    }

    previousWorkbenchUserScopeRef.current = currentWorkbenchUserScope;
    pendingImportedProjectIdRef.current = '';
    pendingImportedWorkspaceIdRef.current = '';
    lastPersistedRecoverySnapshotRef.current = null;
    hasAnnouncedRecoveryRef.current = false;
    setActiveWorkspaceId('');
    setMenuActiveWorkspaceId('');
    setActiveProjectId('');
    setActiveCodingSessionId('');
    setProjectActionsMenuId(null);
    setShowWorkspaceMenu(false);
  }, [currentWorkbenchUserScope]);

  useEffect(() => {
    if (!isRecoveryHydrated || recoverySessionIdRef.current) {
      return;
    }

    recoverySessionIdRef.current =
      normalizedRecoverySnapshot.sessionId || createWorkbenchRecoverySessionId();
    lastPersistedRecoverySnapshotRef.current = buildWorkbenchRecoverySnapshot({
      userScope: currentWorkbenchUserScope,
      sessionId: recoverySessionIdRef.current,
      activeTab: normalizedRecoverySnapshot.activeTab,
      activeWorkspaceId: normalizedRecoverySnapshot.activeWorkspaceId,
      activeProjectId: normalizedRecoverySnapshot.activeProjectId,
      activeCodingSessionId: normalizedRecoverySnapshot.activeCodingSessionId,
      cleanExit: normalizedRecoverySnapshot.cleanExit,
    });
  }, [currentWorkbenchUserScope, isRecoveryHydrated, normalizedRecoverySnapshot]);

  useEffect(() => {
    if (
      !isRecoveryHydrated ||
      !recoverySelectionResolutionReady ||
      hasAnnouncedRecoveryRef.current ||
      !recoveryAnnouncement
    ) {
      return;
    }

    hasAnnouncedRecoveryRef.current = true;
    addToast(recoveryAnnouncement, 'info');
  }, [
    addToast,
    isRecoveryHydrated,
    recoveryAnnouncement,
    recoverySelectionResolutionReady,
  ]);

  useEffect(() => {
    if (workspaces.length === 0) {
      if (activeWorkspaceId) {
        setActiveWorkspaceId('');
      }
      return;
    }

    if (!workspacesById.has(activeWorkspaceId) && resolvedWorkspaceId) {
      setActiveWorkspaceId(resolvedWorkspaceId);
    }
  }, [activeWorkspaceId, resolvedWorkspaceId, workspaces.length, workspacesById]);

  useEffect(() => {
    if (effectiveWorkspaceId.length > 0 && !activeProjectsHasFetched) {
      return;
    }

    if (activeProjects.length === 0) {
      if (pendingImportedProjectIdRef.current) {
        return;
      }
      if (activeProjectId) {
        setActiveProjectId('');
      }
      return;
    }

    if (
      pendingImportedProjectIdRef.current &&
      activeProjectsIndex.projectsById.has(pendingImportedProjectIdRef.current)
    ) {
      pendingImportedProjectIdRef.current = '';
      pendingImportedWorkspaceIdRef.current = '';
    }

    if (!activeProjectsIndex.projectsById.has(activeProjectId) && resolvedProjectId) {
      setActiveProjectId(resolvedProjectId);
    }
  }, [
    activeProjectId,
    activeProjectsHasFetched,
    activeProjectsIndex,
    effectiveWorkspaceId.length,
    resolvedProjectId,
  ]);

  useEffect(() => {
    if (effectiveWorkspaceId.length > 0 && !activeProjectsHasFetched) {
      return;
    }

    if (activeProjectCodingSessions.length === 0) {
      if (activeCodingSessionId) {
        setActiveCodingSessionId('');
      }
      return;
    }

    if (
      !activeProjectCodingSessionIds.has(activeCodingSessionId) &&
      resolvedCodingSessionId
    ) {
      setActiveCodingSessionId(resolvedCodingSessionId);
      return;
    }

    if (
      activeCodingSessionId &&
      !activeProjectCodingSessionIds.has(activeCodingSessionId)
    ) {
      setActiveCodingSessionId('');
    }
  }, [
    activeCodingSessionId,
    activeProjectsHasFetched,
    activeProjectCodingSessionIds,
    activeProjectCodingSessions.length,
    effectiveProjectId,
    effectiveWorkspaceId.length,
    resolvedCodingSessionId,
  ]);

  const clearPendingRecoverySnapshotPersistence = useCallback(() => {
    if (
      recoverySnapshotPersistTimeoutRef.current !== null &&
      typeof window !== 'undefined'
    ) {
      window.clearTimeout(recoverySnapshotPersistTimeoutRef.current);
      recoverySnapshotPersistTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isRecoveryHydrated) {
      return;
    }

    const nextRecoverySnapshot = buildWorkbenchRecoverySnapshot({
      userScope: currentWorkbenchUserScope,
      sessionId:
        recoverySessionIdRef.current ||
        normalizedRecoverySnapshot.sessionId ||
        createWorkbenchRecoverySessionId(),
      activeTab,
      activeWorkspaceId: persistedRecoverySelection.activeWorkspaceId,
      activeProjectId: persistedRecoverySelection.activeProjectId,
      activeCodingSessionId: persistedRecoverySelection.activeCodingSessionId,
      cleanExit: false,
    });

    recoverySessionIdRef.current = nextRecoverySnapshot.sessionId;

    if (
      lastPersistedRecoverySnapshotRef.current &&
      recoverySnapshotsEqual(lastPersistedRecoverySnapshotRef.current, nextRecoverySnapshot)
    ) {
      return;
    }

    lastPersistedRecoverySnapshotRef.current = nextRecoverySnapshot;
    if (typeof window === 'undefined') {
      persistWorkbenchRecoverySnapshot(nextRecoverySnapshot);
      return;
    }

    clearPendingRecoverySnapshotPersistence();
    recoverySnapshotPersistTimeoutRef.current = window.setTimeout(() => {
      recoverySnapshotPersistTimeoutRef.current = null;
      persistWorkbenchRecoverySnapshot(nextRecoverySnapshot);
    }, WORKBENCH_RECOVERY_PERSIST_DELAY_MS);
  }, [
    activeTab,
    clearPendingRecoverySnapshotPersistence,
    currentWorkbenchUserScope,
    isRecoveryHydrated,
    normalizedRecoverySnapshot,
    persistedRecoverySelection,
  ]);

  useEffect(() => {
    return () => {
      clearPendingRecoverySnapshotPersistence();
    };
  }, [clearPendingRecoverySnapshotPersistence]);

  useEffect(() => {
    if (!isRecoveryHydrated || typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = () => {
      clearPendingRecoverySnapshotPersistence();
      persistWorkbenchRecoverySnapshot(
        buildWorkbenchRecoverySnapshot({
          userScope: currentWorkbenchUserScope,
          sessionId:
            recoverySessionIdRef.current ||
            normalizedRecoverySnapshot.sessionId ||
            createWorkbenchRecoverySessionId(),
          activeTab,
          activeWorkspaceId: persistedRecoverySelection.activeWorkspaceId,
          activeProjectId: persistedRecoverySelection.activeProjectId,
          activeCodingSessionId: persistedRecoverySelection.activeCodingSessionId,
          cleanExit: true,
        }),
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    activeTab,
    clearPendingRecoverySnapshotPersistence,
    currentWorkbenchUserScope,
    isRecoveryHydrated,
    normalizedRecoverySnapshot.sessionId,
    persistedRecoverySelection,
  ]);

  useEffect(() => {
    const wasWorkspaceMenuOpen = previousShowWorkspaceMenuRef.current;
    previousShowWorkspaceMenuRef.current = showWorkspaceMenu;

    if (showWorkspaceMenu && !wasWorkspaceMenuOpen) {
      setMenuActiveWorkspaceId((currentWorkspaceId) =>
        currentWorkspaceId === effectiveWorkspaceId
          ? currentWorkspaceId
          : effectiveWorkspaceId,
      );
      return;
    }

    if (!showWorkspaceMenu && !menuActiveWorkspaceId && effectiveWorkspaceId) {
      setMenuActiveWorkspaceId(effectiveWorkspaceId);
    }
  }, [effectiveWorkspaceId, menuActiveWorkspaceId, showWorkspaceMenu]);

  useEffect(() => {
    const focusTerminalSurface = (options?: { forceWorkspace?: boolean }) => {
      setActiveTab((previousTab) => {
        if (options?.forceWorkspace) {
          return 'terminal';
        }

        if (
          previousTab !== 'terminal' &&
          previousTab !== 'code' &&
          previousTab !== 'studio'
        ) {
          return 'terminal';
        }

        return previousTab;
      });
    };
    const handleOpenTerminal = () => {
      focusTerminalSurface();
    };
    const handleRevealInExplorer = async (path?: string) => {
      try {
        if (await openTauriShellPath(path || '')) {
          addToast(t('app.revealedInExplorer', { path: path || 'project' }), 'info');
        } else {
          addToast(t('app.revealedInExplorerMock', { path: path || 'project' }), 'info');
        }
      } catch (e) {
        addToast(t('app.revealedInExplorerMock', { path: path || 'project' }), 'info');
      }
    };
    const handleOpenSettings = () => {
      setActiveTab('settings');
    };
    const handleTerminalRequest = (req: TerminalCommandRequest) => {
      if (!isWorkspaceTerminalRequest(req)) {
        return;
      }

      setTerminalRequest(req);
      focusTerminalSurface({ forceWorkspace: true });
    };
    const unsubscribeProjectMountRecovery = subscribeProjectMountRecoveryState((payload) => {
      if (payload.state.status !== 'recovering') {
        if (
          projectMountRecoveryActiveSurfaceRef.current &&
          projectMountRecoveryActiveSurfaceRef.current !== payload.surface
        ) {
          return;
        }

        projectMountRecoveryActiveSurfaceRef.current = '';
        projectMountRecoveryIdentityRef.current = '';
        setProjectMountRecoveryNotice(null);
        setProjectMountRecoveryStartedAt(null);
        return;
      }

      projectMountRecoveryActiveSurfaceRef.current = payload.surface;
      const recoveryIdentity = [
        payload.surface,
        payload.projectId ?? '',
        payload.state.path ?? '',
      ].join('::');
      if (projectMountRecoveryIdentityRef.current !== recoveryIdentity) {
        projectMountRecoveryIdentityRef.current = recoveryIdentity;
        setProjectMountRecoveryStartedAt(Date.now());
      }

      setProjectMountRecoveryNotice(payload);
    });
    const unsubscribeTerminal = globalEventBus.on('openTerminal', handleOpenTerminal);
    const unsubscribeReveal = globalEventBus.on('revealInExplorer', handleRevealInExplorer);
    const unsubscribeSettings = globalEventBus.on('openSettings', handleOpenSettings);
    const unsubscribeTerminalReq = globalEventBus.on('terminalRequest', handleTerminalRequest);
    return () => {
      unsubscribeProjectMountRecovery();
      unsubscribeTerminal();
      unsubscribeReveal();
      unsubscribeSettings();
      unsubscribeTerminalReq();
    };
  }, [addToast, t]);

  const hasOpenWorkspaceMenuSurface =
    showWorkspaceMenu ||
    isCreatingWorkspace ||
    isCreatingProject ||
    projectActionsMenuId !== null;

  const handleWorkspaceMenuClickOutside = useCallback(
    (event: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        closeWorkspaceMenuSurface();
      }
    },
    [closeWorkspaceMenuSurface],
  );

  useEffect(() => {
    if (!hasOpenWorkspaceMenuSurface) {
      return;
    }

    document.addEventListener('mousedown', handleWorkspaceMenuClickOutside);
    return () => document.removeEventListener('mousedown', handleWorkspaceMenuClickOutside);
  }, [handleWorkspaceMenuClickOutside, hasOpenWorkspaceMenuSurface]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      if (cmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        void createCodingSessionCommandRef.current();
      } else if (cmdOrCtrl && e.key === 'o') {
        e.preventDefault();
        openFolderHandlerRef.current();
      } else if (cmdOrCtrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        globalEventBus.emit('saveActiveFile');
      } else if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        globalEventBus.emit('saveAllFiles');
      } else if (cmdOrCtrl && e.key === ',') {
        e.preventDefault();
        setActiveTab('settings');
      } else if (cmdOrCtrl && e.key === 'b' && !e.altKey) {
        e.preventDefault();
        globalEventBus.emit('toggleSidebar');
      } else if (cmdOrCtrl && e.key === 'j') {
        e.preventDefault();
        globalEventBus.emit('toggleTerminal');
      } else if (cmdOrCtrl && e.altKey && e.key === 'b') {
        e.preventDefault();
        globalEventBus.emit('toggleDiffPanel');
      } else if (cmdOrCtrl && e.key === 'f') {
        e.preventDefault();
        globalEventBus.emit('findInFiles');
      } else if (cmdOrCtrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomHandlerRef.current('in');
      } else if (cmdOrCtrl && e.key === '-') {
        e.preventDefault();
        zoomHandlerRef.current('out');
      } else if (cmdOrCtrl && e.key === '0') {
        e.preventDefault();
        zoomHandlerRef.current('reset');
      } else if (e.key === 'F11') {
        e.preventDefault();
        toggleFullScreenHandlerRef.current();
      } else if (cmdOrCtrl && e.key === 'p') {
        e.preventDefault();
        globalEventBus.emit('openQuickOpen');
      } else if (cmdOrCtrl && e.shiftKey && e.key === '[') {
        e.preventDefault();
        globalEventBus.emit('previousCodingSession');
      } else if (cmdOrCtrl && e.shiftKey && e.key === ']') {
        e.preventDefault();
        globalEventBus.emit('nextCodingSession');
      } else if (cmdOrCtrl && e.key === '[' && !e.shiftKey) {
        e.preventDefault();
        window.history.back();
      } else if (cmdOrCtrl && e.key === ']' && !e.shiftKey) {
        e.preventDefault();
        window.history.forward();
      } else if (e.key === 'F5' && !cmdOrCtrl) {
        e.preventDefault();
        globalEventBus.emit('startDebugging');
      } else if (cmdOrCtrl && e.key === 'F5') {
        e.preventDefault();
        globalEventBus.emit('runWithoutDebugging');
      } else if (cmdOrCtrl && e.shiftKey && e.key === '`') {
        e.preventDefault();
        emitOpenTerminalRequest(buildDefaultTerminalCommandRequest());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectFolderAndImportProject = async (fallbackProjectName: string) => {
    const folderInfo = await openLocalFolder();
    if (!folderInfo) {
      return null;
    }

    const targetWorkspaceId = await resolveLocalFolderImportWorkspaceId({
      createWorkspace,
      effectiveWorkspaceId:
        effectiveMenuWorkspaceId ||
        effectiveWorkspaceId ||
        activeWorkspaceId ||
        workspaces[0]?.id ||
        '',
      refreshWorkspaces,
      selectWorkspaceId: (refreshedWorkspaces) =>
        resolveStartupWorkspaceId({
          workspaces: refreshedWorkspaces,
          recoverySnapshot: normalizedRecoverySnapshot,
        }) ||
        refreshedWorkspaces[0]?.id ||
        '',
    });
    setActiveWorkspaceId((currentWorkspaceId) => currentWorkspaceId || targetWorkspaceId);
    setMenuActiveWorkspaceId(targetWorkspaceId);
    const normalizedTargetWorkspaceId = targetWorkspaceId.trim();
    const createProjectForTargetWorkspace = (name: string, options?: Parameters<typeof createMenuProject>[1]) => {
      if (normalizedTargetWorkspaceId === menuProjectsScopeWorkspaceId) {
        return createMenuProject(name, options);
      }
      if (normalizedTargetWorkspaceId === projectsWorkspaceId) {
        return createActiveProject(name, options);
      }
      return projectService.createProject(normalizedTargetWorkspaceId, name, options);
    };
    const updateProjectForTargetWorkspace = (
      projectId: string,
      updates: Parameters<typeof updateMenuProject>[1],
    ) => {
      if (normalizedTargetWorkspaceId === menuProjectsScopeWorkspaceId) {
        return updateMenuProject(projectId, updates);
      }
      if (normalizedTargetWorkspaceId === projectsWorkspaceId) {
        return updateActiveProject(projectId, updates);
      }
      return projectService.updateProject(projectId, updates);
    };

    const importedProject = await importLocalFolderProject({
      createProject: createProjectForTargetWorkspace,
      fallbackProjectName,
      folderInfo,
      getProjectByPath: (projectPath) =>
        projectService.getProjectByPath(normalizedTargetWorkspaceId, projectPath),
      mountFolder: (projectId, nextFolderInfo) =>
        fileSystemService.mountFolder(projectId, nextFolderInfo),
      updateProject: updateProjectForTargetWorkspace,
    });

    return {
      ...importedProject,
      workspaceId: targetWorkspaceId,
    };
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    
    try {
      const newWs = await createWorkspace(newWorkspaceName);
      commitWorkspaceSelection(newWs.id);
      setIsCreatingWorkspace(false);
      setNewWorkspaceName('');
      setShowWorkspaceMenu(false);
    } catch (error) {
      console.error("Failed to create workspace", error);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const normalizedProjectName = newProjectName.trim();
      const importedProject = await selectFolderAndImportProject(normalizedProjectName);
      if (!importedProject) {
        return;
      }

      if (
        !importedProject.reusedExistingProject &&
        importedProject.projectName !== normalizedProjectName
      ) {
        const updateImportedProjectName =
          importedProject.workspaceId === menuProjectsScopeWorkspaceId
            ? updateMenuProject
            : importedProject.workspaceId === projectsWorkspaceId
              ? updateActiveProject
              : projectService.updateProject;
        await updateImportedProjectName(importedProject.projectId, {
          name: normalizedProjectName,
        });
      }

      activateImportedProject(importedProject.workspaceId, importedProject.projectId);
      hydrateImportedProjectSelectionInBackground(
        importedProject.workspaceId,
        importedProject.projectId,
      );
      setIsCreatingProject(false);
      setNewProjectName('');
      setShowWorkspaceMenu(false);
    } catch (error) {
      console.error("Failed to create project", error);
    }
  };

  const confirmDeleteWorkspace = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (workspaces.length <= 1) {
      addToast(t('app.cannotDeleteLastWorkspace'), "error");
      return;
    }
    setWorkspaceToDelete(id);
    setShowWorkspaceMenu(false);
  };

  const confirmDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProjectToDelete(id);
    setProjectActionsMenuId(null);
    setShowWorkspaceMenu(false);
  };

  const executeDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    try {
      await deleteWorkspace(workspaceToDelete);
      if (activeWorkspaceId === workspaceToDelete) {
        const remaining = workspaces.filter(w => w.id !== workspaceToDelete);
        if (remaining.length > 0) {
          setActiveWorkspaceId(remaining[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to delete workspace", error);
    } finally {
      setWorkspaceToDelete(null);
    }
  };

  const handleRenameWorkspace = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await updateWorkspace(id, newName.trim());
    } catch (error) {
      console.error("Failed to rename workspace", error);
      addToast(t('app.failedToRenameWorkspace'), "error");
    }
  };

  const handleRenameProject = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await updateMenuProject(id, { name: newName.trim() });
    } catch (error) {
      console.error("Failed to rename project", error);
      addToast(t('app.failedToRenameProject'), "error");
    }
  };

  const executeDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete);
      if (activeProjectId === projectToDelete) {
        setActiveProjectId('');
        setActiveCodingSessionId('');
      }
      addToast(t('app.projectRemoved'), "success");
    } catch (error) {
      console.error("Failed to delete project", error);
      addToast(t('app.failedToRemoveProject'), "error");
    } finally {
      setProjectToDelete(null);
    }
  };

  const handleOpenProjectInExplorer = useCallback(
    (projectPath?: string, projectName?: string) => {
      const normalizedProjectPath = projectPath?.trim() ?? '';
      if (!normalizedProjectPath) {
        addToast(t('app.projectPathUnavailable', { name: projectName ?? 'project' }), 'error');
        return;
      }

      globalEventBus.emit('revealInExplorer', normalizedProjectPath);
    },
    [addToast, t],
  );

  const handleSelectMenuProject = useCallback(
    (projectId: string) => {
      const nextWorkspaceId = effectiveMenuWorkspaceId.trim();
      const nextProjectId = projectId.trim();
      const nextCodingSessionId =
        resolveImmediateProjectIndex(nextWorkspaceId)
          ?.latestCodingSessionIdByProjectId.get(nextProjectId) ?? '';
      const shouldResetCodingSession =
        nextWorkspaceId !== effectiveWorkspaceId || nextProjectId !== effectiveProjectId;

      if (nextWorkspaceId && nextWorkspaceId !== effectiveWorkspaceId) {
        setActiveWorkspaceId(nextWorkspaceId);
      }
      setMenuActiveWorkspaceId(nextWorkspaceId || effectiveWorkspaceId);
      setActiveProjectId(nextProjectId);
      if (shouldResetCodingSession || nextCodingSessionId) {
        setActiveCodingSessionId(nextCodingSessionId);
      }
      setProjectActionsMenuId(null);
      setShowWorkspaceMenu(false);
    },
    [
      effectiveMenuWorkspaceId,
      effectiveProjectId,
      effectiveWorkspaceId,
      resolveImmediateProjectIndex,
    ],
  );

  const getDesktopWindow = useCallback(async (): Promise<DesktopWindowHandle | null> => {
    if (desktopWindowPromiseRef.current) {
      return desktopWindowPromiseRef.current;
    }

    const desktopWindowPromise = (async () => {
      const { isTauri } = await import('@tauri-apps/api/core');
      if (!isTauri()) {
        return null;
      }

      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      return getCurrentWindow() as DesktopWindowHandle;
    })();

    desktopWindowPromiseRef.current = desktopWindowPromise;

    try {
      return await desktopWindowPromise;
    } catch (error) {
      desktopWindowPromiseRef.current = null;
      throw error;
    }
  }, []);

  const applyDesktopWindowFrameState = useCallback(
    (nextState: {
      isAvailable: boolean;
      isMaximized: boolean;
      isMinimized: boolean;
    }) => {
      isDesktopWindowAvailableRef.current = nextState.isAvailable;
      isDesktopWindowMaximizedRef.current = nextState.isMaximized;
      isDesktopWindowMinimizedRef.current = nextState.isMinimized;
      setIsDesktopWindowAvailable(nextState.isAvailable);
      setIsDesktopWindowMaximized(nextState.isMaximized);
      setIsDesktopWindowMinimized(nextState.isMinimized);
    },
    [],
  );

  const syncDesktopWindowFrameState = useCallback(
    async (
      desktopWindow: DesktopWindowHandle,
    ) => {
      const syncToken = ++desktopWindowStateSyncTokenRef.current;
      const [nextIsMaximized, nextIsMinimized] = await Promise.all([
        desktopWindow.isMaximized(),
        desktopWindow.isMinimized(),
      ]);

      if (syncToken !== desktopWindowStateSyncTokenRef.current) {
        return;
      }

      applyDesktopWindowFrameState({
        isAvailable: true,
        isMaximized: nextIsMaximized,
        isMinimized: nextIsMinimized,
      });
    },
    [applyDesktopWindowFrameState],
  );

  const cancelDesktopWindowFrameStateReconciliation = useCallback(() => {
    if (
      desktopWindowFrameStateReconciliationTimeoutRef.current !== null &&
      typeof window !== 'undefined'
    ) {
      window.clearTimeout(desktopWindowFrameStateReconciliationTimeoutRef.current);
      desktopWindowFrameStateReconciliationTimeoutRef.current = null;
    }
  }, []);

  const scheduleDesktopWindowFrameStateReconciliation = (
    desktopWindow: DesktopWindowHandle,
  ) => {
    if (typeof window === 'undefined') {
      void syncDesktopWindowFrameState(desktopWindow);
      return;
    }

    if (desktopWindowFrameStateReconciliationTimeoutRef.current !== null) {
      clearTimeout(desktopWindowFrameStateReconciliationTimeoutRef.current);
    }

    desktopWindowFrameStateReconciliationTimeoutRef.current = setTimeout(() => {
      desktopWindowFrameStateReconciliationTimeoutRef.current = null;
      void syncDesktopWindowFrameState(desktopWindow);
    }, DESKTOP_WINDOW_FRAME_STATE_RECONCILIATION_DELAY_MS);
  };

  useEffect(() => {
    let cancelled = false;
    const unlistenCallbacks: Array<() => void> = [];

    const cancelPendingWork = () => {
      if (typeof window === 'undefined') {
        if (desktopWindowFrameStateReconciliationTimeoutRef.current === null) {
          return;
        }
      }

      cancelDesktopWindowFrameStateReconciliation();
    };

    const registerWindowListener = async (
      register: Promise<() => void>,
    ) => {
      const unlisten = await register;
      if (cancelled) {
        unlisten();
        return;
      }

      unlistenCallbacks.push(unlisten);
    };

    void (async () => {
      try {
        const desktopWindow = await getDesktopWindow();
        if (cancelled) {
          return;
        }

        if (!desktopWindow) {
          applyDesktopWindowFrameState({
            isAvailable: false,
            isMaximized: false,
            isMinimized: false,
          });
          return;
        }

        await syncDesktopWindowFrameState(desktopWindow);
        await registerWindowListener(
          desktopWindow.onResized(() => {
            scheduleDesktopWindowFrameStateReconciliation(desktopWindow);
          }),
        );
        await registerWindowListener(
          desktopWindow.onScaleChanged(() => {
            scheduleDesktopWindowFrameStateReconciliation(desktopWindow);
          }),
        );
        await registerWindowListener(
          desktopWindow.onFocusChanged(() => {
            scheduleDesktopWindowFrameStateReconciliation(desktopWindow);
          }),
        );
      } catch {
        if (cancelled) {
          return;
        }

        applyDesktopWindowFrameState({
          isAvailable: false,
          isMaximized: false,
          isMinimized: false,
        });
      }
    })();

    return () => {
      cancelled = true;
      cancelPendingWork();
      for (const unlisten of unlistenCallbacks) {
        unlisten();
      }
    };
  }, [
    applyDesktopWindowFrameState,
    cancelDesktopWindowFrameStateReconciliation,
    syncDesktopWindowFrameState,
    getDesktopWindow,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const syncFullscreenState = () => {
      const nextIsFullscreen = Boolean(document.fullscreenElement);
      isDocumentFullscreenRef.current = nextIsFullscreen;
      setIsDocumentFullscreen(nextIsFullscreen);
      if (nextIsFullscreen) {
        titleBarWindowDragControllerRef.current?.cancel();
      }
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, []);

  useNativeWindowControlsBridge({
    enabled: isDesktopWindowAvailable,
    isFullscreen: isDocumentFullscreen,
    minimizeButtonRef: minimizeWindowControlButtonRef,
    maximizeButtonRef: maximizeWindowControlButtonRef,
    closeButtonRef: closeWindowControlButtonRef,
  });

  if (titleBarWindowDragControllerRef.current === null) {
    titleBarWindowDragControllerRef.current = createAppHeaderWindowDragController({
      canStartDragging: () => isDesktopWindowAvailableRef.current && !isDocumentFullscreenRef.current,
      startDragging: async () => {
        try {
          const desktopWindow = await getDesktopWindow();
          if (!desktopWindow) {
            return;
          }

          await desktopWindow.startDragging();
        } catch (error) {
          console.warn('Failed to start window dragging', error);
        }
      },
    });
  }

  useEffect(() => {
    const titleBarWindowDragController = titleBarWindowDragControllerRef.current;
    return () => {
      titleBarWindowDragController?.dispose();
    };
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      const desktopWindow = await getDesktopWindow();
      if (!desktopWindow) {
        return;
      }

      cancelDesktopWindowFrameStateReconciliation();
      applyDesktopWindowFrameState({
        isAvailable: true,
        isMaximized: isDesktopWindowMaximizedRef.current,
        isMinimized: true,
      });
      const handledByNativeBridge = await performNativeWindowControlAction('minimize');
      if (!handledByNativeBridge) {
        await desktopWindow.minimize();
      }
      await syncDesktopWindowFrameState(desktopWindow);
    } catch (error) {
      console.warn('Failed to minimize desktop window', error);
    }
  }, [
    applyDesktopWindowFrameState,
    cancelDesktopWindowFrameStateReconciliation,
    getDesktopWindow,
    syncDesktopWindowFrameState,
  ]);

  const handleMaximize = useCallback(async () => {
    try {
      if (desktopWindowToggleInFlightRef.current) {
        return;
      }

      const desktopWindow = await getDesktopWindow();
      if (!desktopWindow) {
        return;
      }

      desktopWindowToggleInFlightRef.current = true;
      applyDesktopWindowFrameState({
        isAvailable: true,
        isMaximized: !isDesktopWindowMaximizedRef.current,
        isMinimized: false,
      });
      cancelDesktopWindowFrameStateReconciliation();

      const settleDesktopWindowToggle = () => {
        desktopWindowToggleInFlightRef.current = false;
        return syncDesktopWindowFrameState(desktopWindow);
      };

      const recoverDesktopWindowToggleFailure = (error: unknown) => {
        desktopWindowToggleInFlightRef.current = false;
        console.warn('Failed to toggle desktop window maximize state', error);
        return syncDesktopWindowFrameState(desktopWindow);
      };

      void performNativeWindowControlAction('toggleMaximize')
        .then((handledByNativeBridge) => {
          if (handledByNativeBridge) {
            return settleDesktopWindowToggle();
          }

          void desktopWindow
            .toggleMaximize()
            .then(() => {
              void settleDesktopWindowToggle();
            })
            .catch((error) => {
              void recoverDesktopWindowToggleFailure(error);
            });

          return undefined;
        })
        .catch((error) => {
          void recoverDesktopWindowToggleFailure(error);
        });
    } catch (error) {
      desktopWindowToggleInFlightRef.current = false;
      console.warn('Failed to toggle desktop window maximize state', error);
    }
  }, [
    applyDesktopWindowFrameState,
    cancelDesktopWindowFrameStateReconciliation,
    getDesktopWindow,
    syncDesktopWindowFrameState,
  ]);

  const handleClose = useCallback(async () => {
    try {
      const handledByNativeBridge = await performNativeWindowControlAction('close');
      if (handledByNativeBridge) {
        return;
      }

      const desktopWindow = await getDesktopWindow();
      if (!desktopWindow) {
        window.close();
        return;
      }

      await desktopWindow.close();
    } catch (error) {
      console.warn('Failed to close desktop window', error);
      window.close();
    }
  }, [getDesktopWindow]);

  const handleTitleBarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const scheduled = titleBarWindowDragControllerRef.current?.handlePointerDown({
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      isPrimary: event.isPrimary,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      target: event.target,
    });
    if (scheduled) {
      event.preventDefault();
    }
  };

  const handleTitleBarDoubleClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      !isDesktopWindowAvailableRef.current ||
      isDocumentFullscreenRef.current ||
      isAppHeaderNoDragTarget(event.target)
    ) {
      return;
    }

    void handleMaximize();
  };

  const handleTitleBarContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!titleBarDragEnabled || isAppHeaderNoDragTarget(event.target)) {
      return;
    }

    event.preventDefault();
  };

  const handleTitleBarDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (!titleBarDragEnabled || isAppHeaderNoDragTarget(event.target)) {
      return;
    }

    event.preventDefault();
  };

  const handleOpenFolder = useCallback(async () => {
    try {
      const importedProject = await selectFolderAndImportProject(t('app.localFolder'));
      if (importedProject) {
        activateImportedProject(importedProject.workspaceId, importedProject.projectId);
        hydrateImportedProjectSelectionInBackground(
          importedProject.workspaceId,
          importedProject.projectId,
        );
        addToast(t('app.openedFolder', { name: importedProject.projectName }), 'success');
      }
    } catch (e) {
      console.error("Failed to open folder", e);
      addToast(t('app.failedToOpenFolder'), 'error');
    }
  }, [
    activateImportedProject,
    addToast,
    hydrateImportedProjectSelectionInBackground,
    selectFolderAndImportProject,
    t,
  ]);

  const handleEditCommand = useCallback((command: string) => {
    const activeEl = document.activeElement;
    const isMonaco = activeEl && activeEl.classList.contains('inputarea');
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && !isMonaco) {
      document.execCommand(command);
    } else {
      globalEventBus.emit('editorCommand', command);
    }
  }, []);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    const currentZoom = parseFloat(document.body.style.zoom || '1');
    if (direction === 'in') document.body.style.zoom = (currentZoom + 0.1).toString();
    else if (direction === 'out') document.body.style.zoom = Math.max(0.5, currentZoom - 0.1).toString();
    else document.body.style.zoom = '1';
  }, []);

  openFolderHandlerRef.current = () => {
    void handleOpenFolder();
  };
  zoomHandlerRef.current = handleZoom;
  toggleFullScreenHandlerRef.current = toggleFullScreen;

  const activeWorkspace = workspacesById.get(effectiveWorkspaceId) || workspaces[0];
  const activeProject = activeProjectsIndex.projectsById.get(effectiveProjectId) ?? null;
  const activeCodingSession =
    activeProjectsIndex.codingSessionLocationsById.get(effectiveCodingSessionId)?.codingSession ??
    null;
  const {
    createCodingSessionWithSelection: createActiveCodingSessionWithSelection,
  } = useWorkbenchChatSelection({
    createCodingSession: createActiveCodingSession,
    currentSessionEngineId: activeCodingSession?.engineId,
    currentSessionModelId: activeCodingSession?.modelId,
    preferences,
    updatePreferences,
  });
  const {
    createCodingSessionWithSelection: createMenuCodingSessionWithSelection,
  } = useWorkbenchChatSelection({
    createCodingSession: createMenuCodingSession,
    currentSessionEngineId: activeCodingSession?.engineId,
    currentSessionModelId: activeCodingSession?.modelId,
    preferences,
    updatePreferences,
  });
  const handleSelectActiveCodingSession = useCallback(
    (
      codingSessionId: string,
      options?: {
        projectId?: string;
      },
    ) => {
      const normalizedCodingSessionId = codingSessionId.trim();
      if (!normalizedCodingSessionId) {
        return;
      }

      const targetProjectId = options?.projectId?.trim() || effectiveProjectId;
      if (targetProjectId) {
        setActiveProjectId(targetProjectId);
      }

      setActiveCodingSessionId(normalizedCodingSessionId);
      setActiveTab((previousActiveTab) =>
        previousActiveTab === 'code' || previousActiveTab === 'studio'
          ? previousActiveTab
          : 'code',
      );
    },
    [effectiveProjectId],
  );
  const handleSelectMenuCreatedCodingSession = useCallback(
    (
      codingSessionId: string,
      options?: {
        projectId?: string;
      },
    ) => {
      const normalizedCodingSessionId = codingSessionId.trim();
      if (!normalizedCodingSessionId) {
        return;
      }

      const targetProjectId = options?.projectId?.trim() || '';
      setActiveWorkspaceId(effectiveMenuWorkspaceId);
      setMenuActiveWorkspaceId(effectiveMenuWorkspaceId);
      if (targetProjectId) {
        setActiveProjectId(targetProjectId);
      }
      setActiveCodingSessionId(normalizedCodingSessionId);
      setActiveTab('code');
      setProjectActionsMenuId(null);
      setShowWorkspaceMenu(false);
    },
    [effectiveMenuWorkspaceId],
  );
  const {
    createCodingSessionFromCurrentProject: createActiveCodingSessionFromCurrentProject,
  } = useWorkbenchCodingSessionCreationActions({
    addToast,
    createCodingSessionWithSelection: createActiveCodingSessionWithSelection,
    currentProjectId: effectiveProjectId,
    selectCodingSession: handleSelectActiveCodingSession,
    labels: {
      creationFailed: t('code.failedToCreateSession'),
      creationSucceeded: t('code.newSessionCreated'),
      noProjectSelected: t('code.selectProjectFirst'),
    },
  });
  const {
    createCodingSessionInProject: createMenuCodingSessionInProject,
  } = useWorkbenchCodingSessionCreationActions({
    addToast,
    createCodingSessionWithSelection: createMenuCodingSessionWithSelection,
    currentProjectId: effectiveProjectId,
    selectCodingSession: handleSelectMenuCreatedCodingSession,
    labels: {
      creationFailed: t('code.failedToCreateSession'),
      creationSucceeded: t('code.newSessionCreated'),
      noProjectSelected: t('app.noProjectsFound'),
    },
  });
  const newSessionEngineCatalog = useMemo(
    () =>
      resolveWorkbenchNewSessionEngineCatalog(
        {
          currentSessionEngineId: activeCodingSession?.engineId,
          currentSessionModelId: activeCodingSession?.modelId,
          preferredEngineId: preferences.codeEngineId,
          preferredModelId: preferences.codeModelId,
        },
        preferences,
      ),
    [
      activeCodingSession?.engineId,
      activeCodingSession?.modelId,
      preferences,
    ],
  );
  const availableNewSessionEngines = newSessionEngineCatalog.availableEngines;
  const titleBarDragEnabled = isDesktopWindowAvailable && !isDocumentFullscreen;
  const titleBarDragSurfaceClass = titleBarDragEnabled
    ? 'cursor-grab border-white/[0.10] text-gray-200 hover:border-white/[0.16] hover:bg-white/[0.04] active:cursor-grabbing active:bg-white/[0.06]'
    : isDesktopWindowMinimized
      ? 'cursor-default border-white/[0.06] text-gray-500'
      : 'cursor-default border-white/[0.06] text-gray-400';
  const shouldShowWorkbenchHeaderChrome = Boolean(user) && activeTab !== 'auth';

  const handleToggleRecording = useCallback(() => {
    const nextRecordingState = !isRecording;
    setIsRecording(nextRecordingState);
    addToast(
      nextRecordingState ? t('app.traceRecordingStarted') : t('app.traceRecordingStopped'),
      'success',
    );
  }, [addToast, isRecording, t]);
  const handleCreateProjectSession = useCallback(
    async (projectId: string, requestedEngineId?: string) => {
      const normalizedProjectId = projectId.trim();
      if (!menuProjectsIndex.projectsById.has(normalizedProjectId)) {
        addToast(t('app.noProjectsFound'), 'error');
        return;
      }

      await createMenuCodingSessionInProject(normalizedProjectId, requestedEngineId);
    },
    [addToast, createMenuCodingSessionInProject, menuProjectsIndex, t],
  );
  const handleCreateCodingSessionCommand = useCallback(
    (requestedEngineId?: string) => {
      void createActiveCodingSessionFromCurrentProject(requestedEngineId);
    },
    [createActiveCodingSessionFromCurrentProject],
  );
  createCodingSessionCommandRef.current = handleCreateCodingSessionCommand;

  const fileMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.newSession'),
        shortcut: 'Ctrl+N',
        onClick: () =>
          handleCreateCodingSessionCommand(newSessionEngineCatalog.preferredSelection.engineId),
      },
      ...availableNewSessionEngines.map((engine) => ({
        label: `${engine.label} ${t('app.menu.newSession')}`,
        onClick: () => handleCreateCodingSessionCommand(engine.id),
      })),
      { label: '', divider: true },
      { label: t('app.menu.openFolder'), shortcut: 'Ctrl+O', onClick: handleOpenFolder },
      { label: '', divider: true },
      {
        label: t('app.menu.save'),
        shortcut: 'Ctrl+S',
        onClick: () => globalEventBus.emit('saveActiveFile'),
      },
      {
        label: t('app.menu.saveAll'),
        shortcut: 'Ctrl+Shift+S',
        onClick: () => globalEventBus.emit('saveAllFiles'),
      },
      { label: '', divider: true },
      { label: t('app.menu.logOut'), onClick: () => void handleLogout() },
      { label: t('app.menu.exit'), onClick: handleClose },
      { label: t('app.menu.settings'), shortcut: 'Ctrl+,', onClick: () => setActiveTab('settings') },
      { label: '', divider: true },
      { label: t('app.menu.aboutCodex'), onClick: () => setShowAboutModal(true) },
    ],
    [
      availableNewSessionEngines,
      handleClose,
      handleCreateCodingSessionCommand,
      handleOpenFolder,
      handleLogout,
      newSessionEngineCatalog.preferredSelection.engineId,
      t,
    ],
  );

  const editMenuItems = useMemo<TopMenuItem[]>(
    () => [
      { label: t('app.menu.undo'), shortcut: 'Ctrl+Z', onClick: () => handleEditCommand('undo') },
      { label: t('app.menu.redo'), shortcut: 'Ctrl+Y', onClick: () => handleEditCommand('redo') },
      { label: '', divider: true },
      { label: t('app.menu.cut'), shortcut: 'Ctrl+X', onClick: () => handleEditCommand('cut') },
      { label: t('app.menu.copy'), shortcut: 'Ctrl+C', onClick: () => handleEditCommand('copy') },
      { label: t('app.menu.paste'), shortcut: 'Ctrl+V', onClick: () => handleEditCommand('paste') },
      {
        label: t('app.menu.delete'),
        shortcut: 'Del',
        onClick: () => handleEditCommand('delete'),
      },
      { label: '', divider: true },
      {
        label: t('app.menu.selectAll'),
        shortcut: 'Ctrl+A',
        onClick: () => handleEditCommand('selectAll'),
      },
    ],
    [handleEditCommand, t],
  );

  const viewMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.toggleSidebar'),
        shortcut: 'Ctrl+B',
        onClick: () => globalEventBus.emit('toggleSidebar'),
      },
      {
        label: t('app.menu.toggleTerminal'),
        shortcut: 'Ctrl+J',
        onClick: () => {
          if (activeTab !== 'code') {
            setActiveTab('code');
          }
          setTimeout(() => globalEventBus.emit('toggleTerminal'), 100);
        },
      },
      {
        label: t('app.menu.toggleDiffPanel'),
        shortcut: 'Alt+Ctrl+B',
        onClick: () => globalEventBus.emit('toggleDiffPanel'),
      },
      {
        label: t('app.menu.find'),
        shortcut: 'Ctrl+F',
        onClick: () => globalEventBus.emit('findInFiles'),
      },
      { label: '', divider: true },
      { label: t('app.menu.zoomIn'), shortcut: 'Ctrl+=', onClick: () => handleZoom('in') },
      { label: t('app.menu.zoomOut'), shortcut: 'Ctrl+-', onClick: () => handleZoom('out') },
      { label: t('app.menu.actualSize'), shortcut: 'Ctrl+0', onClick: () => handleZoom('reset') },
      { label: '', divider: true },
      {
        label: t('app.menu.toggleFullScreen'),
        shortcut: 'F11',
        onClick: toggleFullScreen,
      },
    ],
    [activeTab, handleZoom, t, toggleFullScreen],
  );

  const goMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.goToFile'),
        shortcut: 'Ctrl+P',
        onClick: () => globalEventBus.emit('openQuickOpen'),
      },
      { label: '', divider: true },
      {
        label: t('app.menu.previousCodingSession'),
        shortcut: 'Ctrl+Shift+[',
        onClick: () => globalEventBus.emit('previousCodingSession'),
      },
      {
        label: t('app.menu.nextCodingSession'),
        shortcut: 'Ctrl+Shift+]',
        onClick: () => globalEventBus.emit('nextCodingSession'),
      },
      { label: t('app.menu.back'), shortcut: 'Ctrl+[', onClick: () => window.history.back() },
      {
        label: t('app.menu.forward'),
        shortcut: 'Ctrl+]',
        onClick: () => window.history.forward(),
      },
    ],
    [t],
  );

  const runMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.startDebugging'),
        shortcut: 'F5',
        onClick: () => globalEventBus.emit('startDebugging'),
      },
      {
        label: t('app.menu.runWithoutDebugging'),
        shortcut: 'Ctrl+F5',
        onClick: () => globalEventBus.emit('runWithoutDebugging'),
      },
      { label: '', divider: true },
      {
        label: t('app.menu.addConfiguration'),
        onClick: () => globalEventBus.emit('addRunConfiguration'),
      },
    ],
    [t],
  );

  const terminalMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.newTerminal'),
        shortcut: 'Ctrl+Shift+`',
        onClick: () => emitOpenTerminalRequest(buildDefaultTerminalCommandRequest()),
      },
      { label: '', divider: true },
      { label: t('app.menu.runTask'), onClick: () => globalEventBus.emit('runTask') },
    ],
    [t],
  );

  const windowMenuItems = useMemo<TopMenuItem[]>(
    () => [
      { label: t('app.menu.minimize'), onClick: handleMinimize },
      { label: t('app.menu.maximize'), onClick: handleMaximize },
      { label: t('app.menu.close'), onClick: handleClose },
    ],
    [handleClose, handleMaximize, handleMinimize, t],
  );

  const helpMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.documentation'),
        onClick: () => window.open('https://github.com', '_blank'),
      },
      { label: t('app.menu.whatsNew'), onClick: () => setShowWhatsNewModal(true) },
      { label: t('app.menu.skills'), onClick: () => setActiveTab('skills') },
      { label: '', divider: true },
      {
        label: t('app.menu.keyboardShortcuts'),
        shortcut: 'Ctrl+K Ctrl+R',
        onClick: () => setShowShortcutsModal(true),
      },
      { label: '', divider: true },
      {
        label: isRecording
          ? t('app.menu.stopTraceRecording')
          : t('app.menu.startTraceRecording'),
        onClick: handleToggleRecording,
      },
      { label: '', divider: true },
      { label: t('app.menu.aboutCodex'), onClick: () => setShowAboutModal(true) },
    ],
    [handleToggleRecording, isRecording, t],
  );

  const handleWorkspaceMenuToggle = useCallback(() => {
    if (showWorkspaceMenu) {
      closeWorkspaceMenuSurface();
      return;
    }

    setShowWorkspaceMenu(true);
  }, [closeWorkspaceMenuSurface, showWorkspaceMenu]);
  const handleStartWorkspaceRename = useCallback((workspaceId: string, currentName: string) => {
    setRenamingWorkspaceId(workspaceId);
    setRenameWorkspaceValue(currentName);
  }, []);
  const handleFinishWorkspaceRename = useCallback(() => {
    setRenamingWorkspaceId(null);
  }, []);
  const handleStartProjectRename = useCallback((projectId: string, currentName: string) => {
    setRenamingProjectId(projectId);
    setRenameProjectValue(currentName);
  }, []);
  const handleFinishProjectRename = useCallback(() => {
    setRenamingProjectId(null);
  }, []);
  const handleToggleProjectActionsMenu = useCallback((projectId: string) => {
    setProjectActionsMenuId((currentValue) => (currentValue === projectId ? null : projectId));
  }, []);
  const handleStartCreatingWorkspace = useCallback(() => {
    setIsCreatingWorkspace(true);
  }, []);
  const handleCancelCreatingWorkspace = useCallback(() => {
    setIsCreatingWorkspace(false);
  }, []);
  const handleWorkspaceNameChange = useCallback((value: string) => {
    setNewWorkspaceName(value);
  }, []);
  const handleStartCreatingProject = useCallback(() => {
    setIsCreatingProject(true);
  }, []);
  const handleCancelCreatingProject = useCallback(() => {
    setIsCreatingProject(false);
  }, []);
  const handleProjectNameChange = useCallback((value: string) => {
    setNewProjectName(value);
  }, []);
  const handleCloseWorkspaceDeleteDialog = useCallback(() => {
    setWorkspaceToDelete(null);
  }, []);
  const handleCloseProjectDeleteDialog = useCallback(() => {
    setProjectToDelete(null);
  }, []);

  if (isAuthLoading) {
    return (
      <div className="flex h-full w-full bg-[#0e0e11] text-white items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
      <div
        className="flex flex-col h-full w-full bg-[#0e0e11] text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30"
      >
      <BirdcoderAppHeader
        centerContent={shouldShowWorkbenchHeaderChrome ? (
          <AppWorkspaceMenu
            workspaceMenuRef={workspaceMenuRef}
            activeWorkspace={activeWorkspace}
            activeProjectName={activeProject?.name ?? null}
            effectiveWorkspaceId={effectiveWorkspaceId}
            effectiveMenuWorkspaceId={effectiveMenuWorkspaceId}
            effectiveProjectId={effectiveProjectId}
            showWorkspaceMenu={showWorkspaceMenu}
            workspaces={workspaces}
            menuProjects={menuProjects}
            menuProjectsHasFetched={menuProjectsHasFetched}
            shouldUseDistinctMenuProjectsStore={shouldUseDistinctMenuProjectsStore}
            isWorkspacesLoading={isWorkspacesLoading}
            hasActiveProjectsFetched={activeProjectsHasFetched}
            projectMountRecoveryNotice={projectMountRecoveryNotice}
            projectMountRecoveryStartedAt={projectMountRecoveryStartedAt}
            isCreatingWorkspace={isCreatingWorkspace}
            newWorkspaceName={newWorkspaceName}
            isCreatingProject={isCreatingProject}
            newProjectName={newProjectName}
            renamingWorkspaceId={renamingWorkspaceId}
            renameWorkspaceValue={renameWorkspaceValue}
            renamingProjectId={renamingProjectId}
            renameProjectValue={renameProjectValue}
            projectActionsMenuId={projectActionsMenuId}
            availableNewSessionEngines={availableNewSessionEngines}
            preferredEngineId={newSessionEngineCatalog.preferredSelection.engineId}
            onToggleMenu={handleWorkspaceMenuToggle}
            onCloseMenuSurface={closeWorkspaceMenuSurface}
            onPreviewWorkspaceSelection={previewWorkspaceSelection}
            onStartWorkspaceRename={handleStartWorkspaceRename}
            onWorkspaceRenameValueChange={setRenameWorkspaceValue}
            onFinishWorkspaceRename={handleFinishWorkspaceRename}
            onCommitWorkspaceRename={handleRenameWorkspace}
            onConfirmDeleteWorkspace={confirmDeleteWorkspace}
            onSelectProject={handleSelectMenuProject}
            onStartProjectRename={handleStartProjectRename}
            onProjectRenameValueChange={setRenameProjectValue}
            onFinishProjectRename={handleFinishProjectRename}
            onCommitProjectRename={handleRenameProject}
            onCreateProjectSession={handleCreateProjectSession}
            onToggleProjectActionsMenu={handleToggleProjectActionsMenu}
            onOpenProjectInExplorer={handleOpenProjectInExplorer}
            onConfirmDeleteProject={confirmDeleteProject}
            onStartCreatingWorkspace={handleStartCreatingWorkspace}
            onCancelCreatingWorkspace={handleCancelCreatingWorkspace}
            onWorkspaceNameChange={handleWorkspaceNameChange}
            onCreateWorkspace={handleCreateWorkspace}
            onStartCreatingProject={handleStartCreatingProject}
            onCancelCreatingProject={handleCancelCreatingProject}
            onProjectNameChange={handleProjectNameChange}
            onCreateProject={handleCreateProject}
          />
        ) : null}
        closeButtonRef={closeWindowControlButtonRef}
        handleClose={handleClose}
        handleMaximize={handleMaximize}
        handleMinimize={handleMinimize}
        isDesktopWindowAvailable={isDesktopWindowAvailable}
        isDesktopWindowMaximized={isDesktopWindowMaximized}
        isDesktopWindowMinimized={isDesktopWindowMinimized}
        leftAddon={shouldShowWorkbenchHeaderChrome ? (
          <>
            <TopMenu label={t('app.menu.file')} items={fileMenuItems} />
            <TopMenu label={t('app.menu.edit')} items={editMenuItems} />
            <TopMenu label={t('app.menu.view')} items={viewMenuItems} />
            <TopMenu label={t('app.menu.go')} items={goMenuItems} />
            <TopMenu label={t('app.menu.run')} items={runMenuItems} />
            <TopMenu label={t('app.menu.terminal')} items={terminalMenuItems} />
            <TopMenu label={t('app.menu.window')} items={windowMenuItems} />
            <TopMenu label={t('app.menu.help')} items={helpMenuItems} />
          </>
        ) : null}
        maximizeButtonRef={maximizeWindowControlButtonRef}
        minimizeButtonRef={minimizeWindowControlButtonRef}
        onContextMenu={handleTitleBarContextMenu}
        onDoubleClick={handleTitleBarDoubleClick}
        onDragStart={handleTitleBarDragStart}
        onPointerDown={handleTitleBarPointerDown}
        t={t}
        titleBarDragSurfaceClass={titleBarDragSurfaceClass}
      />

      <AppMainBody
        activeTab={activeTab}
        isAuthenticated={Boolean(user)}
        terminalRequest={terminalRequest}
        workspaceId={effectiveWorkspaceId}
        projectId={effectiveProjectId}
        projectName={activeProject?.name}
        codingSessionId={effectiveCodingSessionId}
        onActiveTabChange={handleActiveTabChange}
        onRequireAuth={openAuthenticationSurface}
        onProjectChange={setActiveProjectId}
        onCodingSessionChange={setActiveCodingSessionId}
      />

      <AppShellDialogs
        workspaceToDelete={workspaceToDelete}
        projectToDelete={projectToDelete}
        showAboutModal={showAboutModal}
        showWhatsNewModal={showWhatsNewModal}
        showShortcutsModal={showShortcutsModal}
        onCloseWorkspaceDelete={handleCloseWorkspaceDeleteDialog}
        onConfirmWorkspaceDelete={executeDeleteWorkspace}
        onCloseProjectDelete={handleCloseProjectDeleteDialog}
        onConfirmProjectDelete={executeDeleteProject}
        onCloseAbout={() => setShowAboutModal(false)}
        onCloseWhatsNew={() => setShowWhatsNewModal(false)}
        onCloseShortcuts={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
