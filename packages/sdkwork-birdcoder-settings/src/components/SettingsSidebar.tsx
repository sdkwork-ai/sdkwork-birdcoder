import React from 'react';
import { Settings, User, Monitor, GitBranch, Terminal, Folder, Archive, ArrowLeft, Sun, LogOut, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type SettingsTab = 'general' | 'appearance' | 'config' | 'personalization' | 'mcp' | 'git' | 'environment' | 'worktree' | 'archived' | 'skills';

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  onBack?: () => void;
  onLogout: () => void;
}

export function SettingsSidebar({ activeTab, setActiveTab, onBack, onLogout }: SettingsSidebarProps) {
  const { t } = useTranslation();

  return (
    <div className="w-64 flex flex-col border-r border-white/5 bg-[#0e0e11] text-sm relative h-full">
      <div className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto">
        <div 
          className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer px-2 py-1.5 rounded transition-colors mb-2 animate-in fade-in slide-in-from-left-4 fill-mode-both"
          style={{ animationDelay: '0ms' }}
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          <span>{t('common.backToApp')}</span>
        </div>
        
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors animate-in fade-in slide-in-from-left-4 fill-mode-both ${activeTab === 'general' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          style={{ animationDelay: '50ms' }}
          onClick={() => setActiveTab('general')}
        >
          <Settings size={16} />
          <span>{t('settings.general')}</span>
        </div>
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors animate-in fade-in slide-in-from-left-4 fill-mode-both ${activeTab === 'appearance' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          style={{ animationDelay: '100ms' }}
          onClick={() => setActiveTab('appearance')}
        >
          <Sun size={16} />
          <span>{t('settings.sidebar.appearance')}</span>
        </div>
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors animate-in fade-in slide-in-from-left-4 fill-mode-both ${activeTab === 'config' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          style={{ animationDelay: '150ms' }}
          onClick={() => setActiveTab('config')}
        >
          <Monitor size={16} />
          <span>{t('settings.sidebar.config')}</span>
        </div>
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors animate-in fade-in slide-in-from-left-4 fill-mode-both ${activeTab === 'personalization' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          style={{ animationDelay: '200ms' }}
          onClick={() => setActiveTab('personalization')}
        >
          <User size={16} />
          <span>{t('settings.sidebar.personalization')}</span>
        </div>
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors animate-in fade-in slide-in-from-left-4 fill-mode-both ${activeTab === 'mcp' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          style={{ animationDelay: '250ms' }}
          onClick={() => setActiveTab('mcp')}
        >
          <Monitor size={16} />
          <span>{t('settings.sidebar.mcpServers')}</span>
        </div>
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors animate-in fade-in slide-in-from-left-4 fill-mode-both ${activeTab === 'git' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          style={{ animationDelay: '300ms' }}
          onClick={() => setActiveTab('git')}
        >
          <GitBranch size={16} />
          <span>{t('settings.sidebar.git')}</span>
        </div>
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors animate-in fade-in slide-in-from-left-4 fill-mode-both ${activeTab === 'environment' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          style={{ animationDelay: '350ms' }}
          onClick={() => setActiveTab('environment')}
        >
          <Terminal size={16} />
          <span>{t('settings.sidebar.environment')}</span>
        </div>
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors animate-in fade-in slide-in-from-left-4 fill-mode-both ${activeTab === 'worktree' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          style={{ animationDelay: '400ms' }}
          onClick={() => setActiveTab('worktree')}
        >
          <Folder size={16} />
          <span>{t('settings.sidebar.worktree')}</span>
        </div>
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors animate-in fade-in slide-in-from-left-4 fill-mode-both ${activeTab === 'archived' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          style={{ animationDelay: '450ms' }}
          onClick={() => setActiveTab('archived')}
        >
          <Archive size={16} />
          <span>{t('settings.sidebar.archivedThreads')}</span>
        </div>
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors animate-in fade-in slide-in-from-left-4 fill-mode-both ${activeTab === 'skills' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          style={{ animationDelay: '500ms' }}
          onClick={() => setActiveTab('skills')}
        >
          <Zap size={16} />
          <span>{t('settings.sidebar.skills')}</span>
        </div>
      </div>
      
      <div className="p-4 border-t border-white/10 animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '550ms' }}>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition-colors text-red-400 hover:bg-red-900/20 hover:text-red-300"
        >
          <LogOut size={16} />
          <span>{t('common.signOut')}</span>
        </button>
      </div>
    </div>
  );
}
