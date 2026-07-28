import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useDeferredValue, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronRight, ChevronDown, File, Folder, Search, X, Plus, FilePlus, FolderPlus, Trash2, FileJson, FileCode2, FileImage, FileText, FileType2, ListCollapse, Copy, Terminal, ExternalLink, FileEdit, Loader2, RefreshCw } from 'lucide-react';
import {
  emitCopyProjectLocalPath,
  emitOpenProjectTerminal,
  emitRevealProjectInFileManager,
  resolveProjectDeviceMountTarget,
} from '@sdkwork/birdcoder-pc-workbench/events/projectDeviceMountEvents';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { copyTextToClipboard } from './clipboard';
import {
  buildVisibleFileExplorerRows,
  FILE_EXPLORER_OVERSCAN_ROWS,
  FILE_EXPLORER_ROW_HEIGHT,
  resolveVirtualizedFileExplorerWindow,
  type FileExplorerCreationDraft,
  type FileExplorerViewport,
} from './fileExplorerVirtualization';
import {
  normalizeFileExplorerNameForComparison,
  validateFileExplorerNodeName,
  type FileExplorerNameValidationReason,
} from './fileExplorerNameValidation';
import {
  collapseFileExplorerSearchFolders,
  resolveFileExplorerExpandedFolders,
  setFileExplorerFolderExpanded,
} from './fileExplorerExpansionState';

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

export interface FileExplorerProps {
  files: FileNode[];
  hasLoadError?: boolean;
  isActive?: boolean;
  isLoading?: boolean;
  width?: number;
  loadingDirectoryPaths?: Record<string, boolean>;
  onExpandDirectory?: (path: string) => void | Promise<void>;
  onRetryLoad?: () => void | Promise<void>;
  projectId?: string;
  projectRootPath?: string;
  scopeKey?: string;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
  onCreateFile?: (path: string) => void | Promise<void>;
  onCreateFolder?: (path: string) => void | Promise<void>;
  onDeleteFile?: (path: string) => void | Promise<void>;
  onDeleteFolder?: (path: string) => void | Promise<void>;
  onRenameNode?: (oldPath: string, newPath: string) => void | Promise<void>;
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
  readOnly: boolean;
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
  isFocused: boolean;
  hasDirectoryLoadError: boolean;
  isExpanded: boolean;
  isMutationPending: boolean;
  isSelected: boolean;
  renamingNode: FileExplorerRenameDraft | null;
  onNodePrimaryAction: (node: FileNode, isExpanded: boolean) => void;
  onNodeFocus: (path: string) => void;
  onNodeKeyDown: (
    event: React.KeyboardEvent<HTMLDivElement>,
    node: FileNode,
    isExpanded: boolean,
    depth: number,
  ) => void;
  onContextMenu: (event: React.MouseEvent, node: FileNode) => void;
  onBeginCreateNode: (
    parentPath: string,
    type: 'file' | 'directory',
    loadDirectory: boolean,
  ) => void;
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
const FILE_EXPLORER_NAME_VALIDATION_MESSAGE_KEYS: Record<
  FileExplorerNameValidationReason,
  string
> = {
  empty: 'code.fileNameRequired',
  'dot-entry': 'code.fileNameDotEntryInvalid',
  'path-separator': 'code.fileNamePathSeparatorInvalid',
  'invalid-character': 'code.fileNameCharacterInvalid',
  'too-long': 'code.fileNameTooLong',
  'trailing-dot-or-space': 'code.fileNameTrailingDotOrSpaceInvalid',
  'windows-reserved-name': 'code.fileNameWindowsReserved',
};

function fuzzyScore(normalizedPattern: string, normalizedCandidate: string): number {
  if (!normalizedPattern) return 1;
  if (!normalizedCandidate) return 0;
  
  let patternIdx = 0;
  let strIdx = 0;
  let score = 0;
  const patternLen = normalizedPattern.length;
  const strLen = normalizedCandidate.length;

  while (patternIdx < patternLen && strIdx < strLen) {
    if (normalizedPattern[patternIdx] === normalizedCandidate[strIdx]) {
      score += 10;
      if (patternIdx === strIdx) {
        score += 5;
      }
      patternIdx++;
    }
    strIdx++;
  }

  return patternIdx === patternLen ? score : 0;
}

const FILE_EXPLORER_CONTEXT_MENU_Z_INDEX = 2147483647;
const FILE_EXPLORER_CONTEXT_MENU_WIDTH = 224;
const FILE_EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING = 8;
const FILE_EXPLORER_SEARCH_CHUNK_SIZE = 250;
const FILE_EXPLORER_SEARCH_IDLE_TIMEOUT_MS = 80;

function resolveFileExplorerContextMenuPosition({
  estimatedHeight,
  x,
  y,
}: {
  estimatedHeight: number;
  x: number;
  y: number;
}): { x: number; y: number } {
  const viewportWidth = typeof window === 'undefined' ? FILE_EXPLORER_CONTEXT_MENU_WIDTH : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? estimatedHeight : window.innerHeight;
  const maxX = Math.max(
    FILE_EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING,
    viewportWidth - FILE_EXPLORER_CONTEXT_MENU_WIDTH - FILE_EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING,
  );
  const maxY = Math.max(
    FILE_EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING,
    viewportHeight - estimatedHeight - FILE_EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING,
  );
  return {
    x: Math.min(Math.max(x, FILE_EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING), maxX),
    y: Math.min(Math.max(y, FILE_EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING), maxY),
  };
}

function resolveFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ));
}

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

function normalizeRelativeNodePath(path: string): string {
  return path.trim().replace(/^[/\\]+/, '').replace(/[\\/]+/g, '/');
}

function resolveRelativeParentPath(path: string): string {
  const normalizedPath = normalizeRelativeNodePath(path);
  const lastSeparatorIndex = normalizedPath.lastIndexOf('/');
  if (lastSeparatorIndex === -1) {
    return '';
  }

  return normalizedPath.slice(0, lastSeparatorIndex);
}

function resolveMountedDirectoryPath(node: FileNode): string {
  if (node.type === 'directory') {
    return node.path;
  }

  const normalizedPath = node.path.trim().replace(/\\/gu, '/').replace(/\/+/gu, '/');
  const lastSeparatorIndex = normalizedPath.lastIndexOf('/');
  return lastSeparatorIndex > 0 ? normalizedPath.slice(0, lastSeparatorIndex) : normalizedPath;
}

function resolveFileExplorerChildrenForParent(
  files: readonly FileNode[],
  parentPath: string,
): readonly FileNode[] | null {
  const normalizedParentPath = normalizeRelativeNodePath(parentPath);
  if (!normalizedParentPath) {
    return files;
  }

  const pendingNodes = [...files];
  while (pendingNodes.length > 0) {
    const node = pendingNodes.pop()!;
    if (normalizeRelativeNodePath(node.path) === normalizedParentPath) {
      return node.type === 'directory' ? node.children ?? null : null;
    }
    if (node.children) {
      pendingNodes.push(...node.children);
    }
  }

  return null;
}

function hasFileExplorerNameConflict({
  files,
  ignoredPath,
  name,
  parentPath,
}: {
  files: readonly FileNode[];
  ignoredPath?: string;
  name: string;
  parentPath: string;
}): boolean {
  const siblings = resolveFileExplorerChildrenForParent(files, parentPath);
  if (!siblings) {
    return false;
  }

  const normalizedIgnoredPath = ignoredPath
    ? normalizeRelativeNodePath(ignoredPath)
    : '';
  const normalizedName = normalizeFileExplorerNameForComparison(name);
  return siblings.some((node) => {
    if (
      normalizedIgnoredPath &&
      normalizeRelativeNodePath(node.path) === normalizedIgnoredPath
    ) {
      return false;
    }
    return normalizeFileExplorerNameForComparison(node.name) === normalizedName;
  });
}

function isFileExplorerNameConflictError(error: unknown): boolean {
  const errorName =
    typeof DOMException !== 'undefined' && error instanceof DOMException ? error.name : '';
  const errorMessage = error instanceof Error ? error.message : String(error ?? '');
  return (
    errorName === 'InvalidModificationError' ||
    /already exists|file exists|directory exists|entry exists|destination exists|name conflict/iu.test(
      errorMessage,
    )
  );
}

function resolveFileExplorerErrorCategory(error: unknown): string {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name || 'DOMException';
  }
  if (error instanceof TypeError) return 'TypeError';
  if (error instanceof Error) return 'Error';
  return 'UnknownError';
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
  readOnly,
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
        aria-busy={readOnly}
        aria-readonly={readOnly}
        readOnly={readOnly}
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
  isFocused,
  hasDirectoryLoadError,
  isExpanded,
  isMutationPending,
  isSelected,
  renamingNode,
  onNodePrimaryAction,
  onNodeFocus,
  onNodeKeyDown,
  onContextMenu,
  onBeginCreateNode,
  onRequestDeleteNode,
  onInputValueChange,
  onInputKeyDown,
  onInputBlur,
}: FileExplorerNodeRowProps) {
  const { t } = useTranslation();
  const loadErrorDescriptionId = useId();
  return (
    <div className="relative">
      {depth > 0 ? (
        <div
          className="absolute top-0 bottom-0 border-l border-white/10 pointer-events-none"
          style={{ left: `${(depth - 1) * 12 + 14}px` }}
        />
      ) : null}
      <div
        role="treeitem"
        aria-label={node.name}
        aria-describedby={hasDirectoryLoadError ? loadErrorDescriptionId : undefined}
        aria-expanded={node.type === 'directory' ? isExpanded : undefined}
        aria-busy={node.type === 'directory' ? isDirectoryLoading : undefined}
        aria-invalid={node.type === 'directory' && hasDirectoryLoadError ? true : undefined}
        aria-level={depth + 1}
        aria-selected={isSelected}
        tabIndex={isFocused ? 0 : -1}
        data-file-explorer-path={node.path}
        title={hasDirectoryLoadError ? t('code.retryDirectoryLoad') : undefined}
        className={`group flex h-8 items-center gap-1.5 px-2 cursor-pointer hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500 text-[13px] transition-colors ${isSelected ? 'bg-white/10 text-white' : 'text-gray-400'}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          onNodePrimaryAction(node, Boolean(isExpanded));
        }}
        onFocus={() => onNodeFocus(node.path)}
        onKeyDown={(event) => onNodeKeyDown(event, node, Boolean(isExpanded), depth)}
        onContextMenu={(event) => onContextMenu(event, node)}
      >
        {node.type === 'directory' ? (
          isDirectoryLoading ? (
            <Loader2 size={14} className="shrink-0 animate-spin" />
          ) : hasDirectoryLoadError ? (
            <AlertCircle size={14} className="shrink-0 text-red-400" aria-hidden="true" />
          ) : isExpanded ? (
            <ChevronDown size={14} className="shrink-0" />
          ) : (
            <ChevronRight size={14} className="shrink-0" />
          )
        ) : (
          <span className="w-[14px] shrink-0"></span>
        )}

        {hasDirectoryLoadError ? (
          <span id={loadErrorDescriptionId} className="sr-only">
            {t('code.directoryLoadFailedRetry')}
          </span>
        ) : null}

        {node.type === 'directory' ? (
          <Folder size={14} className="shrink-0 text-blue-400/90" />
        ) : (
          getFileIcon(node.name)
        )}

        {renamingNode?.path === node.path ? (
          <input
            type="text"
            autoFocus
            aria-busy={isMutationPending}
            aria-readonly={isMutationPending}
            readOnly={isMutationPending}
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

        <div className="ml-auto flex items-center gap-1 pr-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {node.type === 'directory' ? (
            <>
              <button
                type="button"
                tabIndex={-1}
                title={t('code.newFile')}
                aria-label={t('code.createFileInFolder', { name: node.name })}
                className="rounded p-1 text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                onClick={(event) => {
                  event.stopPropagation();
                  onBeginCreateNode(node.path, 'file', node.children === undefined);
                }}
              >
                <FilePlus
                  size={12}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                tabIndex={-1}
                title={t('code.newFolder')}
                aria-label={t('code.createFolderInFolder', { name: node.name })}
                className="rounded p-1 text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                onClick={(event) => {
                  event.stopPropagation();
                  onBeginCreateNode(node.path, 'directory', node.children === undefined);
                }}
              >
                <FolderPlus
                  size={12}
                  aria-hidden="true"
                />
              </button>
            </>
          ) : null}
          <button
            type="button"
            tabIndex={-1}
            title={node.type === 'directory' ? t('code.deleteFolder') : t('code.deleteFile')}
            aria-label={t('code.deleteNamedNode', { name: node.name })}
            className="rounded p-1 text-gray-400 transition-colors hover:text-red-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
            onClick={(event) => {
              event.stopPropagation();
              onRequestDeleteNode(node);
            }}
          >
            <Trash2
              size={12}
              aria-hidden="true"
            />
          </button>
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
    left.isFocused !== right.isFocused ||
    left.hasDirectoryLoadError !== right.hasDirectoryLoadError ||
    left.isExpanded !== right.isExpanded ||
    left.isMutationPending !== right.isMutationPending ||
    left.isSelected !== right.isSelected ||
    left.onNodePrimaryAction !== right.onNodePrimaryAction ||
    left.onNodeFocus !== right.onNodeFocus ||
    left.onNodeKeyDown !== right.onNodeKeyDown ||
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
  hasLoadError = false,
  isActive = true,
  isLoading = false,
  width = 256,
  loadingDirectoryPaths = {},
  onExpandDirectory,
  onRetryLoad,
  projectId = '',
  projectRootPath = '',
  scopeKey = '',
  onSelectFile,
  selectedFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameNode,
}: FileExplorerProps) {
  const { t } = useTranslation();
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [searchExpansionOverrides, setSearchExpansionOverrides] = useState<Record<string, boolean>>({});
  const [directoryLoadErrors, setDirectoryLoadErrors] = useState<Record<string, boolean>>({});
  const [focusedNodePath, setFocusedNodePath] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState<FileNode | null>(null);

  const [contextMenu, setContextMenu] = useState<FileExplorerContextMenuState | null>(null);
  const [rootContextMenu, setRootContextMenu] = useState<FileExplorerRootContextMenuState | null>(null);
  const [creatingNode, setCreatingNode] = useState<FileExplorerCreationDraft | null>(null);
  const [renamingNode, setRenamingNode] = useState<FileExplorerRenameDraft | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isMutationPending, setIsMutationPending] = useState(false);
  const [viewport, setViewport] = useState<FileExplorerViewport>({
    clientHeight: 0,
    scrollTop: 0,
  });
  const { addToast } = useToast();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedDeferredSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const isSearchActive = isSearchVisible && Boolean(normalizedDeferredSearchQuery);
  const [searchResult, setSearchResult] = useState<FileExplorerSearchResult>(EMPTY_FILE_EXPLORER_SEARCH_RESULT);
  const [isSearchPending, setIsSearchPending] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const floatingMenuRef = useRef<HTMLDivElement | null>(null);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  const deleteDialogCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingTreeFocusPathRef = useRef('');
  const floatingMenuReturnFocusPathRef = useRef('');
  const deleteDialogReturnFocusPathRef = useRef('');
  const directoryLoadRequestsRef = useRef<Map<string, Promise<boolean>>>(new Map());
  const directoryLoadScopeGenerationRef = useRef(0);
  const mutationGenerationRef = useRef(0);
  const deleteDialogTitleId = useId();
  const deleteDialogDescriptionId = useId();

  const resolveProjectMountTarget = (mountedPath?: string) => {
    return resolveProjectDeviceMountTarget({ projectId, mountedPath });
  };
  const notifyUnavailableLocalFolder = () => addToast(t('code.projectFolderUnavailable'), 'error');
  const rootCreationParentPath = useMemo(() => projectRootPath.trim(), [projectRootPath]);
  const fileExplorerScopeIdentity = `${scopeKey}\u0000${rootCreationParentPath}`;
  const singleRootDirectoryPath = rootCreationParentPath;
  const startCreatingRootNode = useCallback((type: 'file' | 'directory') => {
    if (isMutationPending) {
      return;
    }
    setCreatingNode({ parentPath: rootCreationParentPath, type });
    setInputValue('');
    setIsSearchVisible(false);
    setSearchQuery('');
    setSearchExpansionOverrides({});
    if (rootCreationParentPath) {
      setExpandedFolders((previousState) => ({
        ...previousState,
        [rootCreationParentPath]: true,
      }));
    }
  }, [isMutationPending, rootCreationParentPath]);

  const closeFloatingMenus = useCallback(() => {
    setContextMenu(null);
    setRootContextMenu(null);
  }, []);

  const restoreTreeFocus = useCallback((path: string) => {
    if (!path) return;
    setFocusedNodePath(path);
    pendingTreeFocusPathRef.current = path;
    window.requestAnimationFrame(() => {
      const scrollContainer = scrollContainerRef.current;
      const mountedRow = scrollContainer
        ? Array.from(
            scrollContainer.querySelectorAll<HTMLElement>('[data-file-explorer-path]'),
          ).find((element) => element.dataset.fileExplorerPath === path)
        : null;
      if (mountedRow) {
        pendingTreeFocusPathRef.current = '';
        mountedRow.focus();
      }
    });
  }, []);

  useEffect(() => {
    mutationGenerationRef.current += 1;
    setExpandedFolders({});
    setSearchExpansionOverrides({});
    setDirectoryLoadErrors({});
    directoryLoadRequestsRef.current.clear();
    directoryLoadScopeGenerationRef.current += 1;
    setFocusedNodePath('');
    pendingTreeFocusPathRef.current = '';
    floatingMenuReturnFocusPathRef.current = '';
    deleteDialogReturnFocusPathRef.current = '';
    setIsSearchVisible(false);
    setSearchQuery('');
    setNodeToDelete(null);
    setCreatingNode(null);
    setRenamingNode(null);
    setInputValue('');
    setIsMutationPending(false);
    closeFloatingMenus();
  }, [closeFloatingMenus, fileExplorerScopeIdentity]);

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

  useLayoutEffect(() => {
    if (!isActive || !hasOpenViewportMenu) {
      return;
    }
    floatingMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [hasOpenViewportMenu, isActive]);

  useEffect(() => {
    if (!isActive || !nodeToDelete) {
      return;
    }
    const animationFrameId = window.requestAnimationFrame(() => {
      deleteDialogCancelButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isActive, nodeToDelete]);

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

    const scrollContainer = scrollContainerRef.current;
    window.addEventListener('resize', handleViewportChange, { passive: true });
    scrollContainer?.addEventListener('scroll', handleViewportChange, { passive: true });
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      scrollContainer?.removeEventListener('scroll', handleViewportChange);
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

  const openNodeContextMenu = useCallback((node: FileNode, x: number, y: number) => {
    floatingMenuReturnFocusPathRef.current = node.path;
    setRootContextMenu(null);
    const position = resolveFileExplorerContextMenuPosition({
      estimatedHeight: node.type === 'directory' ? 360 : 290,
      x,
      y,
    });
    setContextMenu({ ...position, node });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    openNodeContextMenu(node, e.clientX, e.clientY);
  }, [openNodeContextMenu]);

  const handleRootContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    floatingMenuReturnFocusPathRef.current = '';
    setContextMenu(null);
    
    setRootContextMenu(resolveFileExplorerContextMenuPosition({
      estimatedHeight: 190,
      x: e.clientX,
      y: e.clientY,
    }));
  }, []);

  const handleFloatingMenuKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      closeFloatingMenus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      const returnFocusPath = floatingMenuReturnFocusPathRef.current;
      closeFloatingMenus();
      restoreTreeFocus(returnFocusPath);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const menuItems = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    );
    if (menuItems.length === 0) {
      return;
    }
    event.preventDefault();
    const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Home') {
      menuItems[0]?.focus();
      return;
    }
    if (event.key === 'End') {
      menuItems.at(-1)?.focus();
      return;
    }
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + offset + menuItems.length) % menuItems.length;
    menuItems[nextIndex]?.focus();
  }, [closeFloatingMenus, restoreTreeFocus]);

  const handleFloatingMenuBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const nextFocusedElement = event.relatedTarget;
    if (
      nextFocusedElement instanceof Node
      && event.currentTarget.contains(nextFocusedElement)
    ) {
      return;
    }
    closeFloatingMenus();
  }, [closeFloatingMenus]);

  const setFolderExpanded = useCallback((
    path: string,
    expanded: boolean,
    searchMode: boolean,
  ) => {
    const update = (previousState: Readonly<Record<string, boolean>>) =>
      setFileExplorerFolderExpanded(previousState, path, expanded);
    if (searchMode) {
      setSearchExpansionOverrides(update);
      return;
    }
    setExpandedFolders(update);
  }, []);

  const ensureFolderExpanded = useCallback((path: string, searchMode = false) => {
    if (!path) {
      return;
    }
    setExpandedFolders((previousState) =>
      setFileExplorerFolderExpanded(previousState, path, true));
    if (searchMode) {
      setSearchExpansionOverrides((previousState) =>
        setFileExplorerFolderExpanded(previousState, path, true));
    }
  }, []);

  const requestDirectoryLoad = useCallback((path: string, searchMode: boolean) => {
    if (!onExpandDirectory) return Promise.resolve(true);
    const existingRequest = directoryLoadRequestsRef.current.get(path);
    if (existingRequest) return existingRequest;
    const scopeGeneration = directoryLoadScopeGenerationRef.current;
    setDirectoryLoadErrors((previousState) => {
      if (!previousState[path]) return previousState;
      const nextState = { ...previousState };
      delete nextState[path];
      return nextState;
    });
    const directoryLoadRequest = Promise.resolve()
      .then(() => onExpandDirectory(path))
      .then(() => true)
      .catch((error) => {
        if (directoryLoadScopeGenerationRef.current !== scopeGeneration) {
          return false;
        }
        console.error(
          'Failed to expand file explorer directory',
          resolveFileExplorerErrorCategory(error),
        );
        setFolderExpanded(path, false, searchMode);
        setDirectoryLoadErrors((previousState) => ({
          ...previousState,
          [path]: true,
        }));
        addToast(t('code.failedToLoadDirectory'), 'error');
        return false;
      });
    directoryLoadRequestsRef.current.set(path, directoryLoadRequest);
    const completeDirectoryLoad = () => {
      if (directoryLoadRequestsRef.current.get(path) === directoryLoadRequest) {
        directoryLoadRequestsRef.current.delete(path);
      }
    };
    void directoryLoadRequest.then(completeDirectoryLoad, completeDirectoryLoad);
    return directoryLoadRequest;
  }, [addToast, onExpandDirectory, setFolderExpanded, t]);

  useEffect(() => {
    if (!isActive || !isSearchActive) {
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
  }, [files, isActive, isSearchActive, normalizedDeferredSearchQuery]);

  useEffect(() => {
    setSearchExpansionOverrides({});
  }, [normalizedDeferredSearchQuery]);

  const filteredFiles = isSearchActive
    ? searchResult.files
    : files;
  const currentExpandedFolders = useMemo(
    () => resolveFileExplorerExpandedFolders({
      expandedFolders,
      searchActive: isSearchActive,
      searchExpandedFolders: searchResult.expandedFolders,
      searchExpansionOverrides,
    }),
    [
      expandedFolders,
      isSearchActive,
      searchExpansionOverrides,
      searchResult.expandedFolders,
    ],
  );

  const handleNodePrimaryAction = useCallback((node: FileNode, isExpanded: boolean) => {
    if (node.type === 'directory') {
      const searchMode = isSearchActive;
      const shouldRetryLoad = directoryLoadErrors[node.path] === true;
      const nextExpanded = shouldRetryLoad ? true : !isExpanded;
      setFolderExpanded(node.path, nextExpanded, searchMode);
      if (nextExpanded && (shouldRetryLoad || node.children === undefined)) {
        void requestDirectoryLoad(node.path, searchMode);
      }
      return;
    }

    onSelectFile(node.path);
  }, [
    directoryLoadErrors,
    isSearchActive,
    onSelectFile,
    requestDirectoryLoad,
    setFolderExpanded,
  ]);

  const handleBeginCreateNode = useCallback((
    parentPath: string,
    type: 'file' | 'directory',
    loadDirectory: boolean,
  ) => {
    if (isMutationPending) {
      return;
    }
    setCreatingNode({ parentPath, type });
    setInputValue('');
    const searchMode = isSearchActive;
    ensureFolderExpanded(parentPath, searchMode);
    if (loadDirectory) void requestDirectoryLoad(parentPath, searchMode);
  }, [
    ensureFolderExpanded,
    isMutationPending,
    isSearchActive,
    requestDirectoryLoad,
  ]);

  const handleCollapseAllFolders = useCallback(() => {
    setExpandedFolders({});
    if (isSearchActive) {
      setSearchExpansionOverrides(
        collapseFileExplorerSearchFolders(searchResult.expandedFolders),
      );
    }
  }, [isSearchActive, searchResult.expandedFolders]);

  const handleToggleSearch = useCallback(() => {
    setIsSearchVisible((wasVisible) => {
      if (wasVisible) {
        setSearchQuery('');
        setSearchExpansionOverrides({});
      }
      return !wasVisible;
    });
  }, []);

  const handleRequestDeleteNode = useCallback((node: FileNode) => {
    if (isMutationPending) {
      return;
    }
    deleteDialogReturnFocusPathRef.current = node.path;
    setNodeToDelete(node);
  }, [isMutationPending]);

  const handleCancelDeleteNode = useCallback(() => {
    if (!isMutationPending) {
      const returnFocusPath = deleteDialogReturnFocusPathRef.current;
      setNodeToDelete(null);
      restoreTreeFocus(returnFocusPath);
    }
  }, [isMutationPending, restoreTreeFocus]);

  const handleConfirmDeleteNode = useCallback(async () => {
    if (!nodeToDelete || isMutationPending) {
      return;
    }
    const deleteNode = nodeToDelete.type === 'directory' ? onDeleteFolder : onDeleteFile;
    const failureMessageKey = nodeToDelete.type === 'directory'
      ? 'code.failedToDeleteFolder'
      : 'code.failedToDeleteFile';
    if (!deleteNode) {
      addToast(t(failureMessageKey), 'error');
      return;
    }

    const mutationGeneration = mutationGenerationRef.current + 1;
    mutationGenerationRef.current = mutationGeneration;
    setIsMutationPending(true);
    try {
      await deleteNode(nodeToDelete.path);
      if (mutationGenerationRef.current !== mutationGeneration) {
        return;
      }
      const parentSeparatorIndex = nodeToDelete.path.lastIndexOf('/');
      const parentPath = parentSeparatorIndex > 0
        ? nodeToDelete.path.slice(0, parentSeparatorIndex)
        : '';
      setNodeToDelete(null);
      restoreTreeFocus(parentPath);
    } catch (error) {
      console.error(
        'Failed to delete file explorer node',
        resolveFileExplorerErrorCategory(error),
      );
      if (mutationGenerationRef.current === mutationGeneration) {
        addToast(t(failureMessageKey), 'error');
        window.requestAnimationFrame(() => deleteDialogCancelButtonRef.current?.focus());
      }
    } finally {
      if (mutationGenerationRef.current === mutationGeneration) {
        setIsMutationPending(false);
      }
    }
  }, [
    addToast,
    isMutationPending,
    nodeToDelete,
    onDeleteFile,
    onDeleteFolder,
    restoreTreeFocus,
    t,
  ]);

  const handleDeleteDialogKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelDeleteNode();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const dialog = deleteDialogRef.current;
    if (!dialog) {
      return;
    }
    const focusableElements = resolveFocusableElements(dialog);
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }
    const firstElement = focusableElements[0]!;
    const lastElement = focusableElements.at(-1)!;
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }, [handleCancelDeleteNode]);

  const handleBeginRenameNode = useCallback((node: FileNode) => {
    if (isMutationPending || !onRenameNode) {
      return;
    }

    setRenamingNode({ path: node.path, name: node.name });
    setInputValue(node.name);
  }, [isMutationPending, onRenameNode]);

  const handleInputValueChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleInputSubmit = useCallback(async () => {
    if (isMutationPending) {
      return;
    }

    const validation = validateFileExplorerNodeName(inputValue);
    if (!validation.isValid) {
      addToast(t(FILE_EXPLORER_NAME_VALIDATION_MESSAGE_KEYS[validation.reason]), 'error');
      return;
    }

    const nextName = validation.name;
    if (creatingNode) {
      const createNode = creatingNode.type === 'file' ? onCreateFile : onCreateFolder;
      const failureMessageKey =
        creatingNode.type === 'file'
          ? 'code.failedToCreateFile'
          : 'code.failedToCreateFolder';
      const newPath = `${creatingNode.parentPath}/${nextName}`;
      if (
        hasFileExplorerNameConflict({
          files,
          name: nextName,
          parentPath: creatingNode.parentPath,
        })
      ) {
        addToast(t('code.fileNameConflict'), 'error');
        return;
      }
      if (!createNode) {
        addToast(t(failureMessageKey), 'error');
        return;
      }

      const mutationGeneration = mutationGenerationRef.current + 1;
      mutationGenerationRef.current = mutationGeneration;
      setIsMutationPending(true);
      try {
        await createNode(newPath);
        if (mutationGenerationRef.current !== mutationGeneration) {
          return;
        }
        ensureFolderExpanded(creatingNode.parentPath);
        setCreatingNode(null);
        setInputValue('');
      } catch (error) {
        console.error(
          'Failed to create file explorer node',
          resolveFileExplorerErrorCategory(error),
        );
        if (mutationGenerationRef.current !== mutationGeneration) {
          return;
        }
        addToast(
          isFileExplorerNameConflictError(error)
            ? t('code.fileNameConflict')
            : t(failureMessageKey),
          'error',
        );
      } finally {
        if (mutationGenerationRef.current === mutationGeneration) {
          setIsMutationPending(false);
        }
      }
      return;
    }

    if (!renamingNode) {
      return;
    }

    const parentSeparatorIndex = renamingNode.path.lastIndexOf('/');
    const parentPath =
      parentSeparatorIndex === -1 ? '' : renamingNode.path.slice(0, parentSeparatorIndex);
    const newPath = `${parentPath}/${nextName}`;
    if (newPath === renamingNode.path) {
      setRenamingNode(null);
      setInputValue('');
      return;
    }
    if (
      hasFileExplorerNameConflict({
        files,
        ignoredPath: renamingNode.path,
        name: nextName,
        parentPath,
      })
    ) {
      addToast(t('code.fileNameConflict'), 'error');
      return;
    }
    if (!onRenameNode) {
      addToast(t('code.failedToRenameNode'), 'error');
      return;
    }

    const mutationGeneration = mutationGenerationRef.current + 1;
    mutationGenerationRef.current = mutationGeneration;
    setIsMutationPending(true);
    try {
      await onRenameNode(renamingNode.path, newPath);
      if (mutationGenerationRef.current !== mutationGeneration) {
        return;
      }
      setRenamingNode(null);
      setInputValue('');
    } catch (error) {
      console.error(
        'Failed to rename file explorer node',
        resolveFileExplorerErrorCategory(error),
      );
      if (mutationGenerationRef.current !== mutationGeneration) {
        return;
      }
      addToast(
        isFileExplorerNameConflictError(error)
          ? t('code.fileNameConflict')
          : t('code.failedToRenameNode'),
        'error',
      );
    } finally {
      if (mutationGenerationRef.current === mutationGeneration) {
        setIsMutationPending(false);
      }
    }
  }, [
    addToast,
    creatingNode,
    ensureFolderExpanded,
    files,
    inputValue,
    isMutationPending,
    onCreateFile,
    onCreateFolder,
    onRenameNode,
    renamingNode,
    t,
  ]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleInputSubmit();
    } else if (e.key === 'Escape') {
      if (isMutationPending) {
        return;
      }
      setCreatingNode(null);
      setRenamingNode(null);
      setInputValue('');
    }
  }, [handleInputSubmit, isMutationPending]);

  const handleInputBlur = useCallback(() => {
    if (isMutationPending) {
      return;
    }
    setCreatingNode(null);
    setRenamingNode(null);
    setInputValue('');
  }, [isMutationPending]);

  const visibleRows = useMemo(
    () =>
      buildVisibleFileExplorerRows({
        creatingNode,
        expandedFolders: currentExpandedFolders,
        files: filteredFiles,
      }),
    [creatingNode, currentExpandedFolders, filteredFiles],
  );
  const navigableRows = useMemo(
    () => visibleRows.flatMap((row, rowIndex) => (
      row.kind === 'node'
        ? [{ depth: row.depth, node: row.node, rowIndex }]
        : []
    )),
    [visibleRows],
  );
  const currentTabStopPath = useMemo(() => {
    if (navigableRows.some((row) => row.node.path === focusedNodePath)) {
      return focusedNodePath;
    }
    if (selectedFile && navigableRows.some((row) => row.node.path === selectedFile)) {
      return selectedFile;
    }
    return navigableRows[0]?.node.path ?? '';
  }, [focusedNodePath, navigableRows, selectedFile]);

  const handleNodeFocus = useCallback((path: string) => {
    setFocusedNodePath(path);
  }, []);

  const focusTreeRow = useCallback((row: typeof navigableRows[number]) => {
    setFocusedNodePath(row.node.path);
    pendingTreeFocusPathRef.current = row.node.path;
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const mountedRow = Array.from(
      scrollContainer.querySelectorAll<HTMLElement>('[data-file-explorer-path]'),
    ).find((element) => element.dataset.fileExplorerPath === row.node.path);
    if (mountedRow) {
      pendingTreeFocusPathRef.current = '';
      mountedRow.focus();
      return;
    }

    const rowTop = row.rowIndex * FILE_EXPLORER_ROW_HEIGHT;
    const rowBottom = rowTop + FILE_EXPLORER_ROW_HEIGHT;
    const viewportBottom = scrollContainer.scrollTop + scrollContainer.clientHeight;
    const nextScrollTop = rowTop < scrollContainer.scrollTop
      ? rowTop
      : rowBottom > viewportBottom
        ? Math.max(0, rowBottom - scrollContainer.clientHeight)
        : scrollContainer.scrollTop;
    scrollContainer.scrollTop = nextScrollTop;
    setViewport({
      clientHeight: scrollContainer.clientHeight,
      scrollTop: nextScrollTop,
    });
  }, []);

  const handleNodeKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLDivElement>,
    node: FileNode,
    isExpanded: boolean,
    depth: number,
  ) => {
    if (event.currentTarget !== event.target) return;
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      openNodeContextMenu(node, bounds.left + 20, bounds.bottom);
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      handleRequestDeleteNode(node);
      return;
    }
    if (event.key === 'F2') {
      event.preventDefault();
      handleBeginRenameNode(node);
      return;
    }
    const currentIndex = navigableRows.findIndex((row) => row.node.path === node.path);
    if (currentIndex < 0) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNodePrimaryAction(node, isExpanded);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const targetRow = event.key === 'Home' ? navigableRows[0] : navigableRows.at(-1);
      if (targetRow) focusTreeRow(targetRow);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      const targetRow = navigableRows[currentIndex + offset];
      if (targetRow) focusTreeRow(targetRow);
      return;
    }
    if (event.key === 'ArrowRight' && node.type === 'directory') {
      event.preventDefault();
      if (!isExpanded) {
        handleNodePrimaryAction(node, false);
        return;
      }
      const childRow = navigableRows[currentIndex + 1];
      if (childRow && childRow.depth > depth) focusTreeRow(childRow);
      return;
    }
    if (event.key !== 'ArrowLeft') return;
    event.preventDefault();
    if (node.type === 'directory' && isExpanded) {
      handleNodePrimaryAction(node, true);
      return;
    }
    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      const parentRow = navigableRows[index]!;
      if (parentRow.depth === depth - 1) {
        focusTreeRow(parentRow);
        return;
      }
    }
  }, [
    focusTreeRow,
    handleBeginRenameNode,
    handleNodePrimaryAction,
    handleRequestDeleteNode,
    navigableRows,
    openNodeContextMenu,
  ]);
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
    const pendingPath = pendingTreeFocusPathRef.current;
    if (!pendingPath || !isActive) return;
    const animationFrameId = window.requestAnimationFrame(() => {
      const scrollContainer = scrollContainerRef.current;
      const mountedRow = scrollContainer
        ? Array.from(
            scrollContainer.querySelectorAll<HTMLElement>('[data-file-explorer-path]'),
          ).find((element) => element.dataset.fileExplorerPath === pendingPath)
        : null;
      if (mountedRow) {
        pendingTreeFocusPathRef.current = '';
        mountedRow.focus();
      }
    });
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isActive, virtualizedRows.visibleRows]);

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

    if (isLoading && files.length === 0 && !searchQuery) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-gray-500">
          <Loader2 size={18} className="animate-spin text-gray-400" aria-hidden="true" />
          <p className="text-sm text-gray-400">{t('code.loadingProjectFiles')}</p>
        </div>
      );
    }

    if (hasLoadError && files.length === 0 && !searchQuery) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-gray-500">
          <AlertCircle size={20} className="text-red-400" aria-hidden="true" />
          <p className="text-sm text-gray-300">{t('code.projectFilesLoadFailed')}</p>
          {onRetryLoad ? (
            <button
              type="button"
              className="flex items-center gap-2 rounded border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              onClick={() => void onRetryLoad()}
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>{t('code.retryLoadingProjectFiles')}</span>
            </button>
          ) : null}
        </div>
      );
    }

    if (isSearchPending && isSearchActive) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4 text-center gap-3">
          <Loader2 size={18} className="text-gray-400 animate-spin" />
          <p className="text-sm text-gray-400">{t('code.searchingFiles')}</p>
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
                readOnly={isMutationPending}
                type={row.type}
                inputValue={inputValue}
                onChange={handleInputValueChange}
                onKeyDown={handleInputKeyDown}
                onBlur={handleInputBlur}
                placeholder={
                  row.type === 'directory'
                    ? t('code.newDirectoryPlaceholder')
                    : t('code.newFilePlaceholder')
                }
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
                isFocused={currentTabStopPath === row.node.path}
                hasDirectoryLoadError={directoryLoadErrors[row.node.path] === true}
                isExpanded={currentExpandedFolders[row.node.path] === true}
                isMutationPending={isMutationPending}
                isSelected={selectedFile === row.node.path}
                renamingNode={renamingNode}
                onNodePrimaryAction={handleNodePrimaryAction}
                onNodeFocus={handleNodeFocus}
                onNodeKeyDown={handleNodeKeyDown}
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
            <p className="text-sm text-gray-400">{t('code.noFilesMatch', { query: searchQuery })}</p>
            <button
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              onClick={() => setSearchQuery('')}
            >
              {t('code.clearSearch')}
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
              <Folder size={20} className="text-gray-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-300 font-medium">{t('code.projectEmpty')}</p>
              <p className="text-xs text-gray-500">{t('code.createFileToGetStarted')}</p>
            </div>
            <button
              className="mt-2 flex items-center gap-2 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-4 py-2 rounded-md transition-colors border border-blue-500/20"
              onClick={() => startCreatingRootNode('file')}
            >
              <Plus size={14} />
              <span>{t('code.createFile')}</span>
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
    handleNodeFocus,
    handleNodeKeyDown,
    handleRequestDeleteNode,
    hasLoadError,
    inputValue,
    isMutationPending,
    isLoading,
    currentExpandedFolders,
    currentTabStopPath,
    isSearchPending,
    loadingDirectoryPaths,
    directoryLoadErrors,
    isSearchActive,
    onRetryLoad,
    renamingNode,
    searchQuery,
    selectedFile,
    startCreatingRootNode,
    isActive,
    visibleRows,
    virtualizedRows.paddingBottom,
    virtualizedRows.paddingTop,
    virtualizedRows.visibleRows,
    files.length,
    t,
  ]);

  return (
    <div
      className="flex flex-col h-full bg-[#0e0e11] border-r border-white/5 shrink-0"
      style={{ width }}
    >
      <div className="flex flex-col shrink-0">
        <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <span>{t('code.explorer')}</span>
          <div className="flex gap-1">
            <button
              type="button"
              title={t('code.newFile')}
              aria-label={t('code.createFile')}
              className="rounded p-1 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              onClick={() => startCreatingRootNode('file')}
            >
              <FilePlus 
                size={14}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              title={t('code.newFolder')}
              aria-label={t('code.createFolder')}
              className="rounded p-1 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              onClick={() => startCreatingRootNode('directory')}
            >
              <FolderPlus 
                size={14}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              title={t('code.collapseAllFolders')}
              aria-label={t('code.collapseAllFolders')}
              className="rounded p-1 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              onClick={handleCollapseAllFolders}
            >
              <ListCollapse 
                size={14}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              title={t('code.searchFilesAction')}
              aria-label={isSearchVisible ? t('code.closeFileSearch') : t('code.searchFilesAction')}
              aria-pressed={isSearchVisible}
              className={`rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${isSearchVisible ? 'text-white' : 'hover:text-white'}`}
              onClick={handleToggleSearch}
            >
              <Search 
                size={14}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
        {isSearchVisible && (
          <div className="px-3 pb-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('code.searchFilesAction')}
                placeholder={t('code.searchFiles')}
                className="w-full rounded border border-white/10 bg-[#0e0e11] py-1 pl-2 pr-7 text-xs text-gray-200 focus:border-blue-500/50 focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label={t('code.clearSearch')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div 
        ref={scrollContainerRef}
        role="tree"
        aria-label={t('code.projectFilesLabel')}
        className="flex-1 overflow-y-auto py-2 custom-scrollbar"
        onContextMenu={handleRootContextMenu}
      >
        {fileTreeContent}
      </div>

      {rootContextMenu && (
        <div
          ref={floatingMenuRef}
          role="menu"
          aria-label={t('code.explorerActions')}
          className="fixed max-h-[calc(100vh_-_16px)] w-[min(14rem,calc(100vw_-_16px))] overflow-y-auto rounded-lg border border-white/10 bg-[#18181b]/95 py-1.5 text-[13px] text-gray-300 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 origin-top-left"
          style={{ top: rootContextMenu.y, left: rootContextMenu.x, zIndex: FILE_EXPLORER_CONTEXT_MENU_Z_INDEX }}
          onClick={(e) => e.stopPropagation()}
          onBlur={handleFloatingMenuBlur}
          onKeyDown={handleFloatingMenuKeyDown}
        >
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
            onClick={() => {
              startCreatingRootNode('file');
              setRootContextMenu(null);
            }}
          >
            <FilePlus size={14} className="text-gray-400" aria-hidden="true" />
            <span>{t('code.newFile')}</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
            onClick={() => {
              startCreatingRootNode('directory');
              setRootContextMenu(null);
            }}
          >
            <FolderPlus size={14} className="text-gray-400" aria-hidden="true" />
            <span>{t('code.newFolder')}</span>
          </button>
          <div role="separator" className="my-1.5 h-px bg-white/10" />
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
            onClick={() => {
              const target = resolveProjectMountTarget();
              if (!target || !emitOpenProjectTerminal(target)) {
                notifyUnavailableLocalFolder();
                setRootContextMenu(null);
                return;
              }
              setRootContextMenu(null);
            }}
          >
            <Terminal size={14} className="text-gray-400" aria-hidden="true" />
            <span>{t('code.openInTerminal')}</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
            onClick={() => {
              const target = resolveProjectMountTarget();
              if (!target || !emitRevealProjectInFileManager(target)) {
                notifyUnavailableLocalFolder();
                setRootContextMenu(null);
                return;
              }
              setRootContextMenu(null);
            }}
          >
            <ExternalLink size={14} className="text-gray-400" aria-hidden="true" />
            <span>{t('code.openInFileExplorer')}</span>
          </button>
        </div>
      )}

      {contextMenu && (
        <div
          ref={floatingMenuRef}
          role="menu"
          aria-label={t('code.nodeActions', { name: contextMenu.node.name })}
          className="fixed max-h-[calc(100vh_-_16px)] w-[min(14rem,calc(100vw_-_16px))] overflow-y-auto rounded-lg border border-white/10 bg-[#18181b]/95 py-1.5 text-[13px] text-gray-300 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 origin-top-left"
          style={{ top: contextMenu.y, left: contextMenu.x, zIndex: FILE_EXPLORER_CONTEXT_MENU_Z_INDEX }}
          onClick={(e) => e.stopPropagation()}
          onBlur={handleFloatingMenuBlur}
          onKeyDown={handleFloatingMenuKeyDown}
        >
          {contextMenu.node.type === 'directory' && (
            <>
              <button
                type="button"
                tabIndex={-1}
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
                onClick={() => {
                  handleBeginCreateNode(
                    contextMenu.node.path,
                    'file',
                    contextMenu.node.children === undefined,
                  );
                  setContextMenu(null);
                }}
              >
                <FilePlus size={14} className="text-gray-400" aria-hidden="true" />
                <span>{t('code.newFile')}</span>
              </button>
              <button
                type="button"
                tabIndex={-1}
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
                onClick={() => {
                  handleBeginCreateNode(
                    contextMenu.node.path,
                    'directory',
                    contextMenu.node.children === undefined,
                  );
                  setContextMenu(null);
                }}
              >
                <FolderPlus size={14} className="text-gray-400" aria-hidden="true" />
                <span>{t('code.newFolder')}</span>
              </button>
              <div role="separator" className="my-1.5 h-px bg-white/10" />
            </>
          )}
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
            onClick={() => {
              void copyTextToClipboard(contextMenu.node.path).then((didCopy) => {
                if (!didCopy) {
                  addToast(t('code.unableToCopyRelativePath'), 'error');
                  return;
                }
                addToast(t('code.copiedRelativePath'), 'success');
              });
              setContextMenu(null);
            }}
          >
            <Copy size={14} className="text-gray-400" aria-hidden="true" />
            <span>{t('code.copyRelativePath')}</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
            onClick={() => {
              const target = resolveProjectMountTarget(contextMenu.node.path);
              if (!target || !emitCopyProjectLocalPath(target)) {
                notifyUnavailableLocalFolder();
                setContextMenu(null);
                return;
              }
              setContextMenu(null);
            }}
          >
            <Copy size={14} className="text-gray-400" aria-hidden="true" />
            <span>{t('code.copyFullPath')}</span>
          </button>
          <div role="separator" className="my-1.5 h-px bg-white/10" />
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
            onClick={() => {
              handleBeginRenameNode(contextMenu.node);
              setContextMenu(null);
            }}
          >
            <FileEdit size={14} className="text-gray-400" aria-hidden="true" />
            <span>{t('code.renameNode')}</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-red-500/80 transition-colors hover:bg-red-500/20 hover:text-red-400 focus-visible:bg-red-500/20 focus-visible:text-red-400 focus-visible:outline-none"
            onClick={() => {
              handleRequestDeleteNode(contextMenu.node);
              setContextMenu(null);
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>{t('code.deleteNode')}</span>
          </button>
          <div role="separator" className="my-1.5 h-px bg-white/10" />
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
            onClick={() => {
              const target = resolveProjectMountTarget(resolveMountedDirectoryPath(contextMenu.node));
              if (!target || !emitOpenProjectTerminal(target)) {
                notifyUnavailableLocalFolder();
                setContextMenu(null);
                return;
              }
              setContextMenu(null);
            }}
          >
            <Terminal size={14} className="text-gray-400" aria-hidden="true" />
            <span>{t('code.openInTerminal')}</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
            onClick={() => {
              const target = resolveProjectMountTarget(contextMenu.node.path);
              if (!target || !emitRevealProjectInFileManager(target)) {
                notifyUnavailableLocalFolder();
                setContextMenu(null);
                return;
              }
              setContextMenu(null);
            }}
          >
            <ExternalLink size={14} className="text-gray-400" aria-hidden="true" />
            <span>{t('code.openInFileExplorer')}</span>
          </button>
        </div>
      )}

      {nodeToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={deleteDialogTitleId}
            aria-describedby={deleteDialogDescriptionId}
            aria-busy={isMutationPending}
            className="w-[calc(100%_-_32px)] max-w-sm overflow-hidden rounded-lg border border-white/10 bg-[#18181b] shadow-2xl animate-in zoom-in-95 duration-200"
            onKeyDown={handleDeleteDialogKeyDown}
          >
            <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-[#18181b]/50">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={16} className="text-red-400" aria-hidden="true" />
              </div>
              <h3 id={deleteDialogTitleId} className="text-base font-semibold text-white">
                {nodeToDelete.type === 'directory' ? t('code.deleteFolder') : t('code.deleteFile')}
              </h3>
            </div>
            <div className="p-5">
              <p id={deleteDialogDescriptionId} className="text-sm text-gray-300">
                {t('code.deleteNodeQuestion', { name: nodeToDelete.name })}
              </p>
              {nodeToDelete.type === 'directory' && (
                <p className="text-xs text-red-400 mt-2">
                  {t('code.deleteFolderWarning')}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-white/5 bg-[#121214]">
              <button
                ref={deleteDialogCancelButtonRef}
                type="button"
                disabled={isMutationPending}
                onClick={handleCancelDeleteNode}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={isMutationPending}
                onClick={() => void handleConfirmDeleteNode()}
                className="flex min-w-[88px] items-center justify-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMutationPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                {t('code.deleteNode')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FileExplorer.displayName = 'FileExplorer';
