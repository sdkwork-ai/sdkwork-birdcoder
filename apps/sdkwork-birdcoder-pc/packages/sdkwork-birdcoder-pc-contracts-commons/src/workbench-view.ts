import type { AgentSessionView } from './agent-session-view.ts';
import type { WorkbenchEntityId, WorkbenchLongIntegerString } from './workbench-values.ts';

export type AppTab = 'code' | 'studio' | 'multiwindow' | 'terminal' | 'settings' | 'auth' | 'user' | 'vip';
export interface User { id: WorkbenchEntityId; name: string; email: string; avatarUrl?: string }
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
export interface AgentProjectView {
  projectId: string;
  tenantId: WorkbenchEntityId;
  organizationId: WorkbenchEntityId;
  ownerUserId: WorkbenchEntityId;
  name: string;
  description?: string;
  visibility: 'private' | 'organization' | 'shared';
  status: 'active' | 'archived' | 'deleted';
  driveAccessMode: 'disabled' | 'owner_library' | 'explicit_resources';
  defaultAgentId?: string;
  defaultModelId?: string;
  version: WorkbenchLongIntegerString;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  agentSessions: AgentSessionView[];
}

const WORKBENCH_PROJECT_SORT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function resolveWorkbenchProjectActivity(project: AgentProjectView): number {
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
  left: AgentProjectView,
  right: AgentProjectView,
): number {
  return resolveWorkbenchProjectActivity(right) - resolveWorkbenchProjectActivity(left) ||
    WORKBENCH_PROJECT_SORT_COLLATOR.compare(left.name, right.name) ||
    WORKBENCH_PROJECT_SORT_COLLATOR.compare(left.projectId, right.projectId);
}
