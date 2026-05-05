import React, { useState, useMemo, useEffect, useCallback, useDeferredValue, useRef } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Search, X, Plus, FilePlus, FolderPlus, Trash2, FileJson, FileCode2, FileImage, FileText, FileType2, ListCollapse, Copy, Terminal, ExternalLink, FileEdit, Loader2 } from 'lucide-react';
import { emitOpenTerminalRequest, globalEventBus, useToast } from '@sdkwork/birdcoder-commons';
import { copyTextToClipboard } from './clipboard';
import {
  buildVisibleFileExplorerRows,
  FILE_EXPLORER_OVERSCAN_ROWS,
  FILE_EXPLORER_ROW_HEIGHT,
  resolveVirtualizedFileExplorerWindow,
  type FileExplorerCreationDraft,
  type FileExplorerViewport,
} from './fileExplorerVirtualization';

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

interface FileExplorerProps {
  files: FileNode[];
  isActive?: boolean;
  width?: number;
  loadingDirectoryPaths?: Record<string, boolean>;
  onExpandDirectory?: (path: string) => void | Promise<void>;
  scopeKey?: string;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
  onCreateFile?: (path: string) => void;
  onCreateFolder?: (path: string) => void;
  onDeleteFile?: (path: string) => void;
  onDeleteFolder?: (path: string) => void;
  onRenameNode?: (oldPath: string, newPath: string) => void;
  basePath?: string;
}

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

type FileExplorerSearchResult = {
  expandedFolders: Readonly<Record<string, boolean>>;
  files: readonly FileNode[];
};

type FileExplorerSearchTask = {
  cancel: () => void;
};

type FileExplorerSearchTaskFrame = {
  index: number;
  matches: ScoredFileNode[];
  nodes: readonly FileNode[];
  parent?: {
    children: readonly FileNode[];
    frame: FileExplorerSearchTaskFrame;
    node: FileNode;
    nodeScore: number;
  };
};

type CreateFileExplorerSearchTaskOptions = {
  nodes: readonly FileNode[];
  normalizedQuery: string;
  onComplete: (result: FileExplorerSearchResult) => void;
};

type FileExplorerInlineInputRowProps = {
  depth: number;
  inputValue: string;
  type: 'file' | 'directory';
  placeholder?: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
};

type FileExplorerNodeRowProps = {
  node: FileNode;
  depth: number;
  inputValue: string;
  isDirectoryLoading: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  renamingNode: FileExplorerRenameDraft | null;
  onExpandDirectory?: (path: string) => void | Promise<void>;
  onNodePrimaryAction: (node: FileNode, isExpanded: boolean) => void;
  onContextMenu: (event: React.MouseEvent, node: FileNode) => void;
  onBeginCreateNode: (parentPath: string, type: 'file' | 'directory') => void;
  onRequestDeleteNode: (node: FileNode) => void;
  onInputValueChange: (value: string) => void;
  onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onInputBlur: () => void;
};

const EMPTY_FILE_EXPLORER_NODES: readonly FileNode[] = [];
const EMPTY_FILE_EXPLORER_EXPANDED_FOLDERS: Readonly<Record<string, boolean>> = Object.freeze({});
const EMPTY_FILE_EXPLORER_SEARCH_RESULT: FileExplorerSearchResult = Object.freeze({
  expandedFolders: EMPTY_FILE_EXPLORER_EXPANDED_FOLDERS,
  files: EMPTY_FILE_EXPLORER_NODES,
});

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
const FILE_EXPLORER_SEARCH_CHUNK_SIZE = 250;
const FILE_EXPLORER_SEARCH_IDLE_TIMEOUT_MS = 80;

function createFileExplorerSearchTaskFrame(
  nodes: readonly FileNode[],
  parent?: FileExplorerSearchTaskFrame['parent'],
): FileExplorerSearchTaskFrame {
  return {
    index: 0,
    matches: [],
    nodes,
    parent,
  };
}

function createFileExplorerSearchTask({
  nodes,
  normalizedQuery,
  onComplete,
}: CreateFileExplorerSearchTaskOptions): FileExplorerSearchTask {
  const expandedFolders: Record<string, boolean> = {};
  const rootFrame = createFileExplorerSearchTaskFrame(nodes);
  const searchStack: FileExplorerSearchTaskFrame[] = [rootFrame];
  let isCancelled = false;
  let searchIdleCallbackId: number | null = null;
  let searchTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const completeSearchFrame = (frame: FileExplorerSearchTaskFrame) => {
    frame.matches.sort((left, right) => right.score - left.score);

    if (!frame.parent) {
      onComplete({
        expandedFolders,
        files: frame.matches.map((entry) => entry.node),
      });
      return;
    }

    const nextChildren: FileNode[] = [];
    let maxChildScore = 0;
    for (const childMatch of frame.matches) {
      nextChildren.push(childMatch.node);
      if (childMatch.score > maxChildScore) {
        maxChildScore = childMatch.score;
      }
    }

    const { children, frame: parentFrame, node, nodeScore } = frame.parent;
    const totalScore = Math.max(nodeScore, maxChildScore);
    if (totalScore <= 0) {
      return;
    }

    if (nextChildren.length > 0) {
      expandedFolders[node.path] = true;
    }
    parentFrame.matches.push({
      node:
        nextChildren.length === children.length &&
        nextChildren.every((childNode, childIndex) => childNode === children[childIndex])
          ? node
          : { ...node, children: nextChildren },
      score: totalScore,
    });
  };

  function runNextSearchChunk() {
    searchIdleCallbackId = null;
    searchTimeoutId = null;
    let processedNodeCount = 0;

    while (
      !isCancelled &&
      searchStack.length > 0 &&
      processedNodeCount < FILE_EXPLORER_SEARCH_CHUNK_SIZE
    ) {
      processedNodeCount += 1;
      const currentFrame = searchStack[searchStack.length - 1]!;

      if (currentFrame.index >= currentFrame.nodes.length) {
        searchStack.pop();
        completeSearchFrame(currentFrame);
        continue;
      }

      const node = currentFrame.nodes[currentFrame.index]!;
      currentFrame.index += 1;
      const nodeScore = fuzzyScore(normalizedQuery, node.name.toLowerCase());

      if (node.type === 'directory' && node.children) {
        searchStack.push(createFileExplorerSearchTaskFrame(node.children, {
          children: node.children,
          frame: currentFrame,
          node,
          nodeScore,
        }));
        continue;
      }

      if (nodeScore > 0) {
        currentFrame.matches.push({ node, score: nodeScore });
      }
    }

    if (!isCancelled && searchStack.length > 0) {
      scheduleNextSearchChunk();
    }
  }

  function scheduleNextSearchChunk() {
    if (isCancelled) {
      return;
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      searchIdleCallbackId = window.requestIdleCallback(runNextSearchChunk, {
        timeout: FILE_EXPLORER_SEARCH_IDLE_TIMEOUT_MS,
      });
      return;
    }

    searchTimeoutId = setTimeout(runNextSearchChunk, 0);
  }

  scheduleNextSearchChunk();
  return {
    cancel: () => {
      isCancelled = true;
      if (
        searchIdleCallbackId !== null &&
        typeof window !== 'undefined' &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(searchIdleCallbackId);
        searchIdleCallbackId = null;
      }
      if (searchTimeoutId !== null) {
        clearTimeout(searchTimeoutId);
        searchTimeoutId = null;
      }
    },
  };
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

function resolveSingleRootDirectoryPath(files: readonly FileNode[]) {
  if (files.length !== 1) {
    return '';
  }

  const [rootNode] = files;
  if (!rootNode || rootNode.type !== 'directory') {
    return '';
  }

  return rootNode.path;
}

function getFileIcon(fileName: string) {
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
}

const FileExplorerInlineInputRow = React.memo(function FileExplorerInlineInputRow({
  depth,
  inputValue,
  type,
  placeholder,
  onChange,
  onKeyDown,
  onBlur,
}: FileExplorerInlineInputRowProps) {
  return (
    <div
      className="flex h-8 items-center gap-1.5 px-2 text-[13px] text-white bg-white/5"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span className="w-[14px] shrink-0"></span>
      {type === 'directory' ? (
        <Folder size={14} className="shrink-0 text-blue-400/90" />
      ) : (
        <File size={14} className="shrink-0 text-gray-500" />
      )}
      <input
        type="text"
        autoFocus
        value={inputValue}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1"
        placeholder={placeholder}
      />
    </div>
  );
});

FileExplorerInlineInputRow.displayName = 'FileExplorerInlineInputRow';

const FileExplorerNodeRow = React.memo(function FileExplorerNodeRow({
  node,
  depth,
  inputValue,
  isDirectoryLoading,
  isExpanded,
  isSelected,
  renamingNode,
  onExpandDirectory,
  onNodePrimaryAction,
  onContextMenu,
  onBeginCreateNode,
  onRequestDeleteNode,
  onInputValueChange,
  onInputKeyDown,
  onInputBlur,
}: FileExplorerNodeRowProps) {
  return (
    <div className="relative">
      {depth > 0 ? (
        <div
          className="absolute top-0 bottom-0 border-l border-white/10 pointer-events-none"
          style={{ left: `${(depth - 1) * 12 + 14}px` }}
        />
      ) : null}
      <div
        className={`group flex h-8 items-center gap-1.5 px-2 cursor-pointer hover:bg-white/5 text-[13px] transition-colors ${isSelected ? 'bg-white/10 text-white' : 'text-gray-400'}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          onNodePrimaryAction(node, Boolean(isExpanded));
        }}
        onContextMenu={(event) => onContextMenu(event, node)}
      >
        {node.type === 'directory' ? (
          isDirectoryLoading ? (
            <Loader2 size={14} className="shrink-0 animate-spin" />
          ) : isExpanded ? (
            <ChevronDown size={14} className="shrink-0" />
          ) : (
            <ChevronRight size={14} className="shrink-0" />
          )
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
            onChange={(event) => onInputValueChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            onBlur={onInputBlur}
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
                    onBeginCreateNode(node.path, 'file');
                    if (node.children === undefined && onExpandDirectory) {
                      void onExpandDirectory(node.path);
                    }
                  }}
                />
              </div>
              <div title="New Folder">
                <FolderPlus
                  size={12}
                  className="text-gray-400 hover:text-white transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                    onBeginCreateNode(node.path, 'directory');
                    if (node.children === undefined && onExpandDirectory) {
                      void onExpandDirectory(node.path);
                    }
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
                onRequestDeleteNode(node);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}, (left, right) => {
  if (left.node !== right.node) {
    return false;
  }

  if (left.depth !== right.depth) {
    return false;
  }

  if (left.renamingNode !== right.renamingNode) {
    return false;
  }

  if (left.inputValue !== right.inputValue) {
    return false;
  }

  if (
    left.isDirectoryLoading !== right.isDirectoryLoading ||
    left.isExpanded !== right.isExpanded ||
    left.isSelected !== right.isSelected ||
    left.onExpandDirectory !== right.onExpandDirectory ||
    left.onNodePrimaryAction !== right.onNodePrimaryAction ||
    left.onContextMenu !== right.onContextMenu ||
    left.onBeginCreateNode !== right.onBeginCreateNode ||
    left.onRequestDeleteNode !== right.onRequestDeleteNode ||
    left.onInputValueChange !== right.onInputValueChange ||
    left.onInputKeyDown !== right.onInputKeyDown ||
    left.onInputBlur !== right.onInputBlur
  ) {
    return false;
  }

  return true;
});

FileExplorerNodeRow.displayName = 'FileExplorerNodeRow';

export const FileExplorer = React.memo(function FileExplorer({
  files,
  isActive = true,
  width = 256,
  loadingDirectoryPaths = {},
  onExpandDirectory,
  scopeKey = '',
  onSelectFile,
  selectedFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameNode,
  basePath = '',
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState<FileNode | null>(null);

  const [contextMenu, setContextMenu] = useState<FileExplorerContextMenuState | null>(null);
  const [rootContextMenu, setRootContextMenu] = useState<FileExplorerRootContextMenuState | null>(null);
  const [creatingNode, setCreatingNode] = useState<FileExplorerCreationDraft | null>(null);
  const [renamingNode, setRenamingNode] = useState<FileExplorerRenameDraft | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [viewport, setViewport] = useState<FileExplorerViewport>({
    clientHeight: 0,
    scrollTop: 0,
  });
  const { addToast } = useToast();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedDeferredSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const [searchResult, setSearchResult] = useState<FileExplorerSearchResult>(EMPTY_FILE_EXPLORER_SEARCH_RESULT);
  const [isSearchPending, setIsSearchPending] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const resolveProjectBasePath = () => resolveAbsoluteExplorerPath(basePath, '');
  const resolveNodeAbsolutePath = (nodePath: string) => resolveAbsoluteExplorerPath(basePath, nodePath);
  const resolveNodeDirectoryPath = (node: FileNode) =>
    node.type === 'directory'
      ? resolveNodeAbsolutePath(node.path)
      : resolveAbsoluteExplorerPath(basePath, resolveRelativeParentPath(node.path));
  const notifyMissingProjectPath = () => addToast('Project folder path is unavailable', 'error');
  const rootCreationParentPath = useMemo(() => resolveRootCreationParentPath(files), [files]);
  const singleRootDirectoryPath = useMemo(() => resolveSingleRootDirectoryPath(files), [files]);
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

  useEffect(() => {
    setExpandedFolders({});
    setIsSearchVisible(false);
    setSearchQuery('');
    setNodeToDelete(null);
    setCreatingNode(null);
    setRenamingNode(null);
    setInputValue('');
    closeFloatingMenus();
  }, [closeFloatingMenus, scopeKey]);

  useEffect(() => {
    if (!singleRootDirectoryPath) {
      return;
    }

    setExpandedFolders((previousState) => {
      if (typeof previousState[singleRootDirectoryPath] === 'boolean') {
        return previousState;
      }

      return {
        ...previousState,
        [singleRootDirectoryPath]: true,
      };
    });
  }, [singleRootDirectoryPath]);

  const hasOpenViewportMenu = contextMenu !== null || rootContextMenu !== null;

  const handleClickOutside = useCallback(() => {
    if (!hasOpenViewportMenu) {
      return;
    }
    closeFloatingMenus();
  }, [closeFloatingMenus, hasOpenViewportMenu]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleCreateRootFile = () => {
      startCreatingRootNode('file');
    };

    const unsubscribe = globalEventBus.on('createRootFile', handleCreateRootFile);

    return () => {
      unsubscribe();
    };
  }, [isActive, startCreatingRootNode]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (!hasOpenViewportMenu) {
      return;
    }

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [handleClickOutside, hasOpenViewportMenu, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

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
  }, [closeFloatingMenus, hasOpenViewportMenu, isActive]);

  useEffect(() => {
    if (isActive) {
      return;
    }

    if (contextMenu !== null || rootContextMenu !== null) {
      closeFloatingMenus();
    }
  }, [closeFloatingMenus, contextMenu, isActive, rootContextMenu]);

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

  const ensureFolderExpanded = useCallback((path: string) => {
    if (!path) {
      return;
    }

    setExpandedFolders((previousState) => {
      if (previousState[path]) {
        return previousState;
      }

      return {
        ...previousState,
        [path]: true,
      };
    });
  }, []);

  useEffect(() => {
    if (!isActive || !normalizedDeferredSearchQuery) {
      setSearchResult(EMPTY_FILE_EXPLORER_SEARCH_RESULT);
      setIsSearchPending(false);
      return;
    }

    setSearchResult(EMPTY_FILE_EXPLORER_SEARCH_RESULT);
    setIsSearchPending(true);
    const searchTask = createFileExplorerSearchTask({
      nodes: files,
      normalizedQuery: normalizedDeferredSearchQuery,
      onComplete: (nextSearchResult) => {
        setSearchResult(nextSearchResult);
        setIsSearchPending(false);
      },
    });

    return () => {
      searchTask.cancel();
    };
  }, [files, isActive, normalizedDeferredSearchQuery]);

  const filteredFiles = normalizedDeferredSearchQuery
    ? searchResult.files
    : files;
  const currentExpandedFolders = normalizedDeferredSearchQuery
    ? searchResult.expandedFolders
    : expandedFolders;

  const handleNodePrimaryAction = useCallback((node: FileNode, isExpanded: boolean) => {
    if (node.type === 'directory') {
      if (!isExpanded && node.children === undefined && onExpandDirectory) {
        void onExpandDirectory(node.path);
      }
      toggleFolder(node.path);
      return;
    }

    onSelectFile(node.path);
  }, [onExpandDirectory, onSelectFile, toggleFolder]);

  const handleBeginCreateNode = useCallback((parentPath: string, type: 'file' | 'directory') => {
    setCreatingNode({ parentPath, type });
    setInputValue('');
    ensureFolderExpanded(parentPath);
  }, [ensureFolderExpanded]);

  const handleRequestDeleteNode = useCallback((node: FileNode) => {
    setNodeToDelete(node);
  }, []);

  const handleBeginRenameNode = useCallback((node: FileNode) => {
    if (!onRenameNode) {
      return;
    }

    setRenamingNode({ path: node.path, name: node.name });
    setInputValue(node.name);
  }, [onRenameNode]);

  const handleInputValueChange = useCallback((value: string) => {
    setInputValue(value);
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
      ensureFolderExpanded(creatingNode.parentPath);
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
  }, [creatingNode, ensureFolderExpanded, inputValue, onCreateFile, onCreateFolder, onRenameNode, renamingNode]);

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

  const visibleRows = useMemo(
    () =>
      buildVisibleFileExplorerRows({
        creatingNode,
        expandedFolders: currentExpandedFolders,
        files: filteredFiles,
      }),
    [creatingNode, currentExpandedFolders, filteredFiles],
  );
  const totalVisibleRowHeight = visibleRows.length * FILE_EXPLORER_ROW_HEIGHT;
  const shouldTrackViewportScroll = viewport.clientHeight > 0 && totalVisibleRowHeight > viewport.clientHeight;

  const virtualizedRows = useMemo(
    () =>
      resolveVirtualizedFileExplorerWindow({
        overscanRows: FILE_EXPLORER_OVERSCAN_ROWS,
        rowHeight: FILE_EXPLORER_ROW_HEIGHT,
        rows: visibleRows,
        viewport,
      }),
    [viewport, visibleRows],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const maxScrollTop = Math.max(0, totalVisibleRowHeight - scrollContainer.clientHeight);
    if (scrollContainer.scrollTop > maxScrollTop) {
      scrollContainer.scrollTop = maxScrollTop;
    }

    setViewport((previousViewport) => {
      const nextViewport = {
        clientHeight: scrollContainer.clientHeight,
        scrollTop: scrollContainer.scrollTop,
      };
      if (
        previousViewport.clientHeight === nextViewport.clientHeight &&
        previousViewport.scrollTop === nextViewport.scrollTop
      ) {
        return previousViewport;
      }

      return nextViewport;
    });
  }, [isActive, totalVisibleRowHeight]);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') {
      return undefined;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return undefined;
    }

    let animationFrameId = 0;
    const publishViewport = () => {
      animationFrameId = 0;
      setViewport((previousViewport) => {
        const nextViewport = {
          clientHeight: scrollContainer.clientHeight,
          scrollTop: scrollContainer.scrollTop,
        };
        if (
          previousViewport.clientHeight === nextViewport.clientHeight &&
          previousViewport.scrollTop === nextViewport.scrollTop
        ) {
          return previousViewport;
        }
        return nextViewport;
      });
    };
    const scheduleViewportPublish = () => {
      if (animationFrameId !== 0) {
        return;
      }
      animationFrameId = window.requestAnimationFrame(publishViewport);
    };

    scheduleViewportPublish();
    if (shouldTrackViewportScroll) {
      scrollContainer.addEventListener('scroll', scheduleViewportPublish, { passive: true });
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => {
        scheduleViewportPublish();
      });
      resizeObserver.observe(scrollContainer);
    }

    return () => {
      if (shouldTrackViewportScroll) {
        scrollContainer.removeEventListener('scroll', scheduleViewportPublish);
      }
      resizeObserver?.disconnect();
      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isActive, shouldTrackViewportScroll, totalVisibleRowHeight]);

  const fileTreeContent = useMemo(() => {
    if (!isActive) {
      return null;
    }

    if (isSearchPending && normalizedDeferredSearchQuery) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4 text-center gap-3">
          <Loader2 size={18} className="text-gray-400 animate-spin" />
          <p className="text-sm text-gray-400">Searching files...</p>
        </div>
      );
    }

    if (visibleRows.length > 0) {
      return (
        <>
          {virtualizedRows.paddingTop > 0 ? (
            <div style={{ height: `${virtualizedRows.paddingTop}px` }} />
          ) : null}
          {virtualizedRows.visibleRows.map((row) =>
            row.kind === 'input' ? (
              <FileExplorerInlineInputRow
                key={row.key}
                depth={row.depth}
                type={row.type}
                inputValue={inputValue}
                onChange={handleInputValueChange}
                onKeyDown={handleInputKeyDown}
                onBlur={handleInputBlur}
                placeholder={`New ${row.type}...`}
              />
            ) : (
              <FileExplorerNodeRow
                key={row.key}
                node={row.node}
                depth={row.depth}
                inputValue={inputValue}
                isDirectoryLoading={
                  row.node.type === 'directory' && loadingDirectoryPaths[row.node.path] === true
                }
                isExpanded={currentExpandedFolders[row.node.path] === true}
                isSelected={selectedFile === row.node.path}
                renamingNode={renamingNode}
                onExpandDirectory={onExpandDirectory}
                onNodePrimaryAction={handleNodePrimaryAction}
                onContextMenu={handleContextMenu}
                onBeginCreateNode={handleBeginCreateNode}
                onRequestDeleteNode={handleRequestDeleteNode}
                onInputValueChange={handleInputValueChange}
                onInputKeyDown={handleInputKeyDown}
                onInputBlur={handleInputBlur}
              />
            ),
          )}
          {virtualizedRows.paddingBottom > 0 ? (
            <div style={{ height: `${virtualizedRows.paddingBottom}px` }} />
          ) : null}
        </>
      );
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
    handleBeginCreateNode,
    handleContextMenu,
    handleInputBlur,
    handleInputKeyDown,
    handleInputValueChange,
    handleNodePrimaryAction,
    handleRequestDeleteNode,
    inputValue,
    currentExpandedFolders,
    isSearchPending,
    loadingDirectoryPaths,
    normalizedDeferredSearchQuery,
    onExpandDirectory,
    renamingNode,
    searchQuery,
    selectedFile,
    startCreatingRootNode,
    isActive,
    visibleRows,
    virtualizedRows.paddingBottom,
    virtualizedRows.paddingTop,
    virtualizedRows.visibleRows,
  ]);

  return (
    <div
      className="flex flex-col h-full bg-[#0e0e11] border-r border-white/5 shrink-0"
      style={{ width }}
    >
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
        ref={scrollContainerRef}
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
              emitOpenTerminalRequest({
                surface: 'workspace',
                path: projectBasePath,
                timestamp: Date.now(),
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
              globalEventBus.emit('revealInExplorer', projectBasePath);
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
                  handleBeginCreateNode(contextMenu.node.path, 'file');
                  if (contextMenu.node.children === undefined && onExpandDirectory) {
                    void onExpandDirectory(contextMenu.node.path);
                  }
                  setContextMenu(null);
                }}
              >
                <FilePlus size={14} className="text-gray-400" />
                <span>New File</span>
              </div>
              <div 
                className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
                onClick={() => {
                  handleBeginCreateNode(contextMenu.node.path, 'directory');
                  if (contextMenu.node.children === undefined && onExpandDirectory) {
                    void onExpandDirectory(contextMenu.node.path);
                  }
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
              void copyTextToClipboard(contextMenu.node.path).then((didCopy) => {
                if (!didCopy) {
                  addToast('Unable to copy relative path', 'error');
                  return;
                }
                addToast('Copied relative path', 'success');
              });
              setContextMenu(null);
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
              void copyTextToClipboard(fullPath).then((didCopy) => {
                if (!didCopy) {
                  addToast('Unable to copy full path', 'error');
                  return;
                }
                addToast('Copied full path', 'success');
              });
              setContextMenu(null);
            }}
          >
            <Copy size={14} className="text-gray-400" />
            <span>Copy Full Path</span>
          </div>
          <div className="h-px bg-white/10 my-1.5"></div>
          <div 
            className="px-4 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center gap-2"
            onClick={() => {
              handleBeginRenameNode(contextMenu.node);
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
              emitOpenTerminalRequest({
                surface: 'workspace',
                path: targetPath,
                timestamp: Date.now(),
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
              globalEventBus.emit('revealInExplorer', targetPath);
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
