import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Clock, Zap, Folder, FolderPlus, ChevronDown, ChevronRight, Plus, ListFilter, Check, MessageSquare, Trash2, Edit2, Archive, Copy, Pin, Search, X, RefreshCw } from 'lucide-react';
import type { BirdCoderCodingSession, BirdCoderProject } from '@sdkwork/birdcoder-types';
import {
  globalEventBus,
  listWorkbenchCliEngines,
  useToast,
} from '@sdkwork/birdcoder-commons/workbench';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  projects: BirdCoderProject[];
  selectedProjectId?: string | null;
  selectedCodingSessionId: string | null;
  onSelectProject?: (id: string | null) => void;
  onSelectCodingSession: (id: string | null) => void;
  onRenameCodingSession: (id: string, newName?: string) => void;
  onDeleteCodingSession: (id: string) => void;
  onRenameProject: (id: string, newName?: string) => void;
  onDeleteProject: (id: string) => void;
  onNewProject: () => Promise<string | undefined>;
  onOpenFolder?: () => void;
  onNewCodingSessionInProject: (id: string) => void;
  onRefreshProjectSessions?: (id: string) => Promise<void> | void;
  onRefreshCodingSessionMessages?: (id: string) => Promise<void> | void;
  onArchiveProject?: (id: string) => void;
  onCopyWorkingDirectory?: (id: string) => void;
  onCopyProjectPath?: (id: string) => void;
  onOpenInTerminal?: (id: string, profileId?: string) => void;
  onOpenInFileExplorer?: (id: string) => void;
  onPinCodingSession?: (id: string) => void;
  onArchiveCodingSession?: (id: string) => void;
  onMarkCodingSessionUnread?: (id: string) => void;
  onCopyCodingSessionWorkingDirectory?: (id: string) => void;
  onCopyCodingSessionSessionId?: (id: string) => void;
  onCopyCodingSessionDeeplink?: (id: string) => void;
  onForkCodingSessionLocal?: (id: string) => void;
  onForkCodingSessionNewTree?: (id: string) => void;
  refreshingProjectId?: string | null;
  refreshingCodingSessionId?: string | null;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  width?: number;
}

const CLI_ENGINE_TERMINAL_OPTIONS = listWorkbenchCliEngines();
const SIDEBAR_CONTEXT_MENU_Z_INDEX = 2147483647;

function renderSidebarContextMenuPortal(content: React.ReactNode) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(content, document.body);
}

export function Sidebar({
  projects,
  selectedProjectId,
  selectedCodingSessionId,
  onSelectProject,
  onSelectCodingSession,
  onRenameCodingSession,
  onDeleteCodingSession,
  onRenameProject,
  onDeleteProject,
  onNewProject,
  onOpenFolder,
  onNewCodingSessionInProject,
  onRefreshProjectSessions,
  onRefreshCodingSessionMessages,
  onArchiveProject,
  onCopyWorkingDirectory,
  onCopyProjectPath,
  onOpenInTerminal,
  onOpenInFileExplorer,
  onPinCodingSession,
  onArchiveCodingSession,
  onMarkCodingSessionUnread,
  onCopyCodingSessionWorkingDirectory,
  onCopyCodingSessionSessionId,
  onCopyCodingSessionDeeplink,
  onForkCodingSessionLocal,
  onForkCodingSessionNewTree,
  refreshingProjectId,
  refreshingCodingSessionId,
  searchQuery = '',
  setSearchQuery,
  width = 256
}: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({ 'p1': true, 'p2': true });
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [organizeBy, setOrganizeBy] = useState<'project' | 'chronological'>('project');
  const [sortBy, setSortBy] = useState<'created' | 'updated'>('updated');
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  const { t } = useTranslation();
  const refreshSessionsLabel = t('code.refreshSessions');
  const refreshingSessionsLabel = t('code.refreshingSessions');
  const refreshMessagesLabel = t('code.refreshMessages');
  const refreshingMessagesLabel = t('code.refreshingMessages');

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, codingSessionId: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [projectContextMenu, setProjectContextMenu] = useState<{ x: number, y: number, projectId: string } | null>(null);
  const projectContextMenuRef = useRef<HTMLDivElement>(null);

  const [rootContextMenu, setRootContextMenu] = useState<{ x: number, y: number } | null>(null);
  const rootContextMenuRef = useRef<HTMLDivElement>(null);

  const [renamingCodingSessionId, setRenamingCodingSessionId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
      if (projectContextMenuRef.current && !projectContextMenuRef.current.contains(event.target as Node)) {
        setProjectContextMenu(null);
      }
      if (rootContextMenuRef.current && !rootContextMenuRef.current.contains(event.target as Node)) {
        setRootContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Expand projects by default when they are loaded
  useEffect(() => {
    if (!searchQuery) {
      setExpandedProjects(prev => {
        const newExpanded = { ...prev };
        let changed = false;
        projects.forEach(p => {
          if (newExpanded[p.id] === undefined) {
            newExpanded[p.id] = true;
            changed = true;
          }
        });
        return changed ? newExpanded : prev;
      });
    }
  }, [projects, searchQuery]);

  // When search query changes, expand all projects that have matching threads
  useEffect(() => {
    if (searchQuery) {
      const newExpanded = { ...expandedProjects };
      projects.forEach(p => {
        if (p.codingSessions.length > 0) {
          newExpanded[p.id] = true;
        }
      });
      setExpandedProjects(newExpanded);
    }
  }, [searchQuery, projects]);

  const toggleProject = (projectId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const selectProject = (projectId: string) => {
    if (onSelectProject) {
      onSelectProject(projectId);
    }
    setExpandedProjects(prev => ({ ...prev, [projectId]: true }));
  };

  const handleContextMenu = (e: React.MouseEvent, codingSessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectContextMenu(null);
    setRootContextMenu(null);
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Prevent overflow (menu width ~224px, height ~350px)
    if (x + 224 > window.innerWidth) {
      x = window.innerWidth - 224 - 10;
    }
    if (y + 350 > window.innerHeight) {
      y = window.innerHeight - 350 - 10;
    }

    setContextMenu({ x, y, codingSessionId });
  };

  const handleProjectContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setRootContextMenu(null);
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Prevent overflow (menu width ~224px, height ~250px)
    if (x + 224 > window.innerWidth) {
      x = window.innerWidth - 224 - 10;
    }
    if (y + 250 > window.innerHeight) {
      y = window.innerHeight - 250 - 10;
    }

    setProjectContextMenu({ x, y, projectId });
  };

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setProjectContextMenu(null);
    
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + 224 > window.innerWidth) {
      x = window.innerWidth - 224 - 10;
    }
    if (y + 150 > window.innerHeight) {
      y = window.innerHeight - 150 - 10;
    }

    setRootContextMenu({ x, y });
  };

  return (
    <div 
      className="flex flex-col border-r border-white/5 bg-[#0e0e11]/95 backdrop-blur-xl text-sm relative shrink-0" 
      style={{ width }}
      onContextMenu={handleRootContextMenu}
    >
      <div className="p-4 flex flex-col gap-2">
        <div 
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-200 animate-in fade-in slide-in-from-left-4 fill-mode-both ${selectedProjectId ? 'text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer' : 'text-gray-600 cursor-not-allowed'}`}
          style={{ animationDelay: '0ms' }}
          onClick={() => {
            if (selectedProjectId) {
              globalEventBus.emit('createNewCodingSession');
            }
          }}
          title={
            selectedProjectId
              ? t('app.newSessionInCurrentProject')
              : t('code.selectProjectFirst')
          }
        >
          <Edit size={16} />
          <span className="font-medium">{t('app.menu.newThread')}</span>
        </div>
      </div>

      <div className="px-4 py-2 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
        <div 
          className="flex items-center justify-between text-gray-400 text-xs mb-3 px-2 relative font-semibold tracking-wider uppercase animate-in fade-in slide-in-from-left-4 fill-mode-both"
          style={{ animationDelay: '100ms' }}
        >
          <span>{t('app.threads')}</span>
          <div className="flex gap-2 items-center">
            {selectedProjectId && onRefreshProjectSessions && (
              <button
                type="button"
                className="text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                disabled={refreshingProjectId === selectedProjectId}
                title={
                  refreshingProjectId === selectedProjectId
                    ? refreshingSessionsLabel
                    : refreshSessionsLabel
                }
                onClick={(event) => {
                  event.stopPropagation();
                  void onRefreshProjectSessions(selectedProjectId);
                }}
              >
                <RefreshCw
                  size={14}
                  className={refreshingProjectId === selectedProjectId ? 'animate-spin' : ''}
                />
              </button>
            )}
            <div title={t('app.searchSessionsTitle')}>
              <Search 
                size={14} 
                className={`cursor-pointer hover:text-white transition-colors ${showSearch || searchQuery ? 'text-white' : ''}`}
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (showSearch && setSearchQuery) {
                    setSearchQuery('');
                  }
                }}
              />
            </div>
            <div title="New Project">
              <FolderPlus size={14} className="cursor-pointer hover:text-white transition-colors" onClick={async () => {
                const newId = await onNewProject();
                if (newId) {
                  setExpandedProjects(prev => ({ ...prev, [newId]: true }));
                }
              }} />
            </div>
            {onOpenFolder && (
              <div title="Open Folder">
                <Folder size={14} className="cursor-pointer hover:text-white transition-colors" onClick={onOpenFolder} />
              </div>
            )}
            <ListFilter 
              size={14} 
              className={`cursor-pointer hover:text-white transition-colors ${showFilterMenu ? 'text-white' : ''}`} 
              onClick={() => setShowFilterMenu(!showFilterMenu)}
            />
          </div>

          {showFilterMenu && (
            <div ref={filterMenuRef} className="absolute right-0 top-6 w-48 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 py-1.5 text-[13px] text-gray-300 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('app.organize')}</div>
              <div className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center justify-between transition-colors" onClick={() => { setOrganizeBy('project'); setShowFilterMenu(false); addToast(t('code.organizedByProject'), 'success'); }}>
                <span>{t('app.byProject')}</span>
                {organizeBy === 'project' && <Check size={14} className="text-gray-400" />}
              </div>
              <div className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center justify-between transition-colors" onClick={() => { setOrganizeBy('chronological'); setShowFilterMenu(false); addToast(t('code.organizedChronologically'), 'success'); }}>
                <span>{t('app.chronological')}</span>
                {organizeBy === 'chronological' && <Check size={14} className="text-gray-400" />}
              </div>
              
              <div className="h-px bg-white/10 my-1.5"></div>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('app.sortBy')}</div>
              <div className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center justify-between transition-colors" onClick={() => { setSortBy('created'); setShowFilterMenu(false); addToast(t('code.sortedByCreatedDate'), 'success'); }}>
                <span>{t('app.created')}</span>
                {sortBy === 'created' && <Check size={14} className="text-gray-400" />}
              </div>
              <div className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center justify-between transition-colors" onClick={() => { setSortBy('updated'); setShowFilterMenu(false); addToast(t('code.sortedByUpdatedDate'), 'success'); }}>
                <span>{t('app.updated')}</span>
                {sortBy === 'updated' && <Check size={14} className="text-gray-400" />}
              </div>

              <div className="h-px bg-white/10 my-1.5"></div>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('app.show')}</div>
              <div className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center justify-between transition-colors" onClick={() => { setShowArchived(true); setShowFilterMenu(false); addToast(t('code.showingAllThreads'), 'success'); }}>
                <span>{t('app.allThreads')}</span>
                {showArchived && <Check size={14} className="text-gray-400" />}
              </div>
              <div className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center justify-between transition-colors" onClick={() => { setShowArchived(false); setShowFilterMenu(false); addToast(t('code.showingRelevantThreads'), 'success'); }}>
                <span>{t('app.relevant')}</span>
                {!showArchived && <Check size={14} className="text-gray-400" />}
              </div>
            </div>
          )}
        </div>

        {(showSearch || searchQuery) && (
          <div className="px-2 mb-3 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery?.(e.target.value)}
              placeholder={t('app.searchThreads')}
              className="w-full bg-white/5 text-white text-xs px-2 py-1.5 pr-6 rounded outline-none border border-white/10 focus:border-[#555]"
              autoFocus
            />
            {searchQuery && (
              <X 
                size={12} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                onClick={() => setSearchQuery?.('')}
              />
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          {organizeBy === 'project' ? (
            projects.filter(p => showArchived || !p.archived).map((project, index) => {
              const filteredThreads = project.codingSessions
                .filter(t => showArchived || !t.archived)
                .filter(
                  (codingSession) =>
                    !searchQuery ||
                    codingSession.title.toLowerCase().includes(searchQuery.toLowerCase()),
                )
                .sort((a, b) => {
                  const dateA = new Date(sortBy === 'created' ? a.createdAt : a.updatedAt).getTime();
                  const dateB = new Date(sortBy === 'created' ? b.createdAt : b.updatedAt).getTime();
                  return dateB - dateA;
                });

              if (searchQuery && filteredThreads.length === 0) return null;

              return (
              <div 
                key={project.id} 
                className="mb-1 animate-in fade-in slide-in-from-left-4 fill-mode-both"
                style={{ animationDelay: `${index * 50 + 150}ms` }}
              >
                <div 
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${selectedProjectId === project.id ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                  onClick={() => selectProject(project.id)}
                  onContextMenu={(e) => handleProjectContextMenu(e, project.id)}
                >
                  <div 
                    className={`transition-colors p-0.5 rounded-sm hover:bg-white/20 ${selectedProjectId === project.id ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-300'}`}
                    onClick={(e) => toggleProject(project.id, e)}
                  >
                    {expandedProjects[project.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                  <Folder size={14} className={`transition-colors ${selectedProjectId === project.id ? 'text-blue-400' : 'text-gray-400 group-hover:text-gray-300'}`} />
                  {project.archived && <Archive size={14} className="text-gray-500 shrink-0" />}
                  {renamingProjectId === project.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (renameValue.trim() && renameValue !== project.name) {
                            onRenameProject(project.id, renameValue.trim());
                          }
                          setRenamingProjectId(null);
                        } else if (e.key === 'Escape') {
                          setRenamingProjectId(null);
                        }
                      }}
                      onBlur={() => setRenamingProjectId(null)}
                      className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1 text-sm min-w-0 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate font-medium">{project.name}</span>
                  )}
                </div>
                
                {expandedProjects[project.id] && (
                  <div className="flex flex-col mt-0.5">
                    {filteredThreads.length > 0 ? (
                      filteredThreads.map((thread, threadIndex) => (
                        <div 
                          key={thread.id}
                          className={`pl-8 pr-2 py-1.5 flex justify-between items-center cursor-pointer rounded-md transition-colors animate-in fade-in slide-in-from-left-2 fill-mode-both ${selectedCodingSessionId === thread.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'}`}
                          style={{ animationDelay: `${(index * 50) + (threadIndex * 30) + 200}ms` }}
                          onClick={() => onSelectCodingSession(thread.id)}
                          onContextMenu={(e) => handleContextMenu(e, thread.id)}
                        >
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <MessageSquare size={12} className={`shrink-0 ${selectedCodingSessionId === thread.id ? 'text-white' : 'opacity-50'}`} />
                            {thread.pinned && <Pin size={12} className="text-blue-400 shrink-0" />}
                            {thread.unread && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                            {thread.archived && <Archive size={12} className="text-gray-500 shrink-0" />}
                            {renamingCodingSessionId === thread.id ? (
                              <input
                                type="text"
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (renameValue.trim() && renameValue !== thread.title) {
                                      onRenameCodingSession(thread.id, renameValue.trim());
                                    }
                                    setRenamingCodingSessionId(null);
                                  } else if (e.key === 'Escape') {
                                    setRenamingCodingSessionId(null);
                                  }
                                }}
                                onBlur={() => setRenamingCodingSessionId(null)}
                                className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1 text-sm min-w-0"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className="truncate">{thread.title}</span>
                            )}
                          </div>
                          {renamingCodingSessionId !== thread.id && (
                            <span className={`text-[10px] shrink-0 ml-2 ${selectedCodingSessionId === thread.id ? 'text-gray-400' : 'opacity-50'}`}>{thread.displayTime}</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="pl-8 py-1 text-gray-500 text-xs italic animate-in fade-in fill-mode-both" style={{ animationDelay: `${(index * 50) + 200}ms` }}>
                        {t('app.noSessions')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )})
          ) : (
            projects
              .flatMap((project) => project.codingSessions)
              .filter(t => showArchived || !t.archived)
              .filter(
                (codingSession) =>
                  !searchQuery ||
                  codingSession.title.toLowerCase().includes(searchQuery.toLowerCase()),
              )
              .sort((a, b) => {
                const dateA = new Date(sortBy === 'created' ? a.createdAt : a.updatedAt).getTime();
                const dateB = new Date(sortBy === 'created' ? b.createdAt : b.updatedAt).getTime();
                return dateB - dateA;
              })
              .map((thread, threadIndex) => (
                <div 
                  key={thread.id}
                  className={`px-2 py-1.5 flex justify-between items-center cursor-pointer rounded-md transition-colors animate-in fade-in slide-in-from-left-2 fill-mode-both ${selectedCodingSessionId === thread.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'}`}
                  style={{ animationDelay: `${(threadIndex * 30) + 100}ms` }}
                  onClick={() => onSelectCodingSession(thread.id)}
                  onContextMenu={(e) => handleContextMenu(e, thread.id)}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <MessageSquare size={12} className={`shrink-0 ${selectedCodingSessionId === thread.id ? 'text-white' : 'opacity-50'}`} />
                    {thread.pinned && <Pin size={12} className="text-blue-400 shrink-0" />}
                    {thread.unread && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    {thread.archived && <Archive size={12} className="text-gray-500 shrink-0" />}
                    {renamingCodingSessionId === thread.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (renameValue.trim() && renameValue !== thread.title) {
                              onRenameCodingSession(thread.id, renameValue.trim());
                            }
                            setRenamingCodingSessionId(null);
                          } else if (e.key === 'Escape') {
                            setRenamingCodingSessionId(null);
                          }
                        }}
                        onBlur={() => setRenamingCodingSessionId(null)}
                        className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1 text-sm min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="truncate">{thread.title}</span>
                    )}
                  </div>
                  {renamingCodingSessionId !== thread.id && (
                    <span className={`text-[10px] shrink-0 ml-2 ${selectedCodingSessionId === thread.id ? 'text-gray-400' : 'opacity-50'}`}>{thread.displayTime}</span>
                  )}
                </div>
              ))
          )}
          
        </div>
      </div>

      {rootContextMenu &&
        renderSidebarContextMenuPortal(
          <div 
            ref={rootContextMenuRef}
            className="fixed bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1.5 text-[13px] text-gray-300 w-56 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
            style={{ top: rootContextMenu.y, left: rootContextMenu.x, zIndex: SIDEBAR_CONTEXT_MENU_Z_INDEX }}
          >
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
              onClick={async () => { 
                const newId = await onNewProject(); 
                if (newId) {
                  setExpandedProjects(prev => ({ ...prev, [newId]: true }));
                }
                setRootContextMenu(null); 
              }}
            >
              {t('app.newProject')}
            </div>
            {onOpenFolder && (
              <div 
                className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
                onClick={() => { onOpenFolder(); setRootContextMenu(null); }}
              >
                {t('app.menu.openFolder').replace('...', '')}
              </div>
            )}
            <div className="h-px bg-white/10 my-1.5"></div>
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
              onClick={() => { 
                if (selectedProjectId) {
                  globalEventBus.emit('createNewCodingSession');
                } else {
                  addToast(t('code.selectProjectFirst'), 'error');
                }
                setRootContextMenu(null); 
              }}
            >
              {t('app.menu.newThread')}
            </div>
          </div>,
        )}

      {contextMenu &&
        renderSidebarContextMenuPortal(
          <div 
            ref={contextMenuRef}
            className="fixed bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1.5 text-[13px] text-gray-300 w-56 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
            style={{ top: contextMenu.y, left: contextMenu.x, zIndex: SIDEBAR_CONTEXT_MENU_Z_INDEX }}
          >
            <div
              className={`px-4 py-1.5 transition-colors ${
                refreshingCodingSessionId === contextMenu.codingSessionId
                  ? 'cursor-not-allowed text-gray-500'
                  : 'cursor-pointer hover:bg-white/10 hover:text-white'
              }`}
              onClick={() => {
                if (refreshingCodingSessionId === contextMenu.codingSessionId) {
                  return;
                }
                void onRefreshCodingSessionMessages?.(contextMenu.codingSessionId);
                setContextMenu(null);
              }}
            >
              {refreshingCodingSessionId === contextMenu.codingSessionId
                ? refreshingMessagesLabel
                : refreshMessagesLabel}
            </div>
            <div className="h-px bg-white/10 my-1.5"></div>
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
              onClick={() => { onPinCodingSession?.(contextMenu.codingSessionId); setContextMenu(null); }}
            >
              {projects.flatMap((project) => project.codingSessions).find((codingSession) => codingSession.id === contextMenu.codingSessionId)?.pinned ? t('code.unpinThread') : t('code.pinThread')}
            </div>
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
              onClick={() => { 
                setRenamingCodingSessionId(contextMenu.codingSessionId);
                const thread = projects.flatMap((project) => project.codingSessions).find((codingSession) => codingSession.id === contextMenu.codingSessionId);
                if (thread) setRenameValue(thread.title);
                setContextMenu(null); 
              }}
            >
              {t('code.renameThread')}
            </div>
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
              onClick={() => { onArchiveCodingSession?.(contextMenu.codingSessionId); setContextMenu(null); }}
            >
              {projects.flatMap((project) => project.codingSessions).find((codingSession) => codingSession.id === contextMenu.codingSessionId)?.archived ? t('code.unarchiveThread') : t('code.archiveThread')}
            </div>
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
              onClick={() => { onMarkCodingSessionUnread?.(contextMenu.codingSessionId); setContextMenu(null); }}
            >
              {projects.flatMap((project) => project.codingSessions).find((codingSession) => codingSession.id === contextMenu.codingSessionId)?.unread ? t('code.markAsRead') : t('code.markAsUnread')}
            </div>
            <div className="h-px bg-white/10 my-1.5"></div>
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
              onClick={() => { onCopyCodingSessionWorkingDirectory?.(contextMenu.codingSessionId); setContextMenu(null); }}
            >
              {t('code.copyWorkingDirectory')}
            </div>
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
              onClick={() => { onCopyCodingSessionSessionId?.(contextMenu.codingSessionId); setContextMenu(null); }}
            >
              {t('code.copySessionId')}
            </div>
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
              onClick={() => { onCopyCodingSessionDeeplink?.(contextMenu.codingSessionId); setContextMenu(null); }}
            >
              {t('code.copyDeeplink')}
            </div>
            <div className="h-px bg-white/10 my-1.5"></div>
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
              onClick={() => { onForkCodingSessionLocal?.(contextMenu.codingSessionId); setContextMenu(null); }}
            >
              {t('code.forkToLocal')}
            </div>
            <div 
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
              onClick={() => { onForkCodingSessionNewTree?.(contextMenu.codingSessionId); setContextMenu(null); }}
            >
              {t('code.forkToNewTree')}
            </div>
            <div className="h-px bg-white/10 my-1.5"></div>
            <div 
              className="px-4 py-1.5 hover:bg-red-500/10 hover:text-red-400 cursor-pointer text-red-500 transition-colors"
              onClick={() => { onDeleteCodingSession(contextMenu.codingSessionId); setContextMenu(null); }}
            >
              {t('code.deleteThread')}
            </div>
          </div>,
        )}

      {projectContextMenu &&
        renderSidebarContextMenuPortal(
        <div 
          ref={projectContextMenuRef}
          className="fixed bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1.5 text-[13px] text-gray-300 w-56 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
          style={{ top: projectContextMenu.y, left: projectContextMenu.x, zIndex: SIDEBAR_CONTEXT_MENU_Z_INDEX }}
        >
          <div
            className={`px-4 py-1.5 transition-colors ${
              refreshingProjectId === projectContextMenu.projectId
                ? 'cursor-not-allowed text-gray-500'
                : 'cursor-pointer hover:bg-white/10 hover:text-white'
            }`}
            onClick={() => {
              if (refreshingProjectId === projectContextMenu.projectId) {
                return;
              }
              void onRefreshProjectSessions?.(projectContextMenu.projectId);
              setProjectContextMenu(null);
            }}
          >
            {refreshingProjectId === projectContextMenu.projectId
              ? refreshingSessionsLabel
              : refreshSessionsLabel}
          </div>
          <div className="h-px bg-white/10 my-1.5"></div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
            onClick={() => { onNewCodingSessionInProject(projectContextMenu.projectId); setProjectContextMenu(null); }}
          >
            {t('code.newThreadInProject')}
          </div>
          <div className="h-px bg-white/10 my-1.5"></div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
            onClick={() => { 
              setRenamingProjectId(projectContextMenu.projectId);
              const project = projects.find(p => p.id === projectContextMenu.projectId);
              if (project) setRenameValue(project.name);
              setProjectContextMenu(null); 
            }}
          >
            {t('app.renameProject')}
          </div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
            onClick={() => { onArchiveProject?.(projectContextMenu.projectId); setProjectContextMenu(null); }}
          >
            {projects.find(p => p.id === projectContextMenu.projectId)?.archived ? t('code.unarchiveProject') : t('code.archiveProject')}
          </div>
          <div className="h-px bg-white/10 my-1.5"></div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
            onClick={() => { onCopyWorkingDirectory?.(projectContextMenu.projectId); setProjectContextMenu(null); }}
          >
            {t('code.copyWorkingDirectory')}
          </div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
            onClick={() => {
              onCopyProjectPath?.(projectContextMenu.projectId);
              setProjectContextMenu(null);
            }}
          >
            {t('code.copyPath')}
          </div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
            onClick={() => { onOpenInTerminal?.(projectContextMenu.projectId); setProjectContextMenu(null); }}
          >
            {t('code.openInTerminal')}
          </div>
          {CLI_ENGINE_TERMINAL_OPTIONS.map((engine) => (
            <div 
              key={engine.id}
              className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
              onClick={() => { onOpenInTerminal?.(projectContextMenu.projectId, engine.terminalProfileId); setProjectContextMenu(null); }}
            >
              {`Develop in ${engine.label} Terminal`}
            </div>
          ))}
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors" 
            onClick={() => { 
              // 鍦╡xplorer涓墦寮€
              onOpenInFileExplorer?.(projectContextMenu.projectId);
              setProjectContextMenu(null); 
            }}
          >
            {t('code.openInFileExplorer')}
          </div>
          <div className="h-px bg-white/10 my-1.5"></div>
          <div 
            className="px-4 py-1.5 hover:bg-red-500/10 hover:text-red-400 cursor-pointer text-red-500 transition-colors"
            onClick={() => { onDeleteProject(projectContextMenu.projectId); setProjectContextMenu(null); }}
          >
            {t('app.deleteProject')}
          </div>
        </div>,
        )}
    </div>
  );
}
