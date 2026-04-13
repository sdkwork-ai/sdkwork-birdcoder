import React, { useState } from 'react';
import { ChevronDown, Sun, Moon, MonitorSmartphone, X } from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-ui';
import { useToast } from '@sdkwork/birdcoder-commons';
import { useTranslation } from 'react-i18next';
import { SettingsProps } from './types';

export function AppearanceSettings({ settings, updateSetting }: SettingsProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importThemeType, setImportThemeType] = useState<'light' | 'dark'>('light');
  const [importThemeData, setImportThemeData] = useState('');

  const applyThemePreset = (type: 'light' | 'dark', themeName: string) => {
    const presets: Record<string, any> = {
      'Codex Light': { lightAccent: '#0285FF', lightBackground: '#FFFFFF', lightForeground: '#0D0D0D' },
      'GitHub Light': { lightAccent: '#0969DA', lightBackground: '#FFFFFF', lightForeground: '#24292F' },
      'Solarized Light': { lightAccent: '#268BD2', lightBackground: '#FDF6E3', lightForeground: '#657B83' },
      'Codex Dark': { darkAccent: '#339CFF', darkBackground: '#181818', darkForeground: '#FFFFFF' },
      'GitHub Dark': { darkAccent: '#58A6FF', darkBackground: '#0D1117', darkForeground: '#C9D1D9' },
      'Dracula': { darkAccent: '#FF79C6', darkBackground: '#282A36', darkForeground: '#F8F8F2' },
    };
    
    const preset = presets[themeName];
    if (preset) {
      Object.entries(preset).forEach(([key, value]) => {
        updateSetting(key, value);
      });
      updateSetting(`${type}ThemeName`, themeName);
    }
  };

  const handleImportTheme = () => {
    try {
      const parsedData = JSON.parse(importThemeData);
      const prefix = importThemeType === 'light' ? 'light' : 'dark';
      
      if (parsedData.name) updateSetting(`${prefix}ThemeName`, parsedData.name);
      if (parsedData.accent) updateSetting(`${prefix}Accent`, parsedData.accent);
      if (parsedData.background) updateSetting(`${prefix}Background`, parsedData.background);
      if (parsedData.foreground) updateSetting(`${prefix}Foreground`, parsedData.foreground);
      if (parsedData.uiFont) updateSetting(`${prefix}UiFont`, parsedData.uiFont);
      if (parsedData.codeFont) updateSetting(`${prefix}CodeFont`, parsedData.codeFont);
      if (parsedData.translucent !== undefined) updateSetting(`${prefix}Translucent`, parsedData.translucent);
      if (parsedData.contrast !== undefined) updateSetting(`${prefix}Contrast`, parsedData.contrast);
      
      const typeLabel = importThemeType === 'light' ? t('common.light') : t('common.dark');
      addToast(t('settings.appearance.themeImported', { type: typeLabel }), 'success');
      setIsImportModalOpen(false);
      setImportThemeData('');
    } catch (e) {
      addToast(t('settings.appearance.invalidThemeJson'), 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">{t('settings.appearance.title')}</h1>
            <div className="text-sm text-gray-500">{t('settings.appearance.description')}</div>
          </div>
          <div className="flex bg-[#18181b] rounded-lg p-1 border border-white/10 gap-1">
            <Button 
              variant={settings.theme === 'Light' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`h-8 ${settings.theme !== 'Light' ? 'text-gray-400 hover:text-white' : ''}`}
              onClick={() => updateSetting('theme', 'Light')}
            >
              <Sun size={14} className="mr-2" />
              {t('common.light')}
            </Button>
            <Button 
              variant={settings.theme === 'Dark' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`h-8 ${settings.theme !== 'Dark' ? 'text-gray-400 hover:text-white' : ''}`}
              onClick={() => updateSetting('theme', 'Dark')}
            >
              <Moon size={14} className="mr-2" />
              {t('common.dark')}
            </Button>
            <Button 
              variant={settings.theme === 'System' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`h-8 ${settings.theme !== 'System' ? 'text-gray-400 hover:text-white' : ''}`}
              onClick={() => updateSetting('theme', 'System')}
            >
              <MonitorSmartphone size={14} className="mr-2" />
              {t('common.system')}
            </Button>
          </div>
        </div>
        
        <div className="bg-[#18181b] rounded-xl border border-white/10 overflow-hidden mb-8">
          {/* Code Preview Area */}
          <div className="bg-[#0e0e11] p-4 font-mono text-sm border-b border-white/10 flex">
            <div className="flex-1 border-r border-white/10 pr-4" style={{ backgroundColor: settings.lightBackground || '#FFFFFF', color: settings.lightForeground || '#0D0D0D' }}>
              <div className="flex opacity-50"><span className="w-6 text-right mr-4">1</span><span style={{ color: settings.lightAccent || '#0285FF' }}>const</span> <span>themePreview</span>: <span>ThemeConfig</span> = {'{'}</div>
              <div className="flex" style={{ backgroundColor: `${settings.lightAccent || '#0285FF'}20` }}><span className="w-6 text-right mr-4" style={{ color: settings.lightAccent || '#0285FF' }}>2</span><span>surface</span>: <span>"sidebar"</span>,</div>
              <div className="flex opacity-50"><span className="w-6 text-right mr-4">3</span><span>accent</span>: <span style={{ color: settings.lightAccent || '#0285FF' }}>"{settings.lightAccent || '#0285FF'}"</span>,</div>
              <div className="flex opacity-50"><span className="w-6 text-right mr-4">4</span><span>contrast</span>: <span>{settings.lightContrast || 45}</span>,</div>
              <div className="flex opacity-50"><span className="w-6 text-right mr-4">5</span>{'}'};</div>
            </div>
            <div className="flex-1 pl-4" style={{ backgroundColor: settings.darkBackground || '#181818', color: settings.darkForeground || '#FFFFFF' }}>
              <div className="flex opacity-50"><span className="w-6 text-right mr-4">1</span><span style={{ color: settings.darkAccent || '#339CFF' }}>const</span> <span>themePreview</span>: <span>ThemeConfig</span> = {'{'}</div>
              <div className="flex" style={{ backgroundColor: `${settings.darkAccent || '#339CFF'}20` }}><span className="w-6 text-right mr-4" style={{ color: settings.darkAccent || '#339CFF' }}>2</span><span>surface</span>: <span>"sidebar-elevated"</span>,</div>
              <div className="flex opacity-50"><span className="w-6 text-right mr-4">3</span><span>accent</span>: <span style={{ color: settings.darkAccent || '#339CFF' }}>"{settings.darkAccent || '#339CFF'}"</span>,</div>
              <div className="flex opacity-50"><span className="w-6 text-right mr-4">4</span><span>contrast</span>: <span>{settings.darkContrast || 60}</span>,</div>
              <div className="flex opacity-50"><span className="w-6 text-right mr-4">5</span>{'}'};</div>
            </div>
          </div>

          {/* Light Theme Settings */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-medium">{t('settings.appearance.lightTheme')}</div>
              <div className="flex items-center gap-4">
                <Button variant="link" className="h-auto p-0 text-gray-400 hover:text-white" onClick={() => {
                  setImportThemeType('light');
                  setImportThemeData('');
                  setIsImportModalOpen(true);
                }}>{t('common.import')}</Button>
                <Button variant="link" className="h-auto p-0 text-gray-400 hover:text-white" onClick={() => {
                  const themeData = {
                    name: settings.lightThemeName || 'Codex Light',
                    accent: settings.lightAccent || '#0285FF',
                    background: settings.lightBackground || '#FFFFFF',
                    foreground: settings.lightForeground || '#0D0D0D',
                    uiFont: settings.lightUiFont || '-apple-system, BlinkMacSystemFont',
                    codeFont: settings.lightCodeFont || 'ui-monospace, SFMono-Regular',
                    translucent: settings.lightTranslucent !== false,
                    contrast: settings.lightContrast || 45
                  };
                  navigator.clipboard.writeText(JSON.stringify(themeData, null, 2));
                  addToast(t('settings.appearance.themeCopied', { type: t('common.light') }), 'success');
                }}>{t('settings.appearance.copyTheme')}</Button>
                <div className="relative">
                  <select 
                    value={settings.lightThemeName || 'Codex Light'}
                    onChange={(e) => applyThemePreset('light', e.target.value)}
                    className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-1.5 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-48"
                  >
                    <option value="Codex Light">Codex Light</option>
                    <option value="GitHub Light">GitHub Light</option>
                    <option value="Solarized Light">Solarized Light</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Accent</div>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.lightAccent || '#0285FF'} onChange={(e) => updateSetting('lightAccent', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                  <div className="bg-[#0e0e11] text-gray-300 text-xs px-3 py-1.5 rounded-md font-mono border border-white/10 w-20 text-center">{settings.lightAccent || '#0285FF'}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Background</div>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.lightBackground || '#FFFFFF'} onChange={(e) => updateSetting('lightBackground', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                  <div className="bg-[#0e0e11] text-gray-300 text-xs px-3 py-1.5 rounded-md font-mono border border-white/10 w-20 text-center">{settings.lightBackground || '#FFFFFF'}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Foreground</div>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.lightForeground || '#0D0D0D'} onChange={(e) => updateSetting('lightForeground', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                  <div className="bg-[#0e0e11] text-gray-300 text-xs px-3 py-1.5 rounded-md font-mono border border-white/10 w-20 text-center">{settings.lightForeground || '#0D0D0D'}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">UI font</div>
                <input type="text" value={settings.lightUiFont || '-apple-system, BlinkMacSystemFont'} onChange={(e) => updateSetting('lightUiFont', e.target.value)} className="bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 outline-none w-64 focus:border-blue-500/50" />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Code font</div>
                <input type="text" value={settings.lightCodeFont || 'ui-monospace, SFMono-Regular'} onChange={(e) => updateSetting('lightCodeFont', e.target.value)} className="bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 outline-none w-64 focus:border-blue-500/50" />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Translucent sidebar</div>
                <div 
                  className={`w-10 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${settings.lightTranslucent !== false ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
                  onClick={() => updateSetting('lightTranslucent', settings.lightTranslucent === false ? true : false)}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${settings.lightTranslucent !== false ? 'right-1' : 'left-1'}`}></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Contrast</div>
                <div className="flex items-center gap-4 w-64">
                  <input type="range" min="0" max="100" value={settings.lightContrast || 45} onChange={(e) => updateSetting('lightContrast', parseInt(e.target.value))} className="flex-1 accent-blue-500" />
                  <span className="text-sm text-gray-400 w-6 text-right">{settings.lightContrast || 45}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dark Theme Settings */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-medium">{t('settings.appearance.darkTheme')}</div>
              <div className="flex items-center gap-4">
                <Button variant="link" className="h-auto p-0 text-gray-400 hover:text-white" onClick={() => {
                  setImportThemeType('dark');
                  setImportThemeData('');
                  setIsImportModalOpen(true);
                }}>{t('common.import')}</Button>
                <Button variant="link" className="h-auto p-0 text-gray-400 hover:text-white" onClick={() => {
                  const themeData = {
                    name: settings.darkThemeName || 'Codex Dark',
                    accent: settings.darkAccent || '#339CFF',
                    background: settings.darkBackground || '#181818',
                    foreground: settings.darkForeground || '#FFFFFF',
                    uiFont: settings.darkUiFont || '-apple-system, BlinkMacSystemFont',
                    codeFont: settings.darkCodeFont || 'ui-monospace, SFMono-Regular',
                    translucent: settings.darkTranslucent !== false,
                    contrast: settings.darkContrast || 60
                  };
                  navigator.clipboard.writeText(JSON.stringify(themeData, null, 2));
                  addToast(t('settings.appearance.themeCopied', { type: t('common.dark') }), 'success');
                }}>{t('settings.appearance.copyTheme')}</Button>
                <div className="relative">
                  <select 
                    value={settings.darkThemeName || 'Codex Dark'}
                    onChange={(e) => applyThemePreset('dark', e.target.value)}
                    className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-1.5 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-48"
                  >
                    <option value="Codex Dark">Codex Dark</option>
                    <option value="GitHub Dark">GitHub Dark</option>
                    <option value="Dracula">Dracula</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Accent</div>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.darkAccent || '#339CFF'} onChange={(e) => updateSetting('darkAccent', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                  <div className="bg-[#0e0e11] text-gray-300 text-xs px-3 py-1.5 rounded-md font-mono border border-white/10 w-20 text-center">{settings.darkAccent || '#339CFF'}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Background</div>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.darkBackground || '#181818'} onChange={(e) => updateSetting('darkBackground', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                  <div className="bg-[#0e0e11] text-gray-300 text-xs px-3 py-1.5 rounded-md font-mono border border-white/10 w-20 text-center">{settings.darkBackground || '#181818'}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Foreground</div>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.darkForeground || '#FFFFFF'} onChange={(e) => updateSetting('darkForeground', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                  <div className="bg-[#0e0e11] text-gray-300 text-xs px-3 py-1.5 rounded-md font-mono border border-white/10 w-20 text-center">{settings.darkForeground || '#FFFFFF'}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">UI font</div>
                <input type="text" value={settings.darkUiFont || '-apple-system, BlinkMacSystemFont'} onChange={(e) => updateSetting('darkUiFont', e.target.value)} className="bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 outline-none w-64 focus:border-blue-500/50" />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Code font</div>
                <input type="text" value={settings.darkCodeFont || 'ui-monospace, SFMono-Regular'} onChange={(e) => updateSetting('darkCodeFont', e.target.value)} className="bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 outline-none w-64 focus:border-blue-500/50" />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Translucent sidebar</div>
                <div 
                  className={`w-10 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${settings.darkTranslucent !== false ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
                  onClick={() => updateSetting('darkTranslucent', settings.darkTranslucent === false ? true : false)}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${settings.darkTranslucent !== false ? 'right-1' : 'left-1'}`}></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">Contrast</div>
                <div className="flex items-center gap-4 w-64">
                  <input type="range" min="0" max="100" value={settings.darkContrast || 60} onChange={(e) => updateSetting('darkContrast', parseInt(e.target.value))} className="flex-1 accent-blue-500" />
                  <span className="text-sm text-gray-400 w-6 text-right">{settings.darkContrast || 60}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.appearance.usePointerCursor')}</div>
              <div className="text-sm text-gray-500">{t('settings.appearance.usePointerCursorDesc')}</div>
            </div>
            <div 
              className={`w-10 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${settings.usePointerCursor ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
              onClick={() => updateSetting('usePointerCursor', !settings.usePointerCursor)}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${settings.usePointerCursor ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.appearance.uiFontSize')}</div>
              <div className="text-sm text-gray-500">{t('settings.appearance.uiFontSizeDesc')}</div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={settings.uiFontSize} 
                onChange={(e) => updateSetting('uiFontSize', e.target.value)}
                className="bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none w-20 text-center focus:border-blue-500/50" 
              />
              <span className="text-sm text-gray-500">px</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.appearance.codeFontSize')}</div>
              <div className="text-sm text-gray-500">{t('settings.appearance.codeFontSizeDesc')}</div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={settings.codeFontSize} 
                onChange={(e) => updateSetting('codeFontSize', e.target.value)}
                className="bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none w-20 text-center focus:border-blue-500/50" 
              />
              <span className="text-sm text-gray-500">px</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.appearance.showLineNumbers')}</div>
              <div className="text-sm text-gray-500">{t('settings.appearance.showLineNumbersDesc')}</div>
            </div>
            <div 
              className={`w-10 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${settings.showLineNumbers ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
              onClick={() => updateSetting('showLineNumbers', !settings.showLineNumbers)}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${settings.showLineNumbers ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.appearance.wordWrap')}</div>
              <div className="text-sm text-gray-500">{t('settings.appearance.wordWrapDesc')}</div>
            </div>
            <div 
              className={`w-10 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${settings.wordWrap ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
              onClick={() => updateSetting('wordWrap', !settings.wordWrap)}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${settings.wordWrap ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4">
            <div>
              <div className="text-white font-medium">{t('settings.appearance.minimap')}</div>
              <div className="text-sm text-gray-500">{t('settings.appearance.minimapDesc')}</div>
            </div>
            <div 
              className={`w-10 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${settings.minimap ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
              onClick={() => updateSetting('minimap', !settings.minimap)}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${settings.minimap ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>
        </div>
      </div>

      {isImportModalOpen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-[500px] bg-[#18181b] border border-white/10 rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-gray-200">
                {t('settings.appearance.importTheme')} {importThemeType === 'light' ? t('common.light') : t('common.dark')}
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('settings.appearance.themeJsonData')}</label>
                <textarea 
                  value={importThemeData}
                  onChange={(e) => setImportThemeData(e.target.value)}
                  placeholder='{"name": "My Theme", "accent": "#000000", ...}'
                  className="w-full h-48 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-blue-500/50 resize-none" 
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(false)}>{t('common.cancel')}</Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white" onClick={handleImportTheme}>{t('settings.appearance.importTheme')}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
