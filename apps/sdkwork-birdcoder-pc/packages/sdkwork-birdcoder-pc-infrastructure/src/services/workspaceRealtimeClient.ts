import type {
  BirdCoderWorkspaceRealtimeEvent,
  BirdCoderWorkspaceRealtimeMessage,
} from "@sdkwork/birdcoder-pc-types";
import { parseBirdCoderApiJson } from "./apiJson.ts";
import { getStoredAppSessionId } from "./appSessionToken.ts";
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from "./defaultIdeServicesRuntime.ts";
import type { BirdCoderRealtimeTransportPreference } from "./defaultIdeServicesRuntime.ts";
import { BoundedRealtimeCursorStore } from "./workspaceRealtimeCursorStore.ts";
import { BoundedRealtimeMessageQueue } from "./workspaceRealtimeMessageQueue.ts";
import {
  createWorkspaceRealtimeWebSocketProtocols,
  resolveWorkspaceRealtimeDualTokenCredentials,
} from "./workspaceRealtimeAuthentication.ts";
import {
  canUseWorkspaceRealtimeSseTransport,
  createWorkspaceRealtimeSseTransport,
  type WorkspaceRealtimeSseSubscription,
} from "./workspaceRealtimeSseTransport.ts";
import { refreshBirdCoderAppSessionNow } from "./appSessionRefresh.ts";
import {
  handleBirdCoderSdkSessionAuthError,
  isBirdCoderSdkSessionAuthError,
} from "./sdkClients.ts";
import { readBirdCoderApiTransportErrorHttpStatus } from "@sdkwork/birdcoder-pc-types/apiTransportError";

export type BirdCoderRealtimeTransport = "sse" | "websocket";

export interface BirdCoderRealtimeAgentCapabilities {
  approvalCheckpoints?: boolean;
  remoteBridge?: boolean;
  streaming?: boolean;
  toolCalls?: boolean;
}

export interface BirdCoderWorkspaceRealtimeSubscription {
  close(): void;
}

export interface SubscribeBirdCoderWorkspaceRealtimeOptions {
  agentCapabilities?: BirdCoderRealtimeAgentCapabilities;
  afterSequence?: number;
  codingSessionId?: string;
  maxPendingEvents?: number;
  maxReconnectAttempts?: number;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onEvent: (event: BirdCoderWorkspaceRealtimeEvent) => void | Promise<void>;
  onOpen?: () => void;
  onReady?: (
    message: Extract<BirdCoderWorkspaceRealtimeMessage, { kind: "ready" }>,
  ) => void;
  readyTimeoutMs?: number;
  reconnectDelayMs?: number;
  transportPreference?: BirdCoderRealtimeTransportPreference;
  workspaceId: string;
}

type BirdCoderWebSocketFactory = (
  url: string,
  protocols: string[],
) => WebSocket;

interface PendingRealtimeMessage {
  generation: number;
  rawMessage: string;
}

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 8;
const DEFAULT_RECONNECT_DELAY_MS = 1_000;
const DEFAULT_MAX_PENDING_EVENTS = 256;
const DEFAULT_READY_TIMEOUT_MS = 10_000;
const MAX_CONFIGURED_PENDING_EVENTS = 4_096;
const MAX_READY_TIMEOUT_MS = 60_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_REALTIME_MESSAGE_BYTES = 1024 * 1024;
const realtimeCursorStore = new BoundedRealtimeCursorStore();

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeRealtimeBaseUrl(
  value: string | null | undefined,
): string | null {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function resolveWebSocketFactory(): BirdCoderWebSocketFactory | null {
  if (typeof WebSocket !== "function") {
    return null;
  }

  return (url, protocols) => new WebSocket(url, protocols);
}

export function resolveBirdCoderRealtimeTransportOrder(input: {
  agentCapabilities?: BirdCoderRealtimeAgentCapabilities;
  preference?: BirdCoderRealtimeTransportPreference;
  sseAvailable?: boolean;
  webSocketAvailable?: boolean;
}): BirdCoderRealtimeTransport[] {
  const webSocketAvailable =
    input.webSocketAvailable ?? Boolean(resolveWebSocketFactory());
  const sseAvailable =
    input.sseAvailable ?? canUseWorkspaceRealtimeSseTransport();
  const preference = input.preference ?? "auto";
  if (preference === "websocket") {
    return webSocketAvailable ? ["websocket"] : [];
  }
  if (preference === "sse") {
    return sseAvailable ? ["sse"] : [];
  }

  const capabilities = input.agentCapabilities;
  const prefersWebSocketDelivery = Boolean(
    capabilities?.approvalCheckpoints ||
    capabilities?.remoteBridge ||
    capabilities?.toolCalls,
  );
  const preferredTransport: BirdCoderRealtimeTransport =
    prefersWebSocketDelivery || !capabilities?.streaming ? "websocket" : "sse";
  const orderedCandidates: BirdCoderRealtimeTransport[] =
    preferredTransport === "websocket"
      ? ["websocket", "sse"]
      : ["sse", "websocket"];

  return orderedCandidates.filter((transport) =>
    transport === "websocket" ? webSocketAvailable : sseAvailable,
  );
}

export function isTerminalBirdCoderRealtimeHttpError(error: unknown): boolean {
  const httpStatus = readBirdCoderApiTransportErrorHttpStatus(error);
  return Boolean(
    httpStatus !== undefined &&
    httpStatus >= 400 &&
    httpStatus < 500 &&
    httpStatus !== 401 &&
    httpStatus !== 408 &&
    httpStatus !== 429,
  );
}

export function resolveBirdCoderWorkspaceRealtimeUrl(
  baseUrl: string,
  workspaceId: string,
  transport: BirdCoderRealtimeTransport = "websocket",
  codingSessionId?: string,
  afterSequence?: number,
): string {
  const url = new URL(baseUrl);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    throw new Error("Workspace realtime base URL is invalid.");
  }
  url.search = "";
  url.hash = "";
  if (transport === "websocket") {
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  }
  const normalizedBasePath =
    url.pathname === "/" ? "" : url.pathname.replace(/\/+$/u, "");
  url.pathname = `${normalizedBasePath}/app/v3/api/workspaces/${encodeURIComponent(workspaceId)}/realtime`;
  url.searchParams.set("transport", transport);
  const normalizedCodingSessionId = normalizeText(codingSessionId);
  if (normalizedCodingSessionId) {
    url.searchParams.set("codingSessionId", normalizedCodingSessionId);
    if (Number.isSafeInteger(afterSequence) && (afterSequence ?? -1) >= 0) {
      url.searchParams.set("afterSequence", String(afterSequence));
    }
  }
  return url.toString();
}

function realtimeCursorStorageKey(
  workspaceId: string,
  codingSessionId: string,
  iamSessionId: string,
): string {
  return `sdkwork:birdcoder:realtime-cursor:${iamSessionId}:${workspaceId}:${codingSessionId}`;
}

function readRealtimeCursor(storageKey: string): number | undefined {
  return realtimeCursorStore.read(storageKey);
}

function writeRealtimeCursor(storageKey: string, sequence: number): void {
  realtimeCursorStore.write(storageKey, sequence);
}

function normalizeCursorSequence(
  value: string | number | undefined,
): number | undefined {
  const sequence = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(sequence) && sequence >= 0 ? sequence : undefined;
}

function normalizeEventSequence(
  value: string | number | undefined,
): number | undefined {
  const sequence = normalizeCursorSequence(value);
  return sequence !== undefined && sequence > 0 ? sequence : undefined;
}

function normalizePendingEventCapacity(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) < 1) {
    return DEFAULT_MAX_PENDING_EVENTS;
  }
  return Math.min(
    value ?? DEFAULT_MAX_PENDING_EVENTS,
    MAX_CONFIGURED_PENDING_EVENTS,
  );
}

function normalizeReadyTimeoutMs(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) < 1) {
    return DEFAULT_READY_TIMEOUT_MS;
  }
  return Math.min(value ?? DEFAULT_READY_TIMEOUT_MS, MAX_READY_TIMEOUT_MS);
}

function isRealtimeMessage(
  value: unknown,
): value is BirdCoderWorkspaceRealtimeMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.kind === "ready" &&
      typeof record.workspaceId === "string" &&
      typeof record.userId === "string" &&
      typeof record.connectedAt === "string") ||
    (record.kind === "event" &&
      !!record.event &&
      typeof record.event === "object" &&
      typeof (record.event as Record<string, unknown>).eventId === "string")
  );
}

export function canSubscribeBirdCoderWorkspaceRealtime(): boolean {
  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  return Boolean(
    resolveBirdCoderRealtimeTransportOrder({
      preference: runtimeConfig.realtimeTransport,
    }).length > 0 &&
    normalizeRealtimeBaseUrl(runtimeConfig.apiBaseUrl) &&
    normalizeText(getStoredAppSessionId()) &&
    resolveWorkspaceRealtimeDualTokenCredentials(),
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
  const sessionId = normalizeText(getStoredAppSessionId());
  const codingSessionId = normalizeText(options.codingSessionId);
  const createWebSocket = resolveWebSocketFactory();
  const sseAvailable = canUseWorkspaceRealtimeSseTransport();
  const transportOrder = resolveBirdCoderRealtimeTransportOrder({
    agentCapabilities: options.agentCapabilities,
    preference: options.transportPreference ?? runtimeConfig.realtimeTransport,
    sseAvailable,
    webSocketAvailable: Boolean(createWebSocket),
  });
  if (
    !baseUrl ||
    !sessionId ||
    !resolveWorkspaceRealtimeDualTokenCredentials() ||
    transportOrder.length === 0
  ) {
    return null;
  }

  const maxAttempts =
    options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
  const baseDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const maxPendingEvents = normalizePendingEventCapacity(
    options.maxPendingEvents,
  );
  const readyTimeoutMs = normalizeReadyTimeoutMs(options.readyTimeoutMs);
  let closed = false;
  let reconnectAttempts = 0;
  let activeSocket: WebSocket | null = null;
  let activeSseTransport: WorkspaceRealtimeSseSubscription | null = null;
  let transportIndex = 0;
  let connectionGeneration = 0;
  let closeNotified = false;
  let dispatching = false;
  let recoveryGeneration: number | null = null;
  const pendingMessages = new BoundedRealtimeMessageQueue<PendingRealtimeMessage>(
    maxPendingEvents,
  );
  let replayRequired = false;
  let authenticationRecoveryAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  const cursorStorageKey = codingSessionId
    ? realtimeCursorStorageKey(workspaceId, codingSessionId, sessionId)
    : null;
  let lastAppliedSequence =
    normalizeCursorSequence(options.afterSequence) ??
    (cursorStorageKey ? readRealtimeCursor(cursorStorageKey) : undefined) ??
    (codingSessionId ? 0 : undefined);

  const notifyClosed = () => {
    if (!closeNotified) {
      closeNotified = true;
      options.onClose?.();
    }
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  };

  const clearReadyTimer = () => {
    if (readyTimer !== undefined) {
      clearTimeout(readyTimer);
      readyTimer = undefined;
    }
  };

  const closeActiveSocket = () => {
    if (!activeSocket) {
      return;
    }

    if (
      activeSocket.readyState === WebSocket.CLOSING ||
      activeSocket.readyState === WebSocket.CLOSED
    ) {
      activeSocket = null;
      return;
    }

    activeSocket.close();
    activeSocket = null;
  };

  const closeActiveSseTransport = () => {
    activeSseTransport?.close();
    activeSseTransport = null;
  };

  const closeActiveConnection = () => {
    closeActiveSocket();
    closeActiveSseTransport();
  };

  const scheduleReconnect = (generation: number) => {
    if (closed || generation !== connectionGeneration) {
      return;
    }

    reconnectAttempts += 1;
    if (reconnectAttempts > maxAttempts) {
      closed = true;
      connectionGeneration += 1;
      replayRequired = true;
      recoveryGeneration = null;
      pendingMessages.clear();
      clearReadyTimer();
      closeActiveConnection();
      notifyClosed();
      return;
    }

    const delayMs = Math.min(
      baseDelayMs * 2 ** (reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS,
    );
    transportIndex = (transportIndex + 1) % transportOrder.length;
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      if (closed || generation !== connectionGeneration) {
        return;
      }
      reconnectTimer = undefined;
      connect();
    }, delayMs);
  };

  const reportRealtimeError = (error: unknown) => {
    try {
      options.onError?.(
        error instanceof Error
          ? error
          : new Error(
              `Workspace realtime payload processing failed for ${workspaceId}.`,
            ),
      );
    } catch {
      // Error observers must not interrupt durable recovery or leave intake open after overflow.
    }
  };

  const finishRecovery = (generation: number) => {
    if (
      closed ||
      generation !== connectionGeneration ||
      recoveryGeneration !== generation
    ) {
      return;
    }
    recoveryGeneration = null;
    connectionGeneration += 1;
    scheduleReconnect(connectionGeneration);
  };

  const requestRecovery = (generation: number) => {
    if (closed || generation !== connectionGeneration) {
      return;
    }
    replayRequired = true;
    recoveryGeneration ??= generation;
    pendingMessages.clear();
    clearReadyTimer();
    closeActiveConnection();
    if (!dispatching) {
      finishRecovery(generation);
    }
  };

  const terminateRealtimeConnection = () => {
    closed = true;
    connectionGeneration += 1;
    replayRequired = true;
    recoveryGeneration = null;
    pendingMessages.clear();
    clearReconnectTimer();
    clearReadyTimer();
    closeActiveConnection();
    notifyClosed();
  };

  const terminateAfterAuthenticationFailure = (error: unknown) => {
    handleBirdCoderSdkSessionAuthError(error);
    terminateRealtimeConnection();
  };

  const requestAuthenticationRecovery = async (
    error: unknown,
    generation: number,
  ) => {
    if (closed || generation !== connectionGeneration) {
      return;
    }
    if (authenticationRecoveryAttempts >= 1) {
      terminateAfterAuthenticationFailure(error);
      return;
    }

    authenticationRecoveryAttempts += 1;
    replayRequired = true;
    recoveryGeneration = generation;
    pendingMessages.clear();
    clearReadyTimer();
    closeActiveConnection();

    const refreshed = await refreshBirdCoderAppSessionNow();
    if (closed || generation !== connectionGeneration) {
      return;
    }
    if (!refreshed) {
      terminateAfterAuthenticationFailure(error);
      return;
    }

    recoveryGeneration = null;
    connectionGeneration += 1;
    scheduleReconnect(connectionGeneration);
  };

  const dispatchRealtimeMessage = async (
    rawMessage: string,
    generation: number,
  ) => {
    if (closed || generation !== connectionGeneration || replayRequired) {
      return;
    }

    const parsedMessage = parseBirdCoderApiJson(rawMessage) as unknown;
    if (!isRealtimeMessage(parsedMessage)) {
      throw new Error(
        `Workspace realtime payload is invalid for ${workspaceId}.`,
      );
    }

    if (parsedMessage.kind === "ready") {
      if (parsedMessage.workspaceId.trim() !== workspaceId) {
        throw new Error(
          `Workspace realtime ready payload targeted ${parsedMessage.workspaceId} instead of ${workspaceId}.`,
        );
      }
      clearReadyTimer();
      options.onReady?.(parsedMessage);
      reconnectAttempts = 0;
      authenticationRecoveryAttempts = 0;
      return;
    }

    if (codingSessionId) {
      if (parsedMessage.event.codingSessionId !== codingSessionId) {
        return;
      }
      const sequence = normalizeEventSequence(
        parsedMessage.event.codingSessionEventSequence,
      );
      if (sequence === undefined) {
        throw new Error(
          `Coding session realtime event is missing its durable sequence for ${codingSessionId}.`,
        );
      }
      if (
        lastAppliedSequence !== undefined &&
        sequence <= lastAppliedSequence
      ) {
        return;
      }
      const expectedSequence = (lastAppliedSequence ?? 0) + 1;
      if (sequence !== expectedSequence) {
        throw new Error(
          `Coding session realtime sequence gap detected for ${codingSessionId}: expected ${expectedSequence}, received ${sequence}.`,
        );
      }
      await options.onEvent(parsedMessage.event);
      lastAppliedSequence = sequence;
      if (cursorStorageKey) {
        writeRealtimeCursor(cursorStorageKey, sequence);
      }
      return;
    }

    await options.onEvent(parsedMessage.event);
  };

  const drainDispatchQueue = () => {
    if (closed || replayRequired || dispatching) {
      return;
    }
    const pendingMessage = pendingMessages.dequeue();
    if (!pendingMessage) {
      return;
    }

    dispatching = true;
    void dispatchRealtimeMessage(
      pendingMessage.rawMessage,
      pendingMessage.generation,
    )
      .catch((error: unknown) => {
        reportRealtimeError(error);
        requestRecovery(pendingMessage.generation);
      })
      .finally(() => {
        dispatching = false;
        if (recoveryGeneration === pendingMessage.generation) {
          finishRecovery(pendingMessage.generation);
          return;
        }
        drainDispatchQueue();
      });
  };

  const enqueueRealtimeMessage = (rawMessage: string, generation: number) => {
    if (closed || generation !== connectionGeneration || replayRequired) {
      return;
    }
    const retainedEventCount = pendingMessages.length + (dispatching ? 1 : 0);
    if (retainedEventCount >= maxPendingEvents) {
      reportRealtimeError(
        new Error(
          `Workspace realtime pending event capacity ${maxPendingEvents} was exceeded for ${workspaceId}; reconnecting from the last committed durable cursor.`,
        ),
      );
      requestRecovery(generation);
      return;
    }
    if (!pendingMessages.enqueue({ generation, rawMessage })) {
      reportRealtimeError(
        new Error(
          `Workspace realtime pending event capacity ${maxPendingEvents} was exceeded for ${workspaceId}; reconnecting from the last committed durable cursor.`,
        ),
      );
      requestRecovery(generation);
      return;
    }
    drainDispatchQueue();
  };

  const armReadyTimer = (generation: number) => {
    clearReadyTimer();
    readyTimer = setTimeout(() => {
      readyTimer = undefined;
      if (closed || generation !== connectionGeneration || replayRequired) {
        return;
      }
      reportRealtimeError(
        new Error(
          `Workspace realtime did not receive a ready message within ${readyTimeoutMs}ms for ${workspaceId}.`,
        ),
      );
      requestRecovery(generation);
    }, readyTimeoutMs);
  };

  const connect = () => {
    if (closed) {
      return;
    }

    const generation = ++connectionGeneration;
    replayRequired = false;
    clearReadyTimer();
    closeActiveConnection();
    const transport = transportOrder[transportIndex];
    if (transport === "sse") {
      if (!sseAvailable) {
        scheduleReconnect(generation);
        return;
      }
      try {
        const createdSseTransport = createWorkspaceRealtimeSseTransport({
          url: resolveBirdCoderWorkspaceRealtimeUrl(
            baseUrl,
            workspaceId,
            "sse",
            codingSessionId ?? undefined,
            lastAppliedSequence,
          ),
          onError(error) {
            if (
              closed ||
              generation !== connectionGeneration ||
              replayRequired
            ) {
              return;
            }
            reportRealtimeError(error);
            if (isBirdCoderSdkSessionAuthError(error)) {
              void requestAuthenticationRecovery(error, generation);
              return;
            }
            if (isTerminalBirdCoderRealtimeHttpError(error)) {
              terminateRealtimeConnection();
              return;
            }
            requestRecovery(generation);
          },
          onEvent(event) {
            if (closed || generation !== connectionGeneration) {
              return;
            }
            if (
              event.event !== "ready" &&
              event.event !== "event" &&
              event.event !== "message"
            ) {
              return;
            }
            enqueueRealtimeMessage(event.data, generation);
          },
          onOpen() {
            if (closed || generation !== connectionGeneration) {
              return;
            }
            options.onOpen?.();
          },
        });
        if (
          closed ||
          generation !== connectionGeneration ||
          replayRequired
        ) {
          createdSseTransport.close();
          return;
        }
        activeSseTransport = createdSseTransport;
        armReadyTimer(generation);
      } catch (error) {
        reportRealtimeError(error);
        scheduleReconnect(generation);
      }
      return;
    }

    if (!createWebSocket) {
      scheduleReconnect(generation);
      return;
    }
    let socket: WebSocket;
    try {
      socket = createWebSocket(
        resolveBirdCoderWorkspaceRealtimeUrl(
          baseUrl,
          workspaceId,
          "websocket",
          codingSessionId ?? undefined,
          lastAppliedSequence,
        ),
        createWorkspaceRealtimeWebSocketProtocols(),
      );
    } catch (error) {
      reportRealtimeError(error);
      scheduleReconnect(generation);
      return;
    }
    activeSocket = socket;
    armReadyTimer(generation);

    socket.addEventListener("open", () => {
      if (closed || generation !== connectionGeneration) {
        return;
      }
      if (socket.protocol !== "sdkwork-realtime-v1") {
        reportRealtimeError(
          new Error(
            `Workspace realtime protocol negotiation failed for ${workspaceId}.`,
          ),
        );
        requestRecovery(generation);
        return;
      }
      options.onOpen?.();
    });
    socket.addEventListener("close", () => {
      if (closed || generation !== connectionGeneration || replayRequired) {
        return;
      }

      if (activeSocket === socket) {
        activeSocket = null;
      }
      requestRecovery(generation);
    });
    socket.addEventListener("error", () => {
      if (closed || generation !== connectionGeneration) {
        return;
      }
      reportRealtimeError(
        new Error(`Workspace realtime channel failed for ${workspaceId}.`),
      );
    });
    socket.addEventListener("message", (event) => {
      if (closed || generation !== connectionGeneration) {
        return;
      }
      if (typeof event.data !== "string") {
        reportRealtimeError(
          new Error(
            `Workspace realtime received a non-text frame for ${workspaceId}.`,
          ),
        );
        requestRecovery(generation);
        return;
      }
      if (
        event.data.length > MAX_REALTIME_MESSAGE_BYTES ||
        new TextEncoder().encode(event.data).byteLength >
          MAX_REALTIME_MESSAGE_BYTES
      ) {
        reportRealtimeError(
          new Error(
            `Workspace realtime frame exceeded its limit for ${workspaceId}.`,
          ),
        );
        requestRecovery(generation);
        return;
      }
      enqueueRealtimeMessage(event.data, generation);
    });
  };

  connect();

  return {
    close() {
      closed = true;
      connectionGeneration += 1;
      replayRequired = true;
      recoveryGeneration = null;
      pendingMessages.clear();
      clearReconnectTimer();
      clearReadyTimer();
      closeActiveConnection();
      notifyClosed();
    },
  };
}
