import type { AgentSessionView } from './agent-session-view.ts';
import type { WorkbenchDataScope, WorkbenchEntityId, WorkbenchLongIntegerString } from './workbench-values.ts';

export type AppTab = 'code' | 'studio' | 'multiwindow' | 'terminal' | 'settings' | 'auth' | 'user' | 'vip';
export interface User { id: WorkbenchEntityId; name: string; email: string; avatarUrl?: string }
export interface IWorkspace {
  id: WorkbenchEntityId; uuid?: string; tenantId?: WorkbenchEntityId;
  organizationId?: WorkbenchEntityId; dataScope?: WorkbenchDataScope; code?: string;
  title?: string; name: string; description?: string; icon?: string; color?: string;
  ownerId?: WorkbenchEntityId; leaderId?: WorkbenchEntityId;
  createdByUserId?: WorkbenchEntityId; type?: string; status?: 'active' | 'archived';
  startTime?: string; endTime?: string; maxMembers?: number; currentMembers?: number;
  memberCount?: number; maxStorage?: WorkbenchLongIntegerString;
  usedStorage?: WorkbenchLongIntegerString; settings?: Record<string, unknown>;
  isPublic?: boolean; isTemplate?: boolean; viewerRole?: 'owner' | 'admin' | 'member' | 'viewer';
}
export interface IFileNode { name: string; type: 'file' | 'directory'; path: string; children?: IFileNode[] }
export interface ProjectFileSystemChangeEvent { kind: 'create' | 'modify' | 'remove' | 'rename' | 'other'; paths: string[] }
export interface FileRevisionLookupResult { path: string; revision: string | null; missing: boolean; error?: string }
export interface BrowserLocalFolderMountSource { type: 'browser'; handle: FileSystemDirectoryHandle; path?: never }
export interface TauriLocalFolderMountSource { type: 'tauri'; path: string; handle?: never }
export type LocalFolderMountSource = BrowserLocalFolderMountSource | TauriLocalFolderMountSource;
export type ProjectDeviceMountStatus = 'mounted' | 'recoverable' | 'permission_required' | 'mount_required' | 'session_required';
export interface ProjectDeviceMountState { displayName: string | null; host: LocalFolderMountSource['type'] | 'server' | null; status: ProjectDeviceMountStatus }
export interface ProjectDeviceMountRecoveryResult { restored: boolean; state: ProjectDeviceMountState }
export type LocalFolderPickerResult =
  | { status: 'selected'; source: LocalFolderMountSource }
  | { status: 'cancelled' }
  | { status: 'unsupported'; capability: 'local_folder_picker'; code: 'browser_file_system_access_unavailable'; message: string };
export interface BirdCoderProject {
  id: WorkbenchEntityId; uuid?: string; tenantId?: WorkbenchEntityId; organizationId?: WorkbenchEntityId;
  defaultAgentProjectId: string;
  dataScope?: WorkbenchDataScope; workspaceId: WorkbenchEntityId; workspaceUuid?: string;
  userId?: WorkbenchEntityId; parentId?: WorkbenchEntityId; parentUuid?: string;
  parentMetadata?: Record<string, unknown>; code?: string; title?: string; name: string;
  description?: string; domainPrefix?: string; ownerId?: WorkbenchEntityId;
  leaderId?: WorkbenchEntityId; createdByUserId?: WorkbenchEntityId; author?: string;
  fileId?: WorkbenchEntityId; type?: string;
  coverImage?: Record<string, unknown>; startTime?: string; endTime?: string;
  budgetAmount?: WorkbenchLongIntegerString; isTemplate?: boolean;
  viewerRole?: 'owner' | 'admin' | 'member' | 'viewer'; createdAt: string; updatedAt: string;
  agentSessions: AgentSessionView[]; archived?: boolean;
}

const WORKBENCH_PROJECT_SORT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function resolveWorkbenchProjectActivity(project: BirdCoderProject): number {
  return Math.max(
    Date.parse(project.updatedAt) || 0,
    Date.parse(project.createdAt) || 0,
    ...project.agentSessions.map((session) =>
      Math.max(
        Number(session.sortTimestamp) || 0,
        Date.parse(session.lastTurnAt ?? '') || 0,
        Date.parse(session.updatedAt) || 0,
      ),
    ),
  );
}

export function compareWorkbenchProjectsByActivity(
  left: BirdCoderProject,
  right: BirdCoderProject,
): number {
  return resolveWorkbenchProjectActivity(right) - resolveWorkbenchProjectActivity(left) ||
    WORKBENCH_PROJECT_SORT_COLLATOR.compare(left.name || left.title || '', right.name || right.title || '') ||
    WORKBENCH_PROJECT_SORT_COLLATOR.compare(left.id, right.id);
}
