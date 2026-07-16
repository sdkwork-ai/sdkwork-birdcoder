import type {
  BirdCoderCodingSession,
  BirdCoderProject,
  BirdCoderWorkspaceRealtimeEvent,
} from "@sdkwork/birdcoder-pc-types";
import { isBirdCoderCodingSessionExecuting } from "@sdkwork/birdcoder-pc-types";
import { findWorkbenchCodeEngineKernel } from "@sdkwork/birdcoder-pc-codeengine";
import type {
  BirdCoderWorkspaceRealtimeSubscription,
  SubscribeBirdCoderWorkspaceRealtimeOptions,
} from "@sdkwork/birdcoder-pc-infrastructure-runtime/workspaceRealtime";
import { subscribeBirdCoderWorkspaceRealtime } from "@sdkwork/birdcoder-pc-infrastructure-runtime/workspaceRealtime";

export const MAX_DURABLE_REALTIME_SESSION_SUBSCRIPTIONS = 8;

type RealtimeSubscriptionFactory = (
  options: SubscribeBirdCoderWorkspaceRealtimeOptions,
) => BirdCoderWorkspaceRealtimeSubscription | null;

interface RealtimeConnectionState {
  closed: boolean;
  codingSession: BirdCoderCodingSession | null;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  subscription: BirdCoderWorkspaceRealtimeSubscription | null;
}

export interface ProjectRealtimeSubscriptionCoordinator {
  close(): void;
  start(): void;
  synchronize(): void;
}

export interface CreateProjectRealtimeSubscriptionCoordinatorOptions {
  getProjects: () => readonly BirdCoderProject[];
  isActive: () => boolean;
  onEvent: (event: BirdCoderWorkspaceRealtimeEvent) => void | Promise<void>;
  onWorkspaceReady: () => void;
  subscribe?: RealtimeSubscriptionFactory;
  workspaceId: string;
}

const REALTIME_SESSION_STATUS_PRIORITY: Record<string, number> = {
  streaming: 0,
  initializing: 1,
  awaiting_tool: 2,
  awaiting_approval: 3,
  awaiting_user: 4,
};

export function selectDurableRealtimeCodingSessions(
  projects: readonly BirdCoderProject[],
  limit = MAX_DURABLE_REALTIME_SESSION_SUBSCRIPTIONS,
): BirdCoderCodingSession[] {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    return [];
  }

  return projects
    .flatMap((project) => project.codingSessions)
    .filter(isBirdCoderCodingSessionExecuting)
    .sort(
      (left, right) =>
        (REALTIME_SESSION_STATUS_PRIORITY[left.runtimeStatus ?? ""] ??
          Number.MAX_SAFE_INTEGER) -
        (REALTIME_SESSION_STATUS_PRIORITY[right.runtimeStatus ?? ""] ??
          Number.MAX_SAFE_INTEGER),
    )
    .slice(0, limit);
}

export function createProjectRealtimeSubscriptionCoordinator(
  options: CreateProjectRealtimeSubscriptionCoordinatorOptions,
): ProjectRealtimeSubscriptionCoordinator {
  const subscribe = options.subscribe ?? subscribeBirdCoderWorkspaceRealtime;
  const sessionConnections = new Map<string, RealtimeConnectionState>();
  const workspaceConnection: RealtimeConnectionState = {
    closed: false,
    codingSession: null,
    reconnectAttempt: 0,
    reconnectTimer: null,
    subscription: null,
  };
  let closed = false;
  let started = false;

  const closeConnection = (connection: RealtimeConnectionState): void => {
    connection.closed = true;
    if (connection.reconnectTimer !== null) {
      clearTimeout(connection.reconnectTimer);
      connection.reconnectTimer = null;
    }
    const subscription = connection.subscription;
    connection.subscription = null;
    subscription?.close();
  };

  const scheduleReconnect = (connection: RealtimeConnectionState): void => {
    if (closed || connection.closed || !options.isActive()) {
      return;
    }
    if (connection.reconnectTimer !== null) {
      return;
    }

    connection.reconnectTimer = setTimeout(
      () => {
        connection.reconnectTimer = null;
        connect(connection);
      },
      Math.min(5_000, 400 * (connection.reconnectAttempt + 1)),
    );
  };

  const connect = (connection: RealtimeConnectionState): void => {
    if (
      closed ||
      connection.closed ||
      connection.reconnectTimer !== null ||
      connection.subscription !== null ||
      !options.isActive()
    ) {
      return;
    }

    const codingSession = connection.codingSession;
    const engineCapabilities = findWorkbenchCodeEngineKernel(
      codingSession?.engineId,
    )?.descriptor.capabilityMatrix;
    const subscription = subscribe({
      agentCapabilities: engineCapabilities
        ? {
            approvalCheckpoints: engineCapabilities.approvalCheckpoints,
            remoteBridge: engineCapabilities.remoteBridge,
            streaming: engineCapabilities.streaming,
            toolCalls: engineCapabilities.toolCalls,
          }
        : undefined,
      codingSessionId: codingSession?.id,
      onClose: () => {
        connection.subscription = null;
        if (closed || connection.closed) {
          return;
        }
        connection.reconnectAttempt += 1;
        scheduleReconnect(connection);
      },
      onError: () => {
        // The realtime client owns durable recovery; terminal close drives outer reconnects.
      },
      onEvent: options.onEvent,
      onReady: () => {
        connection.reconnectAttempt = 0;
        if (codingSession === null) {
          options.onWorkspaceReady();
        }
      },
      workspaceId: options.workspaceId,
    });

    if (!subscription) {
      connection.reconnectAttempt += 1;
      scheduleReconnect(connection);
      return;
    }
    connection.subscription = subscription;
  };

  const synchronize = (): void => {
    if (closed || !started || !options.isActive()) {
      return;
    }

    connect(workspaceConnection);
    const selectedSessions = selectDurableRealtimeCodingSessions(
      options.getProjects(),
    );
    const selectedSessionIds = new Set(
      selectedSessions.map((session) => session.id),
    );
    for (const [codingSessionId, connection] of sessionConnections) {
      if (!selectedSessionIds.has(codingSessionId)) {
        sessionConnections.delete(codingSessionId);
        closeConnection(connection);
      }
    }
    for (const codingSession of selectedSessions) {
      if (sessionConnections.has(codingSession.id)) {
        continue;
      }
      const connection: RealtimeConnectionState = {
        closed: false,
        codingSession,
        reconnectAttempt: 0,
        reconnectTimer: null,
        subscription: null,
      };
      sessionConnections.set(codingSession.id, connection);
      connect(connection);
    }
  };

  return {
    close() {
      if (closed) {
        return;
      }
      closed = true;
      closeConnection(workspaceConnection);
      for (const connection of sessionConnections.values()) {
        closeConnection(connection);
      }
      sessionConnections.clear();
    },
    start() {
      if (closed || started) {
        return;
      }
      started = true;
      connect(workspaceConnection);
      synchronize();
    },
    synchronize,
  };
}
