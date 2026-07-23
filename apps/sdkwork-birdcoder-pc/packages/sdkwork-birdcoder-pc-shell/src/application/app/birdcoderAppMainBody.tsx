/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useEffect, useState } from 'react';
import {
  Code2,
  Crown,
  PanelsTopLeft,
  Settings,
  Sparkles,
  Terminal,
  UserCircle,
} from 'lucide-react';
import { AuthShell } from '@sdkwork/birdcoder-pc-iam';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import type { AppTab } from '@sdkwork/birdcoder-pc-contracts-commons';
import { useBirdcoderTerminalLaunchPlanResolver } from '@sdkwork/birdcoder-pc-workbench/terminal/useBirdcoderTerminalLaunchPlanResolver';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { useTranslation } from 'react-i18next';
import { PRIMARY_PERSISTED_APP_TABS } from './birdcoderAppConstants.ts';
import { SurfaceLoader } from './birdcoderAppSurfaceLoader.tsx';
import { SurfaceErrorBoundaryWithTranslation } from './birdcoderAppErrorBoundary.tsx';
import {
  AuthPage,
  CodePage,
  MultiWindowProgrammingPage,
  SettingsPage,
  StudioPage,
  TerminalDesktopApp,
  UserPage,
  VipPage,
} from './birdcoderAppLazyPages.tsx';
interface AppMainBodyProps {
  activeTab: AppTab;
  isAuthenticated: boolean;
  terminalRequest?: TerminalCommandRequest;
  projectId: string;
  projectName?: string;
  agentSessionId: string;
  onActiveTabChange: (tab: AppTab) => void;
  onRequireAuth: (targetTab: AppTab) => void;
  onProjectChange: (projectId: string) => void;
  onAgentSessionChange: (agentSessionId: string, projectId?: string) => void;
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

export const isProjectTerminalRequest = (request: TerminalCommandRequest): boolean =>
  request.surface === 'project';

export const AppMainBody = React.memo(function AppMainBody({
  activeTab,
  isAuthenticated,
  terminalRequest,
  projectId,
  projectName,
  agentSessionId,
  onActiveTabChange,
  onRequireAuth,
  onProjectChange,
  onAgentSessionChange,
}: AppMainBodyProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const handleTerminalLaunchBlocked = React.useCallback(
    (message: string) => addToast(message, 'error'),
    [addToast],
  );
  const resolveTerminalLaunchPlan = useBirdcoderTerminalLaunchPlanResolver(
    projectId || null,
    handleTerminalLaunchBlocked,
  );
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
      <div className="birdcoder-app-sidebar w-14 flex flex-col items-center py-4 border-r justify-between shrink-0">
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
          </div>
          <div className="flex flex-col gap-3 items-center w-full px-2">
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('user')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'user' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '250ms' }} title={t('app.userProfile')}>
              <UserCircle size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('vip')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'vip' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '300ms' }} title="Token Plan">
              <Crown size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onActiveTabChange('settings')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'settings' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '350ms' }} title={t('app.settings')}>
              <Settings size={22} strokeWidth={1.5} />
            </Button>
          </div>
        </div>

      <div className="flex-1 flex flex-col overflow-hidden relative bg-[#0e0e11]">
        <Suspense fallback={<SurfaceLoader />}>
          {mountedPrimaryTabs.has('code') && (
            <PersistentAppTabPanel isActive={activeTab === 'code'}>
              <SurfaceErrorBoundaryWithTranslation
                surface="code"
                onRecover={() => onActiveTabChange('settings')}
              >
                <CodePage
                  isVisible={activeTab === 'code'}
                  projectId={projectId}
                  initialAgentSessionId={agentSessionId}
                  onProjectChange={onProjectChange}
                  onAgentSessionChange={onAgentSessionChange}
                />
              </SurfaceErrorBoundaryWithTranslation>
            </PersistentAppTabPanel>
          )}
          {mountedPrimaryTabs.has('studio') && (
            <PersistentAppTabPanel isActive={activeTab === 'studio'}>
              <SurfaceErrorBoundaryWithTranslation
                surface="studio"
                onRecover={() => onActiveTabChange('code')}
              >
                <StudioPage
                  isVisible={activeTab === 'studio'}
                  projectId={projectId}
                  initialAgentSessionId={agentSessionId}
                  onProjectChange={onProjectChange}
                  onAgentSessionChange={onAgentSessionChange}
                />
              </SurfaceErrorBoundaryWithTranslation>
            </PersistentAppTabPanel>
          )}
          {mountedPrimaryTabs.has('multiwindow') && (
            <PersistentAppTabPanel isActive={activeTab === 'multiwindow'}>
              <SurfaceErrorBoundaryWithTranslation
                surface="multiwindow"
                onRecover={() => onActiveTabChange('code')}
              >
                <MultiWindowProgrammingPage
                  isVisible={activeTab === 'multiwindow'}
                  projectId={projectId}
                  initialAgentSessionId={agentSessionId}
                  onProjectChange={onProjectChange}
                  onAgentSessionChange={onAgentSessionChange}
                />
              </SurfaceErrorBoundaryWithTranslation>
            </PersistentAppTabPanel>
          )}
          {mountedPrimaryTabs.has('terminal') && (
            <PersistentAppTabPanel isActive={activeTab === 'terminal'}>
              <SurfaceErrorBoundaryWithTranslation
                surface="terminal"
                onRecover={() => onActiveTabChange('code')}
              >
                <TerminalDesktopApp
                  launchRequest={terminalRequest}
                  launchRequestKey={terminalRequest?.timestamp ?? null}
                  resolveLaunchPlan={resolveTerminalLaunchPlan}
                  showWindowControls={false}
                  projectId={projectId}
                />
              </SurfaceErrorBoundaryWithTranslation>
            </PersistentAppTabPanel>
          )}
          {activeTab === 'auth' && (
            <SurfaceErrorBoundaryWithTranslation
              surface="auth"
              onRecover={() => onActiveTabChange('code')}
            >
              <AuthShell>
                <AuthPage />
              </AuthShell>
            </SurfaceErrorBoundaryWithTranslation>
          )}
          {activeTab === 'user' && (
            <SurfaceErrorBoundaryWithTranslation
              surface="user"
              onRecover={() => onActiveTabChange('code')}
            >
              <UserPage
                onAuthenticationRequired={() => onRequireAuth('user')}
              />
            </SurfaceErrorBoundaryWithTranslation>
          )}
          {activeTab === 'vip' && (
            <SurfaceErrorBoundaryWithTranslation
              surface="vip"
              onRecover={() => onActiveTabChange('code')}
            >
              <VipPage
                onAuthenticationRequired={() => onRequireAuth('vip')}
              />
            </SurfaceErrorBoundaryWithTranslation>
          )}
          {activeTab === 'settings' && (
            <SurfaceErrorBoundaryWithTranslation
              surface="settings"
              onRecover={() => onActiveTabChange('code')}
            >
              <SettingsPage
                currentProjectId={projectId || undefined}
                currentProjectName={projectName}
                onBack={() => onActiveTabChange('code')}
              />
            </SurfaceErrorBoundaryWithTranslation>
          )}
        </Suspense>
      </div>
    </div>
  );
});

AppMainBody.displayName = 'AppMainBody';
