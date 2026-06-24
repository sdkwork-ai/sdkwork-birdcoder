import { startTransition, useCallback, useEffect, useRef } from 'react';
import type { AppTab } from '@sdkwork/birdcoder-pc-types';
import {
  AUTH_SURFACE_DEFAULT_ROUTE,
  isAuthSurfaceLocationPath,
  normalizeAuthSurfaceLocationPath,
  readAuthSurfaceHashPath,
  replaceAuthSurfaceHashPath,
  shouldBootIntoAuthSurface,
} from '@sdkwork/birdcoder-pc-iam';

export const GUEST_HOME_APP_TAB: AppTab = 'templates';
export const AUTHENTICATED_DEFAULT_APP_TAB: AppTab = 'code';

const AUTH_REQUIRED_APP_TABS = new Set<AppTab>([
  'code',
  'studio',
  'multiwindow',
  'terminal',
  'user',
  'vip',
  'settings',
]);

export function requiresAuthenticatedSession(tab: AppTab): boolean {
  return AUTH_REQUIRED_APP_TABS.has(tab);
}

export function resolveInitialAppTab(tab: AppTab, isAuthenticated: boolean): AppTab {
  if (isAuthenticated) {
    return tab === 'auth' ? AUTHENTICATED_DEFAULT_APP_TAB : tab;
  }

  if (tab === 'auth' || requiresAuthenticatedSession(tab)) {
    return GUEST_HOME_APP_TAB;
  }

  return tab;
}

export function resolveBirdCoderInitialAppTab(): AppTab {
  return shouldBootIntoAuthSurface() ? 'auth' : GUEST_HOME_APP_TAB;
}

interface UseBirdCoderAuthAppTabRoutingOptions {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user: { id?: string } | null | undefined;
  isAuthLoading: boolean;
  isRecoveryHydrated: boolean;
  recoveredTab: AppTab;
  logout: () => Promise<void>;
}

export function useBirdCoderAuthAppTabRouting({
  activeTab,
  setActiveTab,
  user,
  isAuthLoading,
  isRecoveryHydrated,
  recoveredTab,
  logout,
}: UseBirdCoderAuthAppTabRoutingOptions) {
  const hasAppliedRecoveredTabRef = useRef(false);
  const pendingAuthTargetTabRef = useRef<AppTab | null>(null);
  const explicitLogoutRedirectRef = useRef(false);

  useEffect(() => {
    if (isAuthLoading || !isRecoveryHydrated || hasAppliedRecoveredTabRef.current) {
      return;
    }

    hasAppliedRecoveredTabRef.current = true;
    if (shouldBootIntoAuthSurface()) {
      setActiveTab('auth');
      return;
    }

    setActiveTab(resolveInitialAppTab(recoveredTab, Boolean(user)));
  }, [isAuthLoading, isRecoveryHydrated, recoveredTab, setActiveTab, user]);

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
  }, [activeTab, isAuthLoading, setActiveTab, user]);

  const openAuthenticationSurface = useCallback((targetTab: AppTab) => {
    explicitLogoutRedirectRef.current = false;
    pendingAuthTargetTabRef.current = targetTab;
    setActiveTab('auth');
  }, [setActiveTab]);

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
  }, [openAuthenticationSurface, setActiveTab, user]);

  return {
    handleActiveTabChange,
    handleLogout,
    openAuthenticationSurface,
  };
}
