import React, { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Search, X, Plus, FilePlus, FolderPlus, Trash2, FileJson, FileCode2, FileImage, FileText, FileType2, ListCollapse, Copy, Terminal, ExternalLink, FileEdit } from 'lucide-react';
import { useToast } from '@sdkwork/birdcoder-commons';

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

interface FileExplorerProps {
  files: FileNode[];
  onSelectFile: (path: string) => void;
  selectedFile?: string;
  onCreateFile?: (path: string) => void;
  onCreateFolder?: (path: string) => void;
  onDeleteFile?: (path: string) => void;
  onDeleteFolder?: (path: string) => void;
  onRenameNode?: (oldPath: string, newPath: string) => void;
  basePath?: string;
}

type FileExplorerNodeDraft = {
  parentPath: string;
  type: 'file' | 'directory';
};

type FileExplorerRenameDraft = {
  path: string;
  name: string;
};

type FileExplorerContextMenuState = {
  x: number;
  y: number;
  node: FileNode;
};

type FileExplorerRootContextMenuState = {
  x: number;
  y: number;
};

type ScoredFileNode = {
  node: FileNode;
  score: number;
};

// Advanced fuzzy search algorithm with scoring
function fuzzyScore(pattern: string, str: string): number {
  if (!pattern) return 1;
  if (!str) return 0;
  
  let patternIdx = 0;
  let strIdx = 0;
  let score = 0;
  const patternLen = pattern.length;
  const strLen = str.length;

  while (patternIdx < patternLen && strIdx < strLen) {
    if (pattern[patternIdx].toLowerCase() === str[strIdx].toLowerCase()) {
      score += 10; // Base score for a match
      if (patternIdx === strIdx) {
        score += 5; // Bonus for exact position match
      }
      patternIdx++;
    }
    strIdx++;
  }

  return patternIdx === patternLen ? score : 0;
}

const FILE_EXPLORER_CONTEXT_MENU_Z_INDEX = 2147483647;

function filterFileTree(nodes: readonly FileNode[], normalizedQuery: string): ScoredFileNode[] {
  const nextMatches: ScoredFileNode[] = [];

  for (const node of nodes) {
    const nodeScore = fuzzyScore(normalizedQuery, node.name.toLowerCase());

    if (node.type === 'directory' && node.children) {
      const childMatches = filterFileTree(node.children, normalizedQuery);
      let maxChildScore = 0;
      const nextChildren: FileNode[] = [];

      for (const childMatch of childMatches) {
        nextChildren.push(childMatch.node);
        if (childMatch.score > maxChildScore) {
          maxChildScore = childMatch.score;
        }
      }

      const totalScore = Math.max(nodeScore, maxChildScore);
      if (totalScore > 0) {
        nextMatches.push({
          node:
            nextChildren.length === node.children.length &&
            nextChildren.every((childNode, childIndex) => childNode === node.children?.[childIndex])
              ? node
              : { ...node, children: nextChildren },
          score: totalScore,
        });
      }
      continue;
    }

    if (nodeScore > 0) {
      nextMatches.push({ node, score: nodeScore });
    }
  }

  nextMatches.sort((left, right) => right.score - left.score);
  return nextMatches;
}

function trimTrailingPathSeparators(path: string): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return '';
  }

  if (/^[a-zA-Z]:[\\/]?$/.test(trimmedPath)) {
    return `${trimmedPath[0].toUpperCase()}:`;
  }

  return trimmedPath.replace(/[\\/]+$/, '');
}

function normalizeRelativeNodePath(path: string): string {
  return path.trim().replace(/^[/\\]+/, '').replace(/[\\/]+/g, '/');
}

function resolveAbsoluteExplorerPath(basePath: string | undefined, nodePath: string): string | null {
  const normalizedBasePath = trimTrailingPathSeparators(basePath ?? '');
  if (!normalizedBasePath) {
    return null;
  }

  const normalizedNodePath = normalizeRelativeNodePath(nodePath);
  if (!normalizedNodePath) {
    return normalizedBasePath;
  }

  const separator = normalizedBasePath.includes('\\') ? '\\' : '/';
  return `${normalizedBasePath}${separator}${normalizedNodePath.split('/').join(separator)}`;
}

function resolveRelativeParentPath(path: string): string {
  const normalizedPath = normalizeRelativeNodePath(path);
  const lastSeparatorIndex = normalizedPath.lastIndexOf('/');
  if (lastSeparatorIndex === -1) {
    return '';
  }

  return normalizedPath.slice(0, lastSeparatorIndex);
}

function resolveRootCreationParentPath(files: FileNode[]): string {
  if (files.length === 1 && files[0]?.type === 'directory') {
    return files[0].path;
  }

  return '';
}

export const FileExplorer = React.memo(function FileExplorer({ files, onSelectFile, selectedFile, onCreateFile, onCreateFolder, onDeleteFile, onDeleteFolder, onRenameNode, basePath = '' }: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState<FileNode | null>(null);

  const [contextMenu, setContextMenu] = useState<FileExplorerContextMenuState | null>(null);
  const [rootContextMenu, setRootContextMenu] = useState<FileExplorerRootContextMenuState | null>(null);
  const [creatingNode, setCreatingNode] = useState<FileExplorerNodeDraft | null>(null);
  const [renamingNode, setRenamingNode] = useState<FileExplorerRenameDraft | null>(null);
  const [inputValue, setInputValue] = useState('');
  const { addToast } = useToast();
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const resolveProjectBasePath = () => resolveAbsoluteExplorerPath(basePath, '');
  const resolveNodeAbsolutePath = (nodePath: string) => resolveAbsoluteExplorerPath(basePath, nodePath);
  const resolveNodeDirectoryPath = (node: FileNode) =>
    node.type === 'directory'
      ? resolveNodeAbsolutePath(node.path)
      : resolveAbsoluteExplorerPath(basePath, resolveRelativeParentPath(node.path));
  const notifyMissingProjectPath = () => addToast('Project folder path is unavailable', 'error');
  const rootCreationParentPath = useMemo(() => resolveRootCreationParentPath(files), [files]);
  const startCreatingRootNode = useCallback((type: 'file' | 'directory') => {
    setCreatingNode({ parentPath: rootCreationParentPath, type });
    setInputValue('');
    if (rootCreationParentPath) {
      setExpandedFolders((previousState) => ({
        ...previousState,
        [rootCreationParentPath]: true,
      }));
    }
  }, [rootCreationParentPath]);

  const closeFloatingMenus = useCallback(() => {
    setContextMenu(null);
    setRootContextMenu(null);
  }, []);

  const hasOpenViewportMenu = contextMenu !== null || rootContextMenu !== null;

  const handleClickOutside = useCallback(() => {
    if (!hasOpenViewportMenu) {
      return;
    }
    closeFloatingMenus();
  }, [closeFloatingMenus, hasOpenViewportMenu]);

  useEffect(() => {
    const handleCreateRootFile = () => {
      startCreatingRootNode('file');
    };

    let unsubscribe: (() => void) | undefined;
    import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
      unsubscribe = globalEventBus.on('createRootFile', handleCreateRootFile);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [startCreatingRootNode]);

  useEffect(() => {
    if (!hasOpenViewportMenu) {
      return;
    }

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [handleClickOutside, hasOpenViewportMenu]);

  useEffect(() => {
    if (!hasOpenViewportMenu) {
      return;
    }

    const handleViewportChange = () => {
      closeFloatingMenus();
    };

    window.addEventListener('resize', handleViewportChange, { passive: true });
    return () => {
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [closeFloatingMenus, hasOpenViewportMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setRootContextMenu(null);
    
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + 224 > window.innerWidth) {
      x = window.innerWidth - 224 - 10;
    }
    if (y + 250 > window.innerHeight) {
      y = window.innerHeight - 250 - 10;
    }

    setContextMenu({ x, y, node });
  }, []);

  const handleRootContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + 224 > window.innerWidth) {
      x = window.innerWidth - 224 - 10;
    }
    if (y + 150 > window.innerHeight) {
      y = window.innerHeight - 150 - 10;
    }

    setRootContextMenu({ x, y });
  }, []);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  }, []);

  const filteredFiles = useMemo(() => {
    const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
    if (!normalizedSearchQuery) {
      return files;
    }

    return filterFileTree(files, normalizedSearchQuery).map((entry) => entry.node);
  }, [deferredSearchQuery, files]);

  // Expand all folders when searching
  const currentExpandedFolders = useMemo(() => {
    if (!deferredSearchQuery.trim()) return expandedFolders;
    
    const allExpanded: Record<string, boolean> = {};
    const expandAll = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'directory') {
          allExpanded[node.path] = true;
          if (node.children) expandAll(node.children);
        }
      });
    };
    expandAll(filteredFiles);
    return allExpanded;
  }, [deferredSearchQuery, expandedFolders, filteredFiles]);

  const getFileIcon = useCallback((fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <FileCode2 size={14} className="shrink-0 text-yellow-400/80" />;
      case 'json':
        return <FileJson size={14} className="shrink-0 text-green-400/80" />;
      case 'css':
      case 'scss':
      case 'html':
        return <FileType2 size={14} className="shrink-0 text-blue-400/80" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'svg':
      case 'gif':
        return <FileImage size={14} className="shrink-0 text-purple-400/80" />;
      case 'md':
      case 'txt':
        return <FileText size={14} className="shrink-0 text-gray-400" />;
      default:
        return <File size={14} className="shrink-0 text-gray-500" />;
    }
  }, []);

  const handleInputSubmit = useCallback(() => {
    if (!inputValue.trim()) {
      setCreatingNode(null);
      setRenamingNode(null);
      return;
    }

    if (creatingNode) {
      const newPath = `${creatingNode.parentPath}/${inputValue.trim()}`;
      if (creatingNode.type === 'file' && onCreateFile) {
        onCreateFile(newPath);
      } else if (creatingNode.type === 'directory' && onCreateFolder) {
        onCreateFolder(newPath);
      }
      setExpandedFolders(prev => ({ ...prev, [creatingNode.parentPath]: true }));
      setCreatingNode(null);
    } else if (renamingNode && onRenameNode) {
      const parentPath = renamingNode.path.substring(0, renamingNode.path.lastIndexOf('/'));
      const newPath = `${parentPath}/${inputValue.trim()}`;
      if (newPath !== renamingNode.path) {
        onRenameNode(renamingNode.path, newPath);
      }
      setRenamingNode(null);
    }
    setInputValue('');
  }, [creatingNode, inputValue, onCreateFile, onCreateFolder, onRenameNode, renamingNode]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputSubmit();
    } else if (e.key === 'Escape') {
      setCreatingNode(null);
      setRenamingNode(null);
      setInputValue('');
    }
  }, [handleInputSubmit]);

  const handleInputBlur = useCallback(() => {
    setCreatingNode(null);
    setRenamingNode(null);
    setInputValue('');
  }, []);

  const fileTreeContent = useMemo(() => {
    const renderNode = (node: FileNode, depth: number = 0, index: number = 0): React.ReactNode => {
      const isExpanded = currentExpandedFolders[node.path];
      const isSelected = selectedFile === node.path;

      return (
        <div key={node.path} className="relative">
          {depth > 0 && (
            <div
              className="absolute top-0 bottom-0 border-l border-white/10 pointer-events-none"
              style={{ left: `${(depth - 1) * 12 + 14}px` }}
            />
          )}
          <div
            className={`group flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:bg-white/5 text-[13px] transition-colors animate-in fade-in slide-in-from-left-2 fill-mode-both ${isSelected ? 'bg-white/10 text-white' : 'text-gray-400'}`}
            style={{ paddingLeft: `${depth * 12 + 8}px`, animationDelay: `${(depth * 50) + (index * 30)}ms` }}
            onClick={() => {
              if (node.type === 'directory') {
                toggleFolder(node.path);
              } else {
                onSelectFile(node.path);
              }
            }}
            onContextMenu={(event) => handleContextMenu(event, node)}
          >
            {node.type === 'directory' ? (
              isExpanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />
            ) : (
              <span className="w-[14px] shrink-0"></span>
            )}

            {node.type === 'directory' ? (
              <Folder size={14} className="shrink-0 text-blue-400/90" />
            ) : (
              getFileIcon(node.name)
            )}

            {renamingNode?.path === node.path ? (
              <input
                type="text"
                autoFocus
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleInputKeyDown}
                onBlur={handleInputBlur}
                className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1"
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <span className="truncate flex-1">{node.name}</span>
            )}

            <div className="hidden group-hover:flex items-center gap-1 pr-1">
              {node.type === 'directory' ? (
                <>
                  <div title="New File">
                    <FilePlus
                      size={12}
                      className="text-gray-400 hover:text-white transition-colors"
                      onClick={(event) => {
                        event.stopPropagation();
                        setCreatingNode({ parentPath: node.path, type: 'file' });
                        setInputValue('');
                        setExpandedFolders((previousState) => ({ ...previousState, [node.path]: true }));
                      }}
                    />
                  </div>
                  <div title="New Folder">
                    <FolderPlus
                      size={12}
                      className="text-gray-400 hover:text-white transition-colors"
                      onClick={(event) => {
                        event.stopPropagation();
                        setCreatingNode({ parentPath: node.path, type: 'directory' });
                        setInputValue('');
                        setExpandedFolders((previousState) => ({ ...previousState, [node.path]: true }));
                      }}
                    />
                  </div>
                </>
              ) : null}
              <div title={`Delete ${node.type}`}>
                <Trash2
                  size={12}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                    setNodeToDelete(node);
                  }}
                />
              </div>
            </div>
          </div>

          {node.type === 'directory' && isExpanded ? (
            <div>
              {creatingNode?.parentPath === node.path ? (
                <div
                  className="flex items-center gap-1.5 py-1 px-2 text-[13px] text-white bg-white/5"
                  style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                >
                  <span className="w-[14px] shrink-0"></span>
                  {creatingNode.type === 'directory' ? (
                    <Folder size={14} className="shrink-0 text-blue-400/90" />
                  ) : (
                    <File size={14} className="shrink-0 text-gray-500" />
                  )}
                  <input
                    type="text"
                    autoFocus
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onBlur={handleInputBlur}
                    className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1"
                    placeholder={`New ${creatingNode.type}...`}
                  />
                </div>
              ) : null}
              {node.children?.map((child, childIndex) => renderNode(child, depth + 1, childIndex))}
            </div>
          ) : null}
        </div>
      );
    };

    if (creatingNode?.parentPath === '') {
      return (
        <>
          <div
            className="flex items-center gap-1.5 py-1 px-2 text-[13px] text-white bg-white/5"
            style={{ paddingLeft: '8px' }}
          >
            <span className="w-[14px] shrink-0"></span>
            {creatingNode.type === 'directory' ? (
              <Folder size={14} className="shrink-0 text-blue-400/90" />
            ) : (
              <File size={14} className="shrink-0 text-gray-500" />
            )}
            <input
              type="text"
              autoFocus
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1"
              placeholder={`New ${creatingNode.type}...`}
            />
          </div>
          {filteredFiles.length > 0 ? filteredFiles.map((file, index) => renderNode(file, 0, index)) : null}
        </>
      );
    }

    if (filteredFiles.length > 0) {
      return <>{filteredFiles.map((file, index) => renderNode(file, 0, index))}</>;
    }

    if (creatingNode) {
      return null;
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4 text-center gap-4 animate-in fade-in zoom-in-95 duration-300">
        {searchQuery ? (
          <>
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
              <Search size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-400">No files match "{searchQuery}"</p>
            <button
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              onClick={() => setSearchQuery('')}
            >
              Clear search
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
              <Folder size={20} className="text-gray-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-300 font-medium">Project is empty</p>
              <p className="text-xs text-gray-500">Create a file to get started.</p>
            </div>
            <button
              className="mt-2 flex items-center gap-2 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-4 py-2 rounded-md transition-colors border border-blue-500/20"
              onClick={() => startCreatingRootNode('file')}
            >
              <Plus size={14} />
              <span>Create File</span>
            </button>
          </>
        )}
      </div>
    );
  }, [
    creatingNode,
    currentExpandedFolders,
    filteredFiles,
    getFileIcon,
    handleContextMenu,
    handleInputBlur,
    handleInputKeyDown,
    inputValue,
    onSelectFile,
    renamingNode,
    searchQuery,
    selectedFile,
    startCreatingRootNode,
    toggleFolder,
  ]);

  return (
    <div className="w-64 flex flex-col h-full bg-[#0e0e11] border-r border-white/5 shrink-0">
      <div className="flex flex-col shrink-0">
        <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <span>Explorer</span>
          <div className="flex gap-2">
            <div title="New File">
              <FilePlus 
                size={14} 
                className="cursor-pointer hover:text-white transition-colors" 
                onClick={() => startCreatingRootNode('file')}
              />
            </div>
            <div title="New Folder">
              <FolderPlus 
                size={14} 
                className="cursor-pointer hover:text-white transition-colors" 
                onClick={() => startCreatingRootNode('directory')}
              />
            </div>
            <div title="Collapse All">
              <ListCollapse 
                size={14} 
                className="cursor-pointer hover:text-white transition-colors" 
                onClick={() => setExpandedFolders({})}
              />
            </div>
            <div title="Search">
              <Search 
                size={14} 
                className={`cursor-pointer transition-colors ${isSearchVisible ? 'text-white' : 'hover:text-white'}`}
                onClick={() => {
                  setIsSearchVisible(!isSearchVisible);
                  if (isSearchVisible) setSearchQuery('');
                }}
              />
            </div>
          </div>
        </div>
        {isSearchVisible && (
          <div className="px-3 pb-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="w-full bg-[#0e0e11] border border-white/10 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500/50"
                autoFocus
              />
              {searchQuery && (
                <X 
                  size={12} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer hover:text-gray-300"
                  onClick={() => setSearchQuery('')}
                />
              )}
            </div>
          </div>
        )}
      </div>
      <div 
        className="flex-1 overflow-y-auto py-2 custom-scrollbar"
        onContextMenu={handleRootContextMenu}
      >
        {fileTreeContent}
      </div>

      {rootContextMenu && (
        <div 
          className="fixed bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 py-1.5 text-[13px] text-gray-300 w-56 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
          style={{ top: rootContextMenu.y, left: rootContextMenu.x, zIndex: FILE_EXPLORER_CONTEXT_MENU_Z_INDEX }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
            onClick={() => {
              startCreatingRootNode('file');
              setRootContextMenu(null);
            }}
          >
            <FilePlus size={14} className="text-gray-400" />
            <span>New File</span>
          </div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
            onClick={() => {
              startCreatingRootNode('directory');
              setRootContextMenu(null);
            }}
          >
            <FolderPlus size={14} className="text-gray-400" />
            <span>New Folder</span>
          </div>
          <div className="h-px bg-white/10 my-1.5"></div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
            onClick={() => {
              const projectBasePath = resolveProjectBasePath();
              if (!projectBasePath) {
                notifyMissingProjectPath();
                setRootContextMenu(null);
                return;
              }
              import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
                globalEventBus.emit('openTerminal', projectBasePath);
              });
              setRootContextMenu(null);
            }}
          >
            <Terminal size={14} className="text-gray-400" />
            <span>Open in Terminal</span>
          </div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
            onClick={() => {
              const projectBasePath = resolveProjectBasePath();
              if (!projectBasePath) {
                notifyMissingProjectPath();
                setRootContextMenu(null);
                return;
              }
              import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
                globalEventBus.emit('revealInExplorer', projectBasePath);
              });
              setRootContextMenu(null);
            }}
          >
            <ExternalLink size={14} className="text-gray-400" />
            <span>Open in File Explorer</span>
          </div>
        </div>
      )}

      {contextMenu && (
        <div 
          className="fixed bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 py-1.5 text-[13px] text-gray-300 w-56 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
          style={{ top: contextMenu.y, left: contextMenu.x, zIndex: FILE_EXPLORER_CONTEXT_MENU_Z_INDEX }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.type === 'directory' && (
            <>
              <div 
                className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
                onClick={() => {
                  setCreatingNode({ parentPath: contextMenu.node.path, type: 'file' });
                  setInputValue('');
                  setExpandedFolders(prev => ({ ...prev, [contextMenu.node.path]: true }));
                  setContextMenu(null);
                }}
              >
                <FilePlus size={14} className="text-gray-400" />
                <span>New File</span>
              </div>
              <div 
                className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
                onClick={() => {
                  setCreatingNode({ parentPath: contextMenu.node.path, type: 'directory' });
                  setInputValue('');
                  setExpandedFolders(prev => ({ ...prev, [contextMenu.node.path]: true }));
                  setContextMenu(null);
                }}
              >
                <FolderPlus size={14} className="text-gray-400" />
                <span>New Folder</span>
              </div>
              <div className="h-px bg-white/10 my-1.5"></div>
            </>
          )}
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.node.path);
              setContextMenu(null);
              addToast('Copied relative path', 'success');
            }}
          >
            <Copy size={14} className="text-gray-400" />
            <span>Copy Relative Path</span>
          </div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
            onClick={() => {
              const fullPath = resolveNodeAbsolutePath(contextMenu.node.path);
              if (!fullPath) {
                notifyMissingProjectPath();
                setContextMenu(null);
                return;
              }
              navigator.clipboard.writeText(fullPath);
              setContextMenu(null);
              addToast('Copied full path', 'success');
            }}
          >
            <Copy size={14} className="text-gray-400" />
            <span>Copy Full Path</span>
          </div>
          <div className="h-px bg-white/10 my-1.5"></div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
            onClick={() => {
              if (onRenameNode) {
                setRenamingNode({ path: contextMenu.node.path, name: contextMenu.node.name });
                setInputValue(contextMenu.node.name);
              }
              setContextMenu(null);
            }}
          >
            <FileEdit size={14} className="text-gray-400" />
            <span>Rename</span>
          </div>
          <div 
            className="px-4 py-1.5 hover:bg-red-500/20 hover:text-red-400 cursor-pointer transition-colors flex items-center gap-2 text-red-500/80"
            onClick={() => {
              setNodeToDelete(contextMenu.node);
              setContextMenu(null);
            }}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </div>
          <div className="h-px bg-white/10 my-1.5"></div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
            onClick={() => {
              const targetPath = resolveNodeDirectoryPath(contextMenu.node);
              if (!targetPath) {
                notifyMissingProjectPath();
                setContextMenu(null);
                return;
              }
              import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
                globalEventBus.emit('openTerminal', targetPath);
              });
              setContextMenu(null);
            }}
          >
            <Terminal size={14} className="text-gray-400" />
            <span>Open in Terminal</span>
          </div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
            onClick={() => {
              const targetPath = resolveNodeDirectoryPath(contextMenu.node);
              if (!targetPath) {
                notifyMissingProjectPath();
                setContextMenu(null);
                return;
              }
              import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
                globalEventBus.emit('revealInExplorer', targetPath);
              });
              setContextMenu(null);
            }}
          >
            <ExternalLink size={14} className="text-gray-400" />
            <span>Open in File Explorer</span>
          </div>
        </div>
      )}

      {nodeToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-[#18181b]/50">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={16} className="text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Delete {nodeToDelete.type === 'directory' ? 'Folder' : 'File'}</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-300">
                Are you sure you want to delete <span className="font-semibold text-white break-all">{nodeToDelete.name}</span>?
              </p>
              {nodeToDelete.type === 'directory' && (
                <p className="text-xs text-red-400 mt-2">
                  This will also delete all files and folders inside it. This action cannot be undone.
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-white/5 bg-[#121214]">
              <button 
                onClick={() => setNodeToDelete(null)}
                className="px-4 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (nodeToDelete.type === 'directory' && onDeleteFolder) {
                    onDeleteFolder(nodeToDelete.path);
                  } else if (nodeToDelete.type === 'file' && onDeleteFile) {
                    onDeleteFile(nodeToDelete.path);
                  }
                  setNodeToDelete(null);
                }}
                className="px-4 py-2 rounded-md text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FileExplorer.displayName = 'FileExplorer';
