/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useEffect, useState } from 'react';
import {
  Code2,
  LayoutTemplate,
  PanelsTopLeft,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  UserCircle,
  Zap,
} from 'lucide-react';
import { AuthShell } from '@sdkwork/birdcoder-pc-iam';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import type { AppTab } from '@sdkwork/birdcoder-pc-types';
import {
  useBirdcoderTerminalLaunchPlanResolver,
  type TerminalCommandRequest,
} from '@sdkwork/birdcoder-pc-commons';
import { useTranslation } from 'react-i18next';
import { PRIMARY_PERSISTED_APP_TABS } from './birdcoderAppConstants.ts';
import { SurfaceLoader } from './birdcoderAppSurfaceLoader.tsx';
import {
  AuthPage,
  CodePage,
  MultiWindowProgrammingPage,
  SettingsPage,
  SkillsPage,
  StudioPage,
  TemplatesPage,
  TerminalDesktopApp,
  UserPage,
  VipPage,
} from './birdcoderAppLazyPages.tsx';
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
  onCodingSessionChange: (codingSessionId: string, projectId?: string) => void;
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

export const isWorkspaceTerminalRequest = (request: TerminalCommandRequest): boolean =>
  request.surface === 'workspace';

export const AppMainBody = React.memo(function AppMainBody({
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
          {activeTab === 'auth' && (
            <AuthShell>
              <AuthPage />
            </AuthShell>
          )}
          {activeTab === 'user' && (
            <UserPage
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
