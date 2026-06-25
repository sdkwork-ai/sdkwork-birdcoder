import type {
  BirdCoderWorkspaceRealtimeEvent,
  BirdCoderWorkspaceRealtimeMessage,
} from '@sdkwork/birdcoder-pc-types';
import { parseBirdCoderApiJson } from './apiJson.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { readRuntimeServerSessionId } from './runtimeServerSession.ts';

export interface BirdCoderWorkspaceRealtimeSubscription {
  close(): void;
}

export interface SubscribeBirdCoderWorkspaceRealtimeOptions {
  maxReconnectAttempts?: number;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onEvent: (event: BirdCoderWorkspaceRealtimeEvent) => void;
  onOpen?: () => void;
  onReady?: (message: Extract<BirdCoderWorkspaceRealtimeMessage, { kind: 'ready' }>) => void;
  reconnectDelayMs?: number;
  workspaceId: string;
}

type BirdCoderWebSocketFactory = (url: string) => WebSocket;

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 8;
const DEFAULT_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeRealtimeBaseUrl(value: string | null | undefined): string | null {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return null;
  }

  try {
    new URL(normalizedValue);
    return normalizedValue;
  } catch {
    return null;
  }
}

function resolveWebSocketFactory(): BirdCoderWebSocketFactory | null {
  if (typeof WebSocket !== 'function') {
    return null;
  }

  return (url) => new WebSocket(url);
}

export function resolveBirdCoderWorkspaceRealtimeUrl(
  baseUrl: string,
  workspaceId: string,
  sessionId: string,
): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const normalizedBasePath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/u, '');
  url.pathname =
    `${normalizedBasePath}/app/v3/api/workspaces/${encodeURIComponent(workspaceId)}/realtime`;
  url.searchParams.set('sessionId', sessionId);
  return url.toString();
}

function isRealtimeMessage(value: unknown): value is BirdCoderWorkspaceRealtimeMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.kind === 'ready' &&
      typeof record.workspaceId === 'string' &&
      typeof record.userId === 'string' &&
      typeof record.connectedAt === 'string') ||
    (record.kind === 'event' &&
      !!record.event &&
      typeof record.event === 'object' &&
      typeof (record.event as Record<string, unknown>).eventId === 'string')
  );
}

export function canSubscribeBirdCoderWorkspaceRealtime(): boolean {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  return Boolean(
    resolveWebSocketFactory() &&
      normalizeRealtimeBaseUrl(runtimeConfig.apiBaseUrl) &&
      normalizeText(readRuntimeServerSessionId()),
  );
}

export function subscribeBirdCoderWorkspaceRealtime(
  options: SubscribeBirdCoderWorkspaceRealtimeOptions,
): BirdCoderWorkspaceRealtimeSubscription | null {
  const workspaceId = normalizeText(options.workspaceId);
  if (!workspaceId) {
    return null;
  }

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const baseUrl = normalizeRealtimeBaseUrl(runtimeConfig.apiBaseUrl);
  const sessionId = normalizeText(readRuntimeServerSessionId());
  const createWebSocket = resolveWebSocketFactory();
  if (!baseUrl || !sessionId || !createWebSocket) {
    return null;
  }

  const maxAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
  const baseDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  let closed = false;
  let reconnectAttempts = 0;
  let activeSocket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const clearReconnectTimer = () => {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  };

  const closeActiveSocket = () => {
    if (!activeSocket) {
      return;
    }

    if (activeSocket.readyState === WebSocket.CLOSING || activeSocket.readyState === WebSocket.CLOSED) {
      activeSocket = null;
      return;
    }

    activeSocket.close();
    activeSocket = null;
  };

  const scheduleReconnect = () => {
    if (closed) {
      return;
    }

    reconnectAttempts += 1;
    if (reconnectAttempts > maxAttempts) {
      options.onClose?.();
      return;
    }

    const delayMs = Math.min(baseDelayMs * 2 ** (reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS);
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, delayMs);
  };

  const connect = () => {
    if (closed) {
      return;
    }

    closeActiveSocket();
    const socket = createWebSocket(
      resolveBirdCoderWorkspaceRealtimeUrl(baseUrl, workspaceId, sessionId),
    );
    activeSocket = socket;

    socket.addEventListener('open', () => {
      reconnectAttempts = 0;
      options.onOpen?.();
    });
    socket.addEventListener('close', () => {
      if (closed) {
        options.onClose?.();
        return;
      }

      if (activeSocket === socket) {
        activeSocket = null;
      }
      scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      options.onError?.(new Error(`Workspace realtime channel failed for ${workspaceId}.`));
    });
    socket.addEventListener('message', (event) => {
      try {
        const parsedMessage = parseBirdCoderApiJson(String(event.data)) as unknown;
        if (!isRealtimeMessage(parsedMessage)) {
          return;
        }

        if (parsedMessage.kind === 'ready') {
          options.onReady?.(parsedMessage);
          return;
        }

        options.onEvent(parsedMessage.event);
      } catch (error) {
        options.onError?.(
          error instanceof Error
            ? error
            : new Error(`Workspace realtime payload parse failed for ${workspaceId}.`),
        );
      }
    });
  };

  connect();

  return {
    close() {
      closed = true;
      clearReconnectTimer();
      closeActiveSocket();
    },
  };
}
