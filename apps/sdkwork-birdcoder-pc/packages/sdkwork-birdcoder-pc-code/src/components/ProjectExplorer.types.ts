import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface ProjectSessionLoadMoreResult {
  hasMore?: boolean;
  loadedCount?: number;
}

export interface ProjectExplorerProps {
  hasMoreProjects?: boolean;
  isLoadingMoreProjects?: boolean;
  isVisible?: boolean;
  projects: AgentProjectView[];
  selectedProjectId?: string | null;
  selectedAgentSessionId: string | null;
  onSelectProject?: (id: string | null) => void;
  onSelectAgentSession: (id: string | null, projectId?: string | null) => void;
  onRenameAgentSession: (id: string, projectId: string, newName?: string) => void;
  onDeleteAgentSession: (id: string, projectId: string) => void;
  onRenameProject: (id: string, newName?: string) => void;
  onDeleteProject: (id: string) => void;
  onNewProject: () => Promise<string | undefined>;
  onLoadMoreProjects?: () => Promise<unknown> | void;
  onLoadMoreProjectSessions?: (
    projectId: string,
    requestedCount: number,
  ) => Promise<ProjectSessionLoadMoreResult> | ProjectSessionLoadMoreResult | void;
  onOpenFolder?: () => void;
  onNewAgentSessionInProject: (projectId: string, engineId?: string, modelId?: string) => void;
  onRefreshProjectSessions?: (id: string) => Promise<void> | void;
  onRefreshAgentSessionItems?: (id: string) => Promise<void> | void;
  onArchiveProject?: (id: string) => void;
  onCopyWorkingDirectory?: (id: string) => void;
  onCopyProjectPath?: (id: string) => void;
  onOpenInTerminal?: (id: string, profileId?: string) => void;
  onOpenInFileExplorer?: (id: string) => void;
  onPinAgentSession?: (id: string, projectId: string) => void;
  onArchiveAgentSession?: (id: string, projectId: string) => void;
  onMarkAgentSessionUnread?: (id: string, projectId: string) => void;
  onCopyAgentSessionWorkingDirectory?: (id: string, projectId: string) => void;
  onCopyAgentSessionSessionId?: (id: string, projectId: string) => void;
  onCopyAgentSessionDeeplink?: (id: string, projectId: string) => void;
  onForkAgentSessionLocal?: (id: string, projectId: string) => void;
  onForkAgentSessionNewTree?: (id: string, projectId: string) => void;
  refreshingProjectId?: string | null;
  refreshingAgentSessionId?: string | null;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  width?: number;
}
