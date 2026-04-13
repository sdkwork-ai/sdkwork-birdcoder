import React, { useState, useRef, useEffect } from 'react';
import { Search, Download, Settings, Zap, ChevronLeft, Package, Star, Clock, CheckCircle2, Github, Globe, Shield, Calendar, Tag, ExternalLink, FileText, Terminal, Copy, Check, Server, ChevronDown, Loader2, X, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { usePersistedState, useToast } from '@sdkwork/birdcoder-commons';
import { Skill, SkillPackage } from './types';
import { MOCK_SKILLS, MOCK_PACKAGES } from './mockData';

const REGISTRIES = [
  { id: 'official', name: '瀹樻柟闀滃儚 (Official)', url: 'https://registry.sdkwork.com' },
  { id: 'aliyun', name: '闃块噷浜?(Alibaba Cloud)', url: 'https://mirrors.aliyun.com/sdkwork' },
  { id: 'tencent', name: '鑵捐浜?(Tencent Cloud)', url: 'https://mirrors.cloud.tencent.com/sdkwork' },
  { id: 'volcengine', name: '鐏北寮曟搸 (Volcengine)', url: 'https://mirrors.volcengine.com/sdkwork' },
];

export function SkillsPage() {
  const [activeSkillTab, setActiveSkillTab] = useState<'hub' | 'sdkwork' | 'installed' | 'packages'>('hub');
  const [currentView, setCurrentView] = useState<'main' | 'packageDetail' | 'skillDetail'>('main');
  const [selectedPackage, setSelectedPackage] = useState<SkillPackage | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [selectedRegistryId, setSelectedRegistryId] = usePersistedState<string>('skills', 'registry', REGISTRIES[0].id);
  const [showRegistryMenu, setShowRegistryMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [skills, setSkills] = useState<Skill[]>(MOCK_SKILLS);
  const [packages, setPackages] = useState<SkillPackage[]>(MOCK_PACKAGES);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [activeCardMenu, setActiveCardMenu] = useState<string | null>(null);
  const [showDetailRegistryMenu, setShowDetailRegistryMenu] = useState(false);
  const registryMenuRef = useRef<HTMLDivElement>(null);
  const detailRegistryMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const selectedRegistry = REGISTRIES.find(r => r.id === selectedRegistryId) || REGISTRIES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (registryMenuRef.current && !registryMenuRef.current.contains(event.target as Node)) {
        setShowRegistryMenu(false);
      }
      if (detailRegistryMenuRef.current && !detailRegistryMenuRef.current.contains(event.target as Node)) {
        setShowDetailRegistryMenu(false);
      }
      if (!(event.target as Element).closest('.card-menu-container')) {
        setActiveCardMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowRegistryMenu(false);
        setShowDetailRegistryMenu(false);
        setActiveCardMenu(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(text);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const handlePackageClick = (pkg: SkillPackage) => {
    setSelectedPackage(pkg);
    setCurrentView('packageDetail');
  };

  const handleSkillClick = (skill: Skill) => {
    setSelectedSkill(skill);
    setCurrentView('skillDetail');
  };

  const handleBack = () => {
    if (currentView === 'skillDetail' && selectedPackage) {
      setCurrentView('packageDetail');
    } else {
      setCurrentView('main');
      setSelectedPackage(null);
      setSelectedSkill(null);
    }
  };

  const handleInstall = (e: React.MouseEvent, skill: Skill, registry: typeof REGISTRIES[0] = selectedRegistry) => {
    e.stopPropagation();
    setInstallingId(skill.id);
    setTimeout(() => {
      setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, isInstalled: true } : s));
      setInstallingId(null);
      addToast(`${skill.name} installed successfully from ${registry.name}`, 'success');
    }, 1500);
  };

  const handleInstallPackage = (e: React.MouseEvent, pkg: SkillPackage, registry: typeof REGISTRIES[0] = selectedRegistry) => {
    e.stopPropagation();
    setInstallingId(pkg.id);
    setTimeout(() => {
      const pkgSkillIds = pkg.skills.map(s => s.id);
      setSkills(prev => prev.map(s => pkgSkillIds.includes(s.id) ? { ...s, isInstalled: true } : s));
      setInstallingId(null);
      addToast(`${pkg.name} package installed successfully from ${registry.name}`, 'success');
    }, 2000);
  };

  const renderEmptyState = (query: string) => (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 bg-[#18181b]/50 border border-white/10 rounded-2xl flex items-center justify-center text-gray-500 mb-4">
        <Search size={24} />
      </div>
      <h3 className="text-lg font-medium text-gray-200 mb-2">No results found</h3>
      <p className="text-gray-500 text-sm max-w-sm">
        We couldn't find any skills or packages matching "{query}". Try adjusting your search terms.
      </p>
    </div>
  );

  const renderSkillCard = (skill: Skill, index: number = 0) => (
    <div 
      key={skill.id} 
      className={`flex flex-col bg-[#18181b]/40 border border-white/5 hover:border-white/10 hover:bg-[#18181b]/80 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] group relative animate-in fade-in slide-in-from-bottom-4 fill-mode-both ${activeCardMenu === skill.id ? 'z-50' : 'z-10'}`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => handleSkillClick(skill)}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full rounded-tr-2xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="flex items-start justify-between mb-5">
        <div className="w-14 h-14 rounded-xl bg-[#0e0e11] border border-white/5 flex items-center justify-center text-3xl shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
          {skill.icon}
        </div>
        {skill.isInstalled ? (
          <button 
            className="opacity-0 group-hover:opacity-100 transition-all text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 active:scale-95"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings size={16} />
          </button>
        ) : (
          <div className="relative flex items-center bg-blue-500 rounded-lg shadow-lg shadow-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 card-menu-container">
            <button 
              className="px-3 py-1.5 text-sm text-white font-medium hover:bg-blue-600 active:scale-95 rounded-l-lg disabled:opacity-50 flex items-center gap-1.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              onClick={(e) => handleInstall(e, skill, selectedRegistry)}
              disabled={installingId === skill.id}
            >
              {installingId === skill.id ? <Loader2 size={14} className="animate-spin" /> : 'Install'}
            </button>
            <div className="w-px h-4 bg-blue-600/50"></div>
            <button 
              className="px-1.5 py-1.5 text-white hover:bg-blue-600 active:scale-95 rounded-r-lg disabled:opacity-50 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCardMenu(activeCardMenu === skill.id ? null : skill.id);
              }}
              disabled={installingId === skill.id}
            >
              <ChevronDown size={14} />
            </button>
            
            {activeCardMenu === skill.id && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-[#18181b] border border-white/10 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-white/5 mb-1">Install from...</div>
                {REGISTRIES.map(reg => (
                  <button
                    key={reg.id}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 active:bg-white/20 hover:text-white transition-colors flex items-center justify-between focus-visible:outline-none focus-visible:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRegistryId(reg.id);
                      setActiveCardMenu(null);
                      handleInstall(e, skill, reg);
                    }}
                  >
                    <span className="truncate">{reg.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <h3 className="text-gray-200 font-medium text-base mb-1 group-hover:text-white transition-colors">{skill.name}</h3>
      <p className="text-gray-500 text-sm line-clamp-2 mb-4 flex-1">{skill.desc}</p>
      <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-4 border-t border-white/10">
        <span className={skill.author === 'Sdkwork' ? 'text-blue-400 font-medium' : ''}>{skill.author}</span>
        {skill.isInstalled ? (
          <span className="text-green-400 flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            Active
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <Download size={12} />
            <span>{skill.installs}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderPackageCard = (pkg: SkillPackage, index: number = 0) => (
    <div 
      key={pkg.id} 
      className={`flex flex-col bg-[#18181b]/40 border border-white/5 hover:border-white/10 hover:bg-[#18181b]/80 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] group relative animate-in fade-in slide-in-from-bottom-4 fill-mode-both ${activeCardMenu === pkg.id ? 'z-50' : 'z-10'}`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => handlePackageClick(pkg)}
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-bl-full rounded-tr-2xl -z-10 opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="flex items-start justify-between mb-5">
        <div className="w-16 h-16 rounded-xl bg-[#0e0e11] border border-white/5 flex items-center justify-center text-4xl shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
          {pkg.icon}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0e0e11]/50 px-2 py-1 rounded-md border border-white/5 text-xs text-gray-400">
            <Package size={12} />
            <span>{pkg.skills.length} Skills</span>
          </div>
          <div className="relative flex items-center bg-blue-500 rounded-lg shadow-lg shadow-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 card-menu-container">
            <button 
              className="px-3 py-1.5 text-sm text-white font-medium hover:bg-blue-600 active:scale-95 rounded-l-lg disabled:opacity-50 flex items-center gap-1.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              onClick={(e) => handleInstallPackage(e, pkg, selectedRegistry)}
              disabled={installingId === pkg.id}
            >
              {installingId === pkg.id ? <Loader2 size={14} className="animate-spin" /> : 'Install'}
            </button>
            <div className="w-px h-4 bg-blue-600/50"></div>
            <button 
              className="px-1.5 py-1.5 text-white hover:bg-blue-600 active:scale-95 rounded-r-lg disabled:opacity-50 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCardMenu(activeCardMenu === pkg.id ? null : pkg.id);
              }}
              disabled={installingId === pkg.id}
            >
              <ChevronDown size={14} />
            </button>
            
            {activeCardMenu === pkg.id && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-[#18181b] border border-white/10 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-white/5 mb-1">Install from...</div>
                {REGISTRIES.map(reg => (
                  <button
                    key={reg.id}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 active:bg-white/20 hover:text-white transition-colors flex items-center justify-between focus-visible:outline-none focus-visible:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRegistryId(reg.id);
                      setActiveCardMenu(null);
                      handleInstallPackage(e, pkg, reg);
                    }}
                  >
                    <span className="truncate">{reg.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <h3 className="text-gray-200 font-medium text-lg mb-2">{pkg.name}</h3>
      <p className="text-gray-500 text-sm line-clamp-2 mb-4 flex-1">{pkg.desc}</p>
      <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-4 border-t border-white/10">
        <span className="text-blue-400 font-medium">{pkg.author}</span>
        <div className="flex items-center gap-1">
          <Download size={12} />
          <span>{pkg.installs}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#0e0e11] text-gray-300 font-sans">
      {/* Header */}
      <div className="flex flex-col border-b border-white/10 bg-[#18181b]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleBack}
                  disabled={currentView === 'main'}
                  className={`text-xl font-semibold tracking-tight transition-colors ${currentView === 'main' ? 'text-gray-100 cursor-default' : 'text-gray-400 hover:text-gray-200 cursor-pointer'}`}
                >
                  Skills Hub
                </button>
                {currentView !== 'main' && (
                  <>
                    <ChevronRight size={16} className="text-gray-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-200 truncate max-w-[200px] sm:max-w-[300px]">
                      {currentView === 'packageDetail' ? selectedPackage?.name : selectedSkill?.name}
                    </span>
                  </>
                )}
              </div>
              {currentView === 'main' && (
                <p className="text-xs text-gray-400 mt-0.5">Discover and install powerful skills and packages</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Registry Selector */}
            <div className="relative" ref={registryMenuRef}>
              <button 
                className="flex items-center gap-2 px-3 py-2 bg-[#0e0e11]/50 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white hover:border-white/20 hover:bg-[#0e0e11] active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                onClick={() => setShowRegistryMenu(!showRegistryMenu)}
              >
                <Server size={14} className="text-blue-400" />
                <span className="max-w-[120px] truncate">{selectedRegistry.name}</span>
                <ChevronDown size={14} className="text-gray-500" />
              </button>
              
              {showRegistryMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-white/5 mb-1">
                    Select Registry Mirror
                  </div>
                  {REGISTRIES.map(registry => (
                    <button
                      key={registry.id}
                      className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-white/10 active:bg-white/20 transition-colors focus-visible:outline-none focus-visible:bg-white/10"
                      onClick={() => {
                        setSelectedRegistryId(registry.id);
                        setShowRegistryMenu(false);
                        addToast(`Switched to ${registry.name}`, 'success');
                      }}
                    >
                      <span className={selectedRegistry.id === registry.id ? 'text-white font-medium' : 'text-gray-300'}>
                        {registry.name}
                      </span>
                      {selectedRegistry.id === registry.id && <Check size={14} className="text-blue-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        {currentView === 'main' && (
          <div className="flex items-center px-6 gap-8 overflow-x-auto custom-scrollbar">
            {[
              { id: 'hub', label: 'Skills Hub', count: null },
              { id: 'packages', label: 'Packages', count: packages.length },
              { id: 'sdkwork', label: 'Sdkwork Skills', count: skills.filter(s => s.author === 'Sdkwork').length },
              { id: 'installed', label: 'Installed', count: skills.filter(s => s.isInstalled).length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSkillTab(tab.id as any)}
                className={`relative py-3 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeSkillTab === tab.id ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    activeSkillTab === tab.id ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {activeSkillTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
        `}</style>
        <div className="max-w-5xl mx-auto">
          
          {currentView === 'main' && (
            <>
              {/* Search Bar */}
              <div className="relative mb-6 group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder="Search skills, packages, and integrations... (Press Ctrl+K)" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0e0e11]/50 border border-white/5 rounded-xl py-3 pl-11 pr-11 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-sm focus:bg-[#0e0e11]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-sm p-1"
                  >
                    <X size={14} />
                  </button>
                )}
                {!searchQuery && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] font-medium text-gray-400">
                      <span className="text-xs">Ctrl</span>
                      <span>K</span>
                    </kbd>
                  </div>
                )}
              </div>

              {/* Tab Content */}
              {activeSkillTab === 'hub' && (
                <div className="space-y-6">
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Recommended for you</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      const filtered = skills.filter(s => !s.isInstalled && s.author !== 'Sdkwork' && (s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.desc.toLowerCase().includes(searchQuery.toLowerCase())));
                      return filtered.length > 0 ? filtered.map((s, i) => renderSkillCard(s, i)) : renderEmptyState(searchQuery);
                    })()}
                  </div>
                </div>
              )}

              {activeSkillTab === 'packages' && (
                <div className="space-y-6">
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Featured Packages</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      const filtered = packages.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchQuery.toLowerCase()));
                      return filtered.length > 0 ? filtered.map((p, i) => renderPackageCard(p, i)) : renderEmptyState(searchQuery);
                    })()}
                  </div>
                </div>
              )}

              {activeSkillTab === 'sdkwork' && (
                <div className="space-y-6">
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Official Sdkwork Skills</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      const filtered = skills.filter(s => s.author === 'Sdkwork' && (s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.desc.toLowerCase().includes(searchQuery.toLowerCase())));
                      return filtered.length > 0 ? filtered.map((s, i) => renderSkillCard(s, i)) : renderEmptyState(searchQuery);
                    })()}
                  </div>
                </div>
              )}

              {activeSkillTab === 'installed' && (
                <div className="space-y-6">
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Your Installed Skills</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      const filtered = skills.filter(s => s.isInstalled && (s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.desc.toLowerCase().includes(searchQuery.toLowerCase())));
                      return filtered.length > 0 ? filtered.map((s, i) => renderSkillCard(s, i)) : renderEmptyState(searchQuery);
                    })()}
                  </div>
                </div>
              )}
            </>
          )}

          {currentView === 'packageDetail' && selectedPackage && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-6xl mx-auto">
              {/* Header Section */}
              <div className="flex flex-col md:flex-row gap-6 mb-8 items-start bg-[#18181b]/30 p-6 rounded-2xl border border-white/5 relative">
                <div className="absolute inset-0 overflow-hidden rounded-2xl -z-10 pointer-events-none">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-bl-full blur-3xl"></div>
                </div>
                <div className="w-24 h-24 rounded-2xl bg-[#18181b] border border-white/10 flex items-center justify-center text-5xl shrink-0 shadow-xl">
                  {selectedPackage.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <h1 className="text-3xl font-bold text-white tracking-tight">{selectedPackage.name}</h1>
                    <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium border border-purple-500/20 flex items-center gap-1.5">
                      <Package size={14} />
                      Package
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400 mb-6">
                    <span className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white">
                        {selectedPackage.author.charAt(0)}
                      </div>
                      <span className="text-gray-300">{selectedPackage.author}</span>
                    </span>
                    <span className="flex items-center gap-1.5"><Download size={16} /> {selectedPackage.installs} installs</span>
                    <span className="flex items-center gap-1.5"><Package size={16} /> {selectedPackage.skills.length} skills included</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed max-w-3xl text-base mb-6">
                    {selectedPackage.longDesc || selectedPackage.desc}
                  </p>
                  <div className="flex gap-4">
                    <div className="relative flex items-center bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 card-menu-container">
                      <button 
                        className="px-6 py-2.5 text-sm text-white font-medium hover:bg-blue-600 active:scale-[0.98] rounded-l-xl disabled:opacity-50 flex items-center gap-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                        onClick={(e) => handleInstallPackage(e, selectedPackage, selectedRegistry)}
                        disabled={installingId === selectedPackage.id}
                      >
                        {installingId === selectedPackage.id ? (
                          <><Loader2 size={18} className="animate-spin" /> Installing...</>
                        ) : (
                          <><Download size={18} /> Install Package</>
                        )}
                      </button>
                      <div className="w-px h-6 bg-blue-600/50"></div>
                      <button 
                        className="px-2.5 py-2.5 text-white hover:bg-blue-600 active:scale-95 rounded-r-xl disabled:opacity-50 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveCardMenu(activeCardMenu === selectedPackage.id ? null : selectedPackage.id);
                        }}
                        disabled={installingId === selectedPackage.id}
                      >
                        <ChevronDown size={18} />
                      </button>
                      
                      {activeCardMenu === selectedPackage.id && (
                        <div className="absolute left-0 top-full mt-2 w-64 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                          <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-white/5 mb-1">Install from...</div>
                          {REGISTRIES.map(reg => (
                            <button
                              key={reg.id}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 active:bg-white/20 hover:text-white transition-colors flex items-center justify-between"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRegistryId(reg.id);
                                setActiveCardMenu(null);
                                handleInstallPackage(e, selectedPackage, reg);
                              }}
                            >
                              <span className="truncate">{reg.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content & Sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Included Skills */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                      <Package className="text-purple-400" size={24} />
                      <h2 className="text-xl font-semibold text-white">Included Skills</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedPackage.skills.map((s, i) => renderSkillCard(s, i))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Metadata Sidebar */}
                <div className="space-y-6">
                  <div className="bg-[#18181b]/30 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6">Details</h3>
                    
                    <div className="space-y-5">
                      <div className="flex items-start gap-4">
                        <Shield size={18} className="text-gray-500 mt-0.5" />
                        <div>
                          <div className="text-sm text-gray-400 mb-1">License</div>
                          <div className="text-sm text-gray-200">MIT</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <Calendar size={18} className="text-gray-500 mt-0.5" />
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Last Updated</div>
                          <div className="text-sm text-gray-200">Recently</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#18181b]/30 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Installation Source</h3>
                    <div className="relative" ref={detailRegistryMenuRef}>
                      <button 
                        className="w-full flex items-center justify-between px-4 py-3 bg-[#0e0e11] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-white/20 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                        onClick={() => setShowDetailRegistryMenu(!showDetailRegistryMenu)}
                      >
                        <div className="flex items-center gap-2">
                          <Server size={16} className="text-blue-400" />
                          <span className="truncate">{selectedRegistry.name}</span>
                        </div>
                        <ChevronDown size={16} className="text-gray-500" />
                      </button>
                      
                      {showDetailRegistryMenu && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                          {REGISTRIES.map(registry => (
                            <button
                              key={registry.id}
                              className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-white/10 active:bg-white/20 transition-colors focus-visible:outline-none focus-visible:bg-white/10"
                              onClick={() => {
                                setSelectedRegistryId(registry.id);
                                setShowDetailRegistryMenu(false);
                                addToast(`Switched to ${registry.name}`, 'success');
                              }}
                            >
                              <span className={selectedRegistry.id === registry.id ? 'text-white font-medium truncate' : 'text-gray-300 truncate'}>
                                {registry.name}
                              </span>
                              {selectedRegistry.id === registry.id && <Check size={16} className="text-blue-400 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#18181b]/30 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Command Line</h3>
                    <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between group">
                      <code className="text-sm text-gray-300 font-mono break-all pr-4">sdkwork install-pkg {selectedPackage.id}{selectedRegistry.id !== 'official' ? ` --registry ${selectedRegistry.url}` : ''}</code>
                      <button 
                        onClick={() => handleCopy(`sdkwork install-pkg ${selectedPackage.id}${selectedRegistry.id !== 'official' ? ` --registry ${selectedRegistry.url}` : ''}`)}
                        className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 active:scale-95 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:opacity-100"
                        title="Copy to clipboard"
                      >
                        {copiedCommand === `sdkwork install-pkg ${selectedPackage.id}${selectedRegistry.id !== 'official' ? ` --registry ${selectedRegistry.url}` : ''}` ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'skillDetail' && selectedSkill && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-6xl mx-auto">
              {/* Header Section */}
              <div className="flex flex-col md:flex-row gap-6 mb-8 items-start bg-[#18181b]/30 p-6 rounded-2xl border border-white/5 relative">
                <div className="absolute inset-0 overflow-hidden rounded-2xl -z-10 pointer-events-none">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full blur-3xl"></div>
                </div>
                <div className="w-24 h-24 rounded-2xl bg-[#18181b] border border-white/10 flex items-center justify-center text-5xl shrink-0 shadow-xl">
                  {selectedSkill.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <h1 className="text-3xl font-bold text-white tracking-tight">{selectedSkill.name}</h1>
                    {selectedSkill.version && (
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                        v{selectedSkill.version}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400 mb-6">
                    <span className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white">
                        {selectedSkill.author.charAt(0)}
                      </div>
                      <span className={selectedSkill.author === 'Sdkwork' ? 'text-blue-400 font-medium' : 'text-gray-300'}>{selectedSkill.author}</span>
                    </span>
                    <span className="flex items-center gap-1.5"><Download size={16} /> {selectedSkill.installs} installs</span>
                    {selectedSkill.lastUpdated && (
                      <span className="flex items-center gap-1.5"><Clock size={16} /> Updated {selectedSkill.lastUpdated}</span>
                    )}
                  </div>
                  <p className="text-gray-300 leading-relaxed max-w-3xl text-base mb-6">
                    {selectedSkill.longDesc || selectedSkill.desc}
                  </p>
                  
                  <div className="flex gap-4">
                    {selectedSkill.isInstalled ? (
                      <button className="bg-[#18181b] hover:bg-white/10 text-white px-6 py-2.5 text-sm rounded-xl font-medium transition-colors border border-white/10 flex items-center gap-2 shadow-sm">
                        <CheckCircle2 size={18} className="text-green-400" />
                        Installed
                      </button>
                    ) : (
                      <div className="relative flex items-center bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 card-menu-container">
                        <button 
                          className="px-6 py-2.5 text-sm text-white font-medium hover:bg-blue-600 active:scale-[0.98] rounded-l-xl disabled:opacity-50 flex items-center gap-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                          onClick={(e) => {
                            handleInstall(e, selectedSkill, selectedRegistry);
                            setTimeout(() => {
                              setSelectedSkill({ ...selectedSkill, isInstalled: true });
                            }, 1500);
                          }}
                          disabled={installingId === selectedSkill.id}
                        >
                          {installingId === selectedSkill.id ? (
                            <><Loader2 size={18} className="animate-spin" /> Installing...</>
                          ) : (
                            <><Download size={18} /> Install Skill</>
                          )}
                        </button>
                        <div className="w-px h-6 bg-blue-600/50"></div>
                        <button 
                          className="px-2.5 py-2.5 text-white hover:bg-blue-600 active:scale-95 rounded-r-xl disabled:opacity-50 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCardMenu(activeCardMenu === selectedSkill.id ? null : selectedSkill.id);
                          }}
                          disabled={installingId === selectedSkill.id}
                        >
                          <ChevronDown size={18} />
                        </button>
                        
                        {activeCardMenu === selectedSkill.id && (
                          <div className="absolute left-0 top-full mt-2 w-64 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                            <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-white/5 mb-1">Install from...</div>
                            {REGISTRIES.map(reg => (
                              <button
                                key={reg.id}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 active:bg-white/20 hover:text-white transition-colors flex items-center justify-between"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRegistryId(reg.id);
                                  setActiveCardMenu(null);
                                  handleInstall(e, selectedSkill, reg);
                                  setTimeout(() => {
                                    setSelectedSkill({ ...selectedSkill, isInstalled: true });
                                  }, 1500);
                                }}
                              >
                                <span className="truncate">{reg.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button className="bg-[#18181b] hover:bg-white/10 active:scale-95 text-white px-4 py-3 rounded-xl font-medium transition-transform border border-white/10 flex items-center gap-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
                      <Settings size={20} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Content & Sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Readme & Content */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-[#18181b]/30 border border-white/5 rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                      <FileText className="text-blue-400" size={24} />
                      <h2 className="text-xl font-semibold text-white">Overview</h2>
                    </div>
                    <div className="prose prose-invert prose-blue max-w-none">
                      {selectedSkill.readme ? (
                        <ReactMarkdown>{selectedSkill.readme}</ReactMarkdown>
                      ) : (
                        <>
                          <p className="text-gray-300 text-lg leading-relaxed">This is a detailed description area where markdown content about the skill would be rendered. It can include usage examples, configuration options, and release notes.</p>
                          <h3 className="text-white font-medium mt-8 mb-4 text-lg">Key Features</h3>
                          <ul className="space-y-3 text-gray-400">
                            <li className="flex items-start gap-3">
                              <CheckCircle2 size={18} className="text-blue-400 mt-1 shrink-0" />
                              <span>Seamless integration with your workflow</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <CheckCircle2 size={18} className="text-blue-400 mt-1 shrink-0" />
                              <span>Advanced AI capabilities tailored for this domain</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <CheckCircle2 size={18} className="text-blue-400 mt-1 shrink-0" />
                              <span>Regular updates and community support</span>
                            </li>
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Metadata Sidebar */}
                <div className="space-y-6">
                  <div className="bg-[#18181b]/30 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6">Details</h3>
                    
                    <div className="space-y-5">
                      {selectedSkill.repository && (
                        <div className="flex items-start gap-4">
                          <Github size={18} className="text-gray-500 mt-0.5" />
                          <div>
                            <div className="text-sm text-gray-400 mb-1">Repository</div>
                            <a href="#" className="text-sm text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1">
                              {selectedSkill.repository.replace('https://github.com/', '')}
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {selectedSkill.license && (
                        <div className="flex items-start gap-4">
                          <Shield size={18} className="text-gray-500 mt-0.5" />
                          <div>
                            <div className="text-sm text-gray-400 mb-1">License</div>
                            <div className="text-sm text-gray-200">{selectedSkill.license}</div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-4">
                        <Calendar size={18} className="text-gray-500 mt-0.5" />
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Last Updated</div>
                          <div className="text-sm text-gray-200">{selectedSkill.lastUpdated || 'Unknown'}</div>
                        </div>
                      </div>

                      {selectedSkill.tags && selectedSkill.tags.length > 0 && (
                        <div className="flex items-start gap-4 pt-4 border-t border-white/5">
                          <Tag size={18} className="text-gray-500 mt-0.5" />
                          <div>
                            <div className="text-sm text-gray-400 mb-3">Categories</div>
                            <div className="flex flex-wrap gap-2">
                              {selectedSkill.tags.map(tag => (
                                <span key={tag} className="px-2.5 py-1 bg-[#18181b] border border-white/10 rounded-md text-xs text-gray-300 hover:bg-white/10 transition-colors cursor-pointer">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#18181b]/30 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Installation Source</h3>
                    <div className="relative" ref={detailRegistryMenuRef}>
                      <button 
                        className="w-full flex items-center justify-between px-4 py-3 bg-[#0e0e11] border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:border-white/20 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                        onClick={() => setShowDetailRegistryMenu(!showDetailRegistryMenu)}
                      >
                        <div className="flex items-center gap-2">
                          <Server size={16} className="text-blue-400" />
                          <span className="truncate">{selectedRegistry.name}</span>
                        </div>
                        <ChevronDown size={16} className="text-gray-500" />
                      </button>
                      
                      {showDetailRegistryMenu && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                          {REGISTRIES.map(registry => (
                            <button
                              key={registry.id}
                              className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-white/10 active:bg-white/20 transition-colors focus-visible:outline-none focus-visible:bg-white/10"
                              onClick={() => {
                                setSelectedRegistryId(registry.id);
                                setShowDetailRegistryMenu(false);
                                addToast(`Switched to ${registry.name}`, 'success');
                              }}
                            >
                              <span className={selectedRegistry.id === registry.id ? 'text-white font-medium truncate' : 'text-gray-300 truncate'}>
                                {registry.name}
                              </span>
                              {selectedRegistry.id === registry.id && <Check size={16} className="text-blue-400 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#18181b]/30 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Command Line</h3>
                    <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between group">
                      <code className="text-sm text-gray-300 font-mono break-all pr-4">sdkwork install {selectedSkill.id}{selectedRegistry.id !== 'official' ? ` --registry ${selectedRegistry.url}` : ''}</code>
                      <button 
                        onClick={() => handleCopy(`sdkwork install ${selectedSkill.id}${selectedRegistry.id !== 'official' ? ` --registry ${selectedRegistry.url}` : ''}`)}
                        className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 active:scale-95 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:opacity-100"
                        title="Copy to clipboard"
                      >
                        {copiedCommand === `sdkwork install ${selectedSkill.id}${selectedRegistry.id !== 'official' ? ` --registry ${selectedRegistry.url}` : ''}` ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
