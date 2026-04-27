import type { BirdCoderProject } from '@sdkwork/birdcoder-types';

export interface ProjectExplorerProps {
  isVisible?: boolean;
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
  onNewCodingSessionInProject: (projectId: string, engineId?: string) => void;
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
  onOpenCodingSessionInTerminal?: (id: string, nativeSessionId?: string) => void;
  onCopyCodingSessionWorkingDirectory?: (id: string) => void;
  onCopyCodingSessionSessionId?: (id: string, nativeSessionId?: string) => void;
  onCopyCodingSessionDeeplink?: (id: string) => void;
  onForkCodingSessionLocal?: (id: string) => void;
  onForkCodingSessionNewTree?: (id: string) => void;
  refreshingProjectId?: string | null;
  refreshingCodingSessionId?: string | null;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  width?: number;
}
