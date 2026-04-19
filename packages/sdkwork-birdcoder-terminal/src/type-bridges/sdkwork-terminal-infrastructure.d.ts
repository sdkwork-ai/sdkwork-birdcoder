export interface DesktopLocalShellSessionCreateRequest {
  profile: string;
  workingDirectory?: string;
  cols?: number;
  rows?: number;
}

export interface DesktopLocalProcessSessionCreateRequest {
  command: string[];
  workingDirectory?: string;
  cols?: number;
  rows?: number;
}

export interface DesktopSessionCreateSnapshot {
  sessionId: string;
  attachmentId: string;
  cursor: string;
  [key: string]: unknown;
}

export interface DesktopSessionReplayRequest {
  fromCursor?: string;
  limit?: number;
}

export interface DesktopSessionStreamEvent {
  sessionId: string;
  eventType?: string;
  [key: string]: unknown;
}

export interface DesktopSessionInputRequest {
  [key: string]: unknown;
}

export interface DesktopSessionInputBytesRequest {
  [key: string]: unknown;
}

export interface DesktopSessionResizeRequest {
  [key: string]: unknown;
}

export interface DesktopSessionDetachRequest {
  [key: string]: unknown;
}

export interface DesktopSessionAttachmentAcknowledgeRequest {
  [key: string]: unknown;
}

export interface DesktopConnectorInteractiveSessionCreateRequest {
  [key: string]: unknown;
}

export interface DesktopUnlisten {
  (): void | Promise<void>;
}

export interface DesktopInvoke {
  <T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

export interface DesktopListenEvent<TPayload> {
  payload: TPayload;
}

export interface DesktopListen {
  <TPayload>(
    eventName: string,
    listener: (event: DesktopListenEvent<TPayload>) => void,
  ): Promise<DesktopUnlisten>;
}

export interface DesktopRuntimeBridgeClient {
  detachSessionAttachment: (
    request: DesktopSessionDetachRequest,
  ) => Promise<Record<string, unknown>>;
  createConnectorInteractiveSession: (
    request: DesktopConnectorInteractiveSessionCreateRequest,
  ) => Promise<Record<string, unknown>>;
  executeLocalShellCommand: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
  createLocalProcessSession: (
    request: DesktopLocalProcessSessionCreateRequest,
  ) => Promise<DesktopSessionCreateSnapshot>;
  createLocalShellSession: (
    request: DesktopLocalShellSessionCreateRequest,
  ) => Promise<DesktopSessionCreateSnapshot>;
  writeSessionInput: (
    request: DesktopSessionInputRequest,
  ) => Promise<Record<string, unknown>>;
  writeSessionInputBytes: (
    request: DesktopSessionInputBytesRequest,
  ) => Promise<Record<string, unknown>>;
  acknowledgeSessionAttachment: (
    request: DesktopSessionAttachmentAcknowledgeRequest,
  ) => Promise<Record<string, unknown>>;
  resizeSession: (request: DesktopSessionResizeRequest) => Promise<Record<string, unknown>>;
  terminateSession: (sessionId: string) => Promise<Record<string, unknown>>;
  sessionReplay: (
    sessionId: string,
    request?: DesktopSessionReplayRequest,
  ) => Promise<Record<string, unknown>>;
  subscribeSessionEvents?: (
    sessionId: string,
    listener: (event: DesktopSessionStreamEvent) => void,
  ) => Promise<DesktopUnlisten>;
}

export declare function createDesktopRuntimeBridgeClient(
  invoke: DesktopInvoke,
  listen?: DesktopListen,
): DesktopRuntimeBridgeClient;
