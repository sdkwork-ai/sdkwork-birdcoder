import type {
  BirdCoderWorkspaceRealtimeEvent,
  BirdCoderWorkspaceRealtimeMessage,
} from '@sdkwork/birdcoder-types';
import { parseBirdCoderApiJson } from './apiJson.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { readRuntimeServerSessionId } from './runtimeServerSession.ts';

export interface BirdCoderWorkspaceRealtimeSubscription {
  close(): void;
}

export interface SubscribeBirdCoderWorkspaceRealtimeOptions {
  onClose?: () => void;
  onError?: (error: Error) => void;
  onEvent: (event: BirdCoderWorkspaceRealtimeEvent) => void;
  onOpen?: () => void;
  onReady?: (message: Extract<BirdCoderWorkspaceRealtimeMessage, { kind: 'ready' }>) => void;
  workspaceId: string;
}

type BirdCoderWebSocketFactory = (url: string) => WebSocket;

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
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
    `${normalizedBasePath}/api/app/v1/workspaces/${encodeURIComponent(workspaceId)}/realtime`;
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
      normalizeText(runtimeConfig.apiBaseUrl) &&
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
  const baseUrl = normalizeText(runtimeConfig.apiBaseUrl);
  const sessionId = normalizeText(readRuntimeServerSessionId());
  const createWebSocket = resolveWebSocketFactory();
  if (!baseUrl || !sessionId || !createWebSocket) {
    return null;
  }

  const socket = createWebSocket(
    resolveBirdCoderWorkspaceRealtimeUrl(baseUrl, workspaceId, sessionId),
  );

  socket.addEventListener('open', () => {
    options.onOpen?.();
  });
  socket.addEventListener('close', () => {
    options.onClose?.();
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

  return {
    close() {
      if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
        return;
      }
      socket.close();
    },
  };
}
