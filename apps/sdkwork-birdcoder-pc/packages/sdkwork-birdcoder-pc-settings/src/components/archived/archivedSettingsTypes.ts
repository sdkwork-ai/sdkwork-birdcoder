export type ArchivedSessionStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type ArchivedTaskTypeFilter = 'all' | 'local' | 'cloud';
export type ArchivedTaskSort = 'updated' | 'created' | 'name';

export interface ArchivedSessionView {
  createdAt: string;
  id: string;
  projectId: string;
  taskType: Exclude<ArchivedTaskTypeFilter, 'all'>;
  status: ArchivedSessionStatus;
  title: string;
  updatedAt: string;
}

export interface ArchivedProjectGroupView {
  projectId: string;
  projectName: string;
  sessions: ArchivedSessionView[];
  workspaceId: string;
}

export interface ArchivedWorkspaceOption {
  id: string;
  name: string;
}

export interface ArchivedProjectOption {
  id: string;
  name: string;
}
