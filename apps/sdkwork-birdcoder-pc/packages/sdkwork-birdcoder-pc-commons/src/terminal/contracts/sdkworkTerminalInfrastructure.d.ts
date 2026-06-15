export interface DesktopTerminalSessionInventorySnapshot {
  cwd?: string | null;
  lastExitCode?: number | null;
  profileId: string;
  projectId?: string | null;
  sessionId: string;
  status: string;
  title?: string | null;
  updatedAt: string;
  workspaceId?: string | null;
}

export interface DesktopReplayEntrySnapshot {
  sequence?: number;
  kind: 'output' | 'marker' | 'state' | 'warning' | 'exit' | string;
  payload?: string;
  occurredAt?: string;
  [key: string]: unknown;
}

export interface DesktopSessionReplayRequest {
  fromCursor?: string;
  limit?: number;
}

export interface DesktopSessionReplaySnapshot {
  sessionId?: string;
  fromCursor?: string | null;
  nextCursor?: string;
  hasMore?: boolean;
  entries: DesktopReplayEntrySnapshot[];
  [key: string]: unknown;
}

export interface DesktopSessionStreamEvent {
  sessionId?: string;
  nextCursor?: string;
  entry: DesktopReplayEntrySnapshot;
  [key: string]: unknown;
}

export type RuntimeSessionReplaySnapshot = DesktopSessionReplaySnapshot;
export type RuntimeSessionStreamEvent = DesktopSessionStreamEvent;

export type TerminalViewportInput =
  | {
      kind: 'text';
      data: string;
    }
  | {
      kind: 'binary';
      data: string;
      inputBytes: number[];
    };

export interface DesktopSessionInputRequest {
  sessionId: string;
  input: string;
}

export interface DesktopSessionInputBytesRequest {
  sessionId: string;
  inputBytes: number[];
}

export interface DesktopSessionInputSnapshot {
  sessionId: string;
  acceptedBytes: number;
}

export interface DesktopSessionResizeRequest {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface DesktopSessionResizeSnapshot {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface DesktopSessionTerminateSnapshot {
  sessionId: string;
  state: string;
}

export interface DesktopSessionAttachmentAcknowledgeRequest {
  attachmentId: string;
  sequence: number;
}

export interface DesktopSessionDetachRequest {
  attachmentId: string;
}

export interface DesktopSessionAttachmentDescriptor {
  attachmentId?: string;
  [key: string]: unknown;
}

export interface DesktopLocalShellExecutionRequest {
  profile: string;
  commandText: string;
  workingDirectory?: string;
}

export interface DesktopLocalShellExecutionResult {
  profile?: string;
  commandText?: string;
  workingDirectory: string;
  invokedProgram?: string;
  exitCode: number;
  stdout: string;
  stderr?: string;
}

export interface DesktopConnectorInteractiveSessionCreateRequest {
  workspaceId?: string | null;
  target?: string;
  authority?: string;
  command?: string[];
  modeTags?: string[];
  tags?: string[];
  cols?: number;
  rows?: number;
  [key: string]: unknown;
}

export interface DesktopLocalProcessSessionCreateRequest {
  cols?: number;
  command: string[];
  profileId?: string | null;
  projectId?: string | null;
  rows?: number;
  title?: string | null;
  workingDirectory?: string;
  workspaceId?: string | null;
}

export interface DesktopLocalShellSessionCreateRequest {
  cols?: number;
  profile: 'powershell' | 'bash' | 'shell' | string;
  profileId?: string | null;
  projectId?: string | null;
  rows?: number;
  title?: string | null;
  workingDirectory?: string;
  workspaceId?: string | null;
}

export interface DesktopInteractiveSessionSnapshot {
  sessionId: string;
  attachmentId?: string | null;
  cursor?: string | null;
  workingDirectory: string;
  invokedProgram: string;
  invokedArgs?: string[];
  [key: string]: unknown;
}

export type DesktopLocalShellSessionCreateSnapshot = DesktopInteractiveSessionSnapshot;
export type DesktopLocalProcessSessionCreateSnapshot = DesktopInteractiveSessionSnapshot;
export type DesktopConnectorInteractiveSessionCreateSnapshot = DesktopInteractiveSessionSnapshot;

export type DesktopUnlisten = () => void | Promise<void>;

export interface DesktopRuntimeBridgeClient {
  sessionReplay: (
    sessionId: string,
    request?: DesktopSessionReplayRequest,
  ) => Promise<DesktopSessionReplaySnapshot>;
  executeLocalShellCommand: (
    request: DesktopLocalShellExecutionRequest,
  ) => Promise<DesktopLocalShellExecutionResult>;
  createConnectorInteractiveSession: (
    request: DesktopConnectorInteractiveSessionCreateRequest,
  ) => Promise<DesktopConnectorInteractiveSessionCreateSnapshot>;
  createLocalProcessSession: (
    request: DesktopLocalProcessSessionCreateRequest,
  ) => Promise<DesktopLocalProcessSessionCreateSnapshot>;
  createLocalShellSession: (
    request: DesktopLocalShellSessionCreateRequest,
  ) => Promise<DesktopLocalShellSessionCreateSnapshot>;
  writeSessionInput: (
    request: DesktopSessionInputRequest,
  ) => Promise<DesktopSessionInputSnapshot>;
  writeSessionInputBytes: (
    request: DesktopSessionInputBytesRequest,
  ) => Promise<DesktopSessionInputSnapshot>;
  resizeSession: (
    request: DesktopSessionResizeRequest,
  ) => Promise<DesktopSessionResizeSnapshot>;
  terminateSession: (
    sessionId: string,
  ) => Promise<DesktopSessionTerminateSnapshot>;
  acknowledgeSessionAttachment?: (
    request: DesktopSessionAttachmentAcknowledgeRequest,
  ) => Promise<DesktopSessionAttachmentDescriptor>;
  detachSessionAttachment?: (
    request: DesktopSessionDetachRequest,
  ) => Promise<unknown>;
  subscribeLocalShellSessionEvents?: (
    sessionId: string,
    listener: (event: DesktopSessionStreamEvent) => void,
  ) => Promise<DesktopUnlisten>;
  subscribeSessionEvents?: (
    sessionId: string,
    listener: (event: DesktopSessionStreamEvent) => void,
  ) => Promise<DesktopUnlisten>;
  terminalSessionInventory: () => Promise<DesktopTerminalSessionInventorySnapshot[]>;
  [key: string]: unknown;
}

export function createDesktopRuntimeBridgeClient(
  invoke: (...args: any[]) => Promise<unknown>,
): DesktopRuntimeBridgeClient;

export interface TerminalViewAdapter {
  kind: 'terminal-view-adapter';
  copySelection: () => string;
  getSnapshot: () => unknown;
  resize: (viewport: { cols: number; rows: number }) => unknown;
  search: (query: string) => unknown;
  select: (selection: unknown) => unknown;
  writeInput: (input: string) => unknown;
  writeOutput: (chunk: string) => unknown;
}

export function createTerminalViewAdapter(
  options?: unknown,
): TerminalViewAdapter;
