import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-types';

export interface ProjectSessionLoadMoreResult {
  hasMore?: boolean;
  loadedCount?: number;
}

export interface ProjectExplorerProps {
  hasMoreProjects?: boolean;
  isLoadingMoreProjects?: boolean;
  isVisible?: boolean;
  projects: BirdCoderProject[];
  selectedProjectId?: string | null;
  selectedCodingSessionId: string | null;
  onSelectProject?: (id: string | null) => void;
  onSelectCodingSession: (id: string | null, projectId?: string | null) => void;
  onRenameCodingSession: (id: string, projectId: string, newName?: string) => void;
  onDeleteCodingSession: (id: string, projectId: string) => void;
  onRenameProject: (id: string, newName?: string) => void;
  onDeleteProject: (id: string) => void;
  onNewProject: () => Promise<string | undefined>;
  onLoadMoreProjects?: () => Promise<unknown> | void;
  onLoadMoreProjectSessions?: (
    projectId: string,
    requestedCount: number,
  ) => Promise<ProjectSessionLoadMoreResult> | ProjectSessionLoadMoreResult | void;
  onOpenFolder?: () => void;
  onNewCodingSessionInProject: (projectId: string, engineId?: string, modelId?: string) => void;
  onRefreshProjectSessions?: (id: string) => Promise<void> | void;
  onRefreshCodingSessionMessages?: (id: string) => Promise<void> | void;
  onArchiveProject?: (id: string) => void;
  onCopyWorkingDirectory?: (id: string) => void;
  onCopyProjectPath?: (id: string) => void;
  onOpenInTerminal?: (id: string, profileId?: string) => void;
  onOpenInFileExplorer?: (id: string) => void;
  onPinCodingSession?: (id: string, projectId: string) => void;
  onArchiveCodingSession?: (id: string, projectId: string) => void;
  onMarkCodingSessionUnread?: (id: string, projectId: string) => void;
  onOpenCodingSessionInTerminal?: (
    id: string,
    projectId: string,
    nativeSessionId?: string,
  ) => void;
  onCopyCodingSessionWorkingDirectory?: (id: string, projectId: string) => void;
  onCopyCodingSessionSessionId?: (
    id: string,
    projectId: string,
    nativeSessionId?: string,
  ) => void;
  onCopyCodingSessionResumeCommand?: (
    id: string,
    projectId: string,
    nativeSessionId?: string,
  ) => void;
  onCopyCodingSessionDeeplink?: (id: string, projectId: string) => void;
  onForkCodingSessionLocal?: (id: string, projectId: string) => void;
  onForkCodingSessionNewTree?: (id: string, projectId: string) => void;
  refreshingProjectId?: string | null;
  refreshingCodingSessionId?: string | null;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  width?: number;
}
