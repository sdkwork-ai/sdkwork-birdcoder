import type {
  BirdCoderCodingSessionMessage as BirdCoderRuntimeCodingSessionMessage,
  BirdCoderCodingSessionSummary,
} from './coding-session.ts';

declare global {
  interface Window {
    __TAURI__?: any;
  }
}

export type AppTab =
  | 'code'
  | 'studio'
  | 'terminal'
  | 'settings'
  | 'auth'
  | 'user'
  | 'vip'
  | 'skills'
  | 'templates';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface IWorkspace {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  icon?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  type?: string;
  viewerRole?: 'owner' | 'admin' | 'member' | 'viewer';
}

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  content?: string;
  originalContent?: string;
}

export interface CommandExecution {
  command: string;
  status: 'running' | 'success' | 'error';
  output?: string;
}

export interface TaskProgress {
  total: number;
  completed: number;
}

export interface BirdCoderChatMessage extends BirdCoderRuntimeCodingSessionMessage {
  timestamp?: number;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  fileChanges?: FileChange[];
  commands?: CommandExecution[];
  taskProgress?: TaskProgress;
}

export interface BirdCoderCodingSession extends BirdCoderCodingSessionSummary {
  displayTime: string;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
  messages: BirdCoderChatMessage[];
}

export interface IFileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: IFileNode[];
}

export interface BrowserLocalFolderMountSource {
  type: 'browser';
  handle: FileSystemDirectoryHandle;
  path?: never;
}

export interface TauriLocalFolderMountSource {
  type: 'tauri';
  path: string;
  handle?: never;
}

export type LocalFolderMountSource =
  | BrowserLocalFolderMountSource
  | TauriLocalFolderMountSource;

export interface BirdCoderProject {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  workspaceId: string;
  workspaceUuid?: string;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  path?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  author?: string;
  type?: string;
  viewerRole?: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: string;
  updatedAt: string;
  codingSessions: BirdCoderCodingSession[];
  archived?: boolean;
}

export interface BirdCoderTeam {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  workspaceId: string;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
}

export * from './coding-session.ts';
export * from './data.ts';
export * from './engine.ts';
export * from './engineCatalog.ts';
export * from './fileSearch.ts';
export * from './generated/coding-server-openapi.ts';
export * from './generated/coding-server-client.ts';
export * from './governance.ts';
export * from './prompt-skill-template.ts';
export * from './server-api.ts';
