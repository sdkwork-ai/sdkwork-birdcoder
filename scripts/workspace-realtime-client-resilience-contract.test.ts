import assert from "node:assert/strict";

const workspaceRealtimeClientModulePath = new URL(
  "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/workspaceRealtimeClient.ts",
  import.meta.url,
);
const workspaceRealtimeCursorStoreModulePath = new URL(
  "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/workspaceRealtimeCursorStore.ts",
  import.meta.url,
);
const workspaceRealtimeMessageQueueModulePath = new URL(
  "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/workspaceRealtimeMessageQueue.ts",
  import.meta.url,
);
const projectRealtimeSubscriptionCoordinatorModulePath = new URL(
  "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/services/projectRealtimeSubscriptionCoordinator.ts",
  import.meta.url,
);
const defaultIdeServicesRuntimeModulePath = new URL(
  "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesRuntime.ts",
  import.meta.url,
);
const runtimeServerSessionModulePath = new URL(
  "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeServerSession.ts",
  import.meta.url,
);

const originalWebSocketDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "WebSocket",
);
const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");

class ContractWebSocket {
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static readonly urls: string[] = [];
  static readonly protocols: string[][] = [];
  static readonly instances: ContractWebSocket[] = [];
  static negotiateApplicationProtocol = true;

  closeCalls = 0;
  readonly protocol: string;
  readyState = 1;
  readonly url: string;
  private readonly listeners = new Map<
    string,
    Array<(event: { data?: unknown }) => void>
  >();

  constructor(url: string, protocols: string[] = []) {
    this.url = url;
    this.protocol =
      ContractWebSocket.negotiateApplicationProtocol &&
      protocols.includes("sdkwork-realtime-v1")
      ? "sdkwork-realtime-v1"
      : "";
    ContractWebSocket.urls.push(url);
    ContractWebSocket.protocols.push([...protocols]);
    ContractWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data?: unknown }) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type: string, event: { data?: unknown } = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  close() {
    this.closeCalls += 1;
    this.readyState = ContractWebSocket.CLOSED;
  }
}

Object.defineProperty(globalThis, "WebSocket", {
  configurable: true,
  value: ContractWebSocket,
});

try {
  const {
    canSubscribeBirdCoderWorkspaceRealtime,
    isTerminalBirdCoderRealtimeHttpError,
    resolveBirdCoderRealtimeTransportOrder,
    resolveBirdCoderWorkspaceRealtimeUrl,
    subscribeBirdCoderWorkspaceRealtime,
  } = await import(workspaceRealtimeClientModulePath.href);
  const { BoundedRealtimeCursorStore } = await import(
    workspaceRealtimeCursorStoreModulePath.href
  );
  const { BoundedRealtimeMessageQueue } = await import(
    workspaceRealtimeMessageQueueModulePath.href
  );
  const {
    createProjectRealtimeSubscriptionCoordinator,
    MAX_DURABLE_REALTIME_SESSION_SUBSCRIPTIONS,
    selectDurableRealtimeCodingSessions,
  } = await import(projectRealtimeSubscriptionCoordinatorModulePath.href);
  const { configureDefaultBirdCoderIdeServicesRuntime } = await import(
    defaultIdeServicesRuntimeModulePath.href
  );
  const {
    clearRuntimeServerSessionId,
    readRuntimeServerSessionId,
    writeRuntimeServerTokenBundle,
    writeRuntimeServerSessionId,
  } = await import(`${runtimeServerSessionModulePath.href}?t=${Date.now()}`);

  const persistedCursors = new Map<string, string>();
  const cursorStore = new BoundedRealtimeCursorStore(2, () => ({
    getItem(key: string) {
      return persistedCursors.get(key) ?? null;
    },
    removeItem(key: string) {
      persistedCursors.delete(key);
    },
    setItem(key: string, value: string) {
      persistedCursors.set(key, value);
    },
  }));
  cursorStore.write("cursor-a", 1);
  cursorStore.write("cursor-b", 2);
  assert.equal(
    cursorStore.read("cursor-a"),
    1,
    "cursor reads must refresh LRU recency.",
  );
  cursorStore.write("cursor-c", 3);
  assert.equal(
    persistedCursors.has("cursor-b"),
    false,
    "cursor eviction must also bound sessionStorage growth.",
  );
  assert.equal(
    cursorStore.read("cursor-b"),
    undefined,
    "cursor memory must evict the least-recently-used entry at its configured capacity.",
  );
  assert.equal(
    cursorStore.read("cursor-a"),
    1,
    "the recently-read cursor must remain resident.",
  );
  assert.equal(
    cursorStore.read("cursor-c"),
    3,
    "the newest cursor must remain resident.",
  );
  const reloadedCursorStore = new BoundedRealtimeCursorStore(2, () => ({
    getItem(key: string) {
      return persistedCursors.get(key) ?? null;
    },
    removeItem(key: string) {
      persistedCursors.delete(key);
    },
    setItem(key: string, value: string) {
      persistedCursors.set(key, value);
    },
  }));
  reloadedCursorStore.write("cursor-d", 4);
  assert.equal(
    persistedCursors.has("cursor-a"),
    false,
    "the persisted cursor index must preserve the capacity bound across reloads.",
  );
  assert.equal(persistedCursors.get("cursor-c"), "3");
  assert.equal(persistedCursors.get("cursor-d"), "4");
  reloadedCursorStore.write("cursor-d", 2);
  assert.equal(
    reloadedCursorStore.read("cursor-d"),
    4,
    "a stale realtime subscriber must not move a committed durable cursor backwards.",
  );
  assert.throws(
    () => reloadedCursorStore.write("cursor-invalid", Number.NaN),
    /non-negative safe integer/u,
  );

  const messageQueue = new BoundedRealtimeMessageQueue<number>(3);
  assert.equal(messageQueue.enqueue(1), true);
  assert.equal(messageQueue.enqueue(2), true);
  assert.equal(messageQueue.dequeue(), 1);
  assert.equal(messageQueue.enqueue(3), true);
  assert.equal(messageQueue.enqueue(4), true);
  assert.equal(messageQueue.enqueue(5), false);
  assert.deepEqual(
    [messageQueue.dequeue(), messageQueue.dequeue(), messageQueue.dequeue()],
    [2, 3, 4],
    "the bounded ring queue must preserve FIFO order when its tail wraps.",
  );
  assert.equal(messageQueue.length, 0);

  const createRealtimeSession = (
    id: string,
    runtimeStatus: string,
    engineId = "codex",
  ) => ({
    id,
    engineId,
    runtimeStatus,
  });
  let coordinatorProjects = [
    {
      codingSessions: [
        createRealtimeSession("awaiting-session-old", "awaiting_approval"),
        createRealtimeSession("streaming-session-new", "streaming"),
        createRealtimeSession("completed-session", "completed"),
      ],
    },
  ];
  const coordinatorSubscriptions: Array<{
    closed: boolean;
    codingSessionId: string | undefined;
  }> = [];
  const coordinator = createProjectRealtimeSubscriptionCoordinator({
    getProjects: () => coordinatorProjects as never,
    isActive: () => true,
    onEvent() {},
    onWorkspaceReady() {},
    subscribe(options) {
      const record = {
        closed: false,
        codingSessionId: options.codingSessionId,
      };
      coordinatorSubscriptions.push(record);
      return {
        close() {
          record.closed = true;
        },
      };
    },
    workspaceId: "workspace-multi-session",
  });
  coordinator.start();
  assert.deepEqual(
    coordinatorSubscriptions.map(
      (subscription) => subscription.codingSessionId,
    ),
    [undefined, "streaming-session-new", "awaiting-session-old"],
    "workspace inventory and every executing coding session must use independent realtime subscriptions.",
  );
  coordinatorProjects = [
    {
      codingSessions: [
        createRealtimeSession("awaiting-session-old", "completed"),
        createRealtimeSession("streaming-session-new", "streaming"),
        createRealtimeSession("awaiting-session-next", "awaiting_user"),
      ],
    },
  ];
  coordinator.synchronize();
  assert.equal(
    coordinatorSubscriptions.find(
      (subscription) => subscription.codingSessionId === "awaiting-session-old",
    )?.closed,
    true,
    "a terminal session must release its durable realtime subscription.",
  );
  assert.ok(
    coordinatorSubscriptions.some(
      (subscription) =>
        subscription.codingSessionId === "awaiting-session-next",
    ),
    "a newly executing session must bind without waiting for the workspace channel to reconnect.",
  );
  const overCapacitySessions = Array.from(
    { length: MAX_DURABLE_REALTIME_SESSION_SUBSCRIPTIONS + 3 },
    (_, index) =>
      createRealtimeSession(`bounded-session-${index}`, "streaming"),
  );
  assert.equal(
    selectDurableRealtimeCodingSessions([
      { codingSessions: overCapacitySessions },
    ] as never).length,
    MAX_DURABLE_REALTIME_SESSION_SUBSCRIPTIONS,
    "durable session fan-out must remain explicitly bounded.",
  );
  coordinator.close();

  configureDefaultBirdCoderIdeServicesRuntime({
    apiBaseUrl: "not a url",
    executionAuthorityMode: "remote-required",
  });
  writeRuntimeServerTokenBundle({
    accessToken: "runtime-access-token-contract",
    authToken: "runtime-auth-token-contract",
    sessionToken: "runtime-session-contract",
  });

  assert.equal(
    canSubscribeBirdCoderWorkspaceRealtime(),
    false,
    "workspace realtime availability must reject malformed API base URLs instead of reporting a subscribable channel.",
  );
  const canonicalRealtimeUrl = new URL(
    resolveBirdCoderWorkspaceRealtimeUrl(
      "https://realtime.example.test/api?stale=true#fragment",
      "workspace-canonical-url",
    ),
  );
  assert.equal(canonicalRealtimeUrl.searchParams.has("stale"), false);
  assert.equal(canonicalRealtimeUrl.hash, "");
  assert.throws(
    () =>
      resolveBirdCoderWorkspaceRealtimeUrl(
        "https://user:password@realtime.example.test",
        "workspace-credentialed-base-url",
      ),
    /base URL is invalid/u,
  );

  configureDefaultBirdCoderIdeServicesRuntime({
    apiBaseUrl: "ftp://realtime.example.test",
    executionAuthorityMode: "remote-required",
  });
  assert.equal(
    canSubscribeBirdCoderWorkspaceRealtime(),
    false,
    "workspace realtime must fail closed for non-HTTP runtime base URL protocols.",
  );
  assert.doesNotThrow(
    () =>
      subscribeBirdCoderWorkspaceRealtime({
        workspaceId: "workspace-realtime-contract",
        onEvent() {},
      }),
    "workspace realtime subscription must not throw when runtime API base URL configuration is malformed.",
  );
  assert.equal(
    subscribeBirdCoderWorkspaceRealtime({
      workspaceId: "workspace-realtime-contract",
      onEvent() {},
    }),
    null,
    "workspace realtime subscription must safely fall back to null when runtime API base URL configuration is malformed.",
  );

  clearRuntimeServerSessionId();
  ContractWebSocket.urls.length = 0;
  configureDefaultBirdCoderIdeServicesRuntime({
    apiBaseUrl: "https://realtime.example.test",
    executionAuthorityMode: "remote-required",
  });
  writeRuntimeServerTokenBundle({
    accessToken: "access-token-without-session",
    authToken: "auth-token-without-session",
  });

  assert.equal(
    readRuntimeServerSessionId(),
    null,
    "a runtime auth/access token bundle without an IAM session id must not synthesize a WebSocket session id.",
  );
  assert.equal(
    canSubscribeBirdCoderWorkspaceRealtime(),
    false,
    "workspace realtime must fail closed when the authenticated token bundle does not include a real IAM session id.",
  );
  assert.equal(
    subscribeBirdCoderWorkspaceRealtime({
      workspaceId: "workspace-without-iam-session",
      onEvent() {},
    }),
    null,
    "workspace realtime must not create a socket from an auth/access token fallback.",
  );
  assert.deepEqual(
    ContractWebSocket.urls,
    [],
    "workspace realtime must never serialize auth/access tokens into a WebSocket URL.",
  );

  clearRuntimeServerSessionId();
  writeRuntimeServerTokenBundle({
    accessToken: "access-token-with-iam-session",
    authToken: "auth-token-with-iam-session",
    sessionToken: "iam-session-for-realtime",
  });
  const subscription = subscribeBirdCoderWorkspaceRealtime({
    workspaceId: "workspace-with-iam-session",
    onEvent() {},
  });
  assert.notEqual(
    subscription,
    null,
    "a real IAM session id must permit workspace realtime.",
  );
  const realtimeUrl = new URL(ContractWebSocket.urls.at(-1));
  assert.equal(
    realtimeUrl.searchParams.has("sessionId"),
    false,
    "the IAM session authority must come from dual-token validation, not URL context selectors.",
  );
  assert.equal(realtimeUrl.searchParams.has("authToken"), false);
  assert.equal(realtimeUrl.searchParams.has("accessToken"), false);
  assert.equal(
    realtimeUrl.toString().includes("auth-token-with-iam-session"),
    false,
  );
  assert.equal(
    realtimeUrl.toString().includes("access-token-with-iam-session"),
    false,
  );
  const realtimeProtocols = ContractWebSocket.protocols.at(-1) ?? [];
  assert.equal(realtimeProtocols[0], "sdkwork-realtime-v1");
  assert.equal(
    realtimeProtocols.some((protocol) =>
      protocol.startsWith("sdkwork-realtime-auth-v1."),
    ),
    true,
  );
  assert.equal(
    realtimeProtocols.some((protocol) =>
      protocol.startsWith("sdkwork-realtime-access-v1."),
    ),
    true,
  );
  assert.equal(
    realtimeProtocols.join(",").includes("auth-token-with-iam-session"),
    false,
    "raw credentials must be UTF-8 base64url encoded in the handshake carrier.",
  );
  subscription?.close();

  ContractWebSocket.instances.length = 0;
  let durableEvents = 0;
  const durableSubscription = subscribeBirdCoderWorkspaceRealtime({
    afterSequence: 8,
    codingSessionId: "coding-session-resume",
    workspaceId: "workspace-with-iam-session",
    maxReconnectAttempts: 2,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    onEvent() {
      durableEvents += 1;
    },
  });
  const durableSocket = ContractWebSocket.instances.at(-1);
  assert.ok(durableSocket, "durable subscription must create a websocket.");
  const durableUrl = new URL(durableSocket.url);
  assert.equal(
    durableUrl.searchParams.get("codingSessionId"),
    "coding-session-resume",
  );
  assert.equal(durableUrl.searchParams.get("afterSequence"), "8");
  durableSocket.emit("message", {
    data: JSON.stringify({
      kind: "event",
      event: {
        eventId: "durable-event-9",
        codingSessionId: "coding-session-resume",
        codingSessionEventSequence: "9",
      },
    }),
  });
  durableSocket.emit("message", {
    data: JSON.stringify({
      kind: "event",
      event: {
        eventId: "durable-event-9-duplicate",
        codingSessionId: "coding-session-resume",
        codingSessionEventSequence: "9",
      },
    }),
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    durableEvents,
    1,
    "duplicate durable sequences must be applied exactly once.",
  );
  durableSocket.emit("close");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const resumedSocket = ContractWebSocket.instances.at(-1);
  assert.notEqual(
    resumedSocket,
    durableSocket,
    "durable subscription must reconnect.",
  );
  assert.equal(
    new URL(resumedSocket.url).searchParams.get("afterSequence"),
    "9",
    "reconnect must resume after the last successfully applied durable sequence.",
  );
  durableSubscription?.close();

  ContractWebSocket.instances.length = 0;
  let gapEvents = 0;
  const gapSubscription = subscribeBirdCoderWorkspaceRealtime({
    codingSessionId: "coding-session-resume",
    workspaceId: "workspace-with-iam-session",
    maxReconnectAttempts: 2,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    onEvent() {
      gapEvents += 1;
    },
  });
  const gapSocket = ContractWebSocket.instances.at(-1);
  assert.ok(gapSocket, "sequence-gap contract must create a websocket.");
  assert.equal(new URL(gapSocket.url).searchParams.get("afterSequence"), "9");
  gapSocket.emit("message", {
    data: JSON.stringify({
      kind: "event",
      event: {
        eventId: "durable-event-11-gap",
        codingSessionId: "coding-session-resume",
        codingSessionEventSequence: "11",
      },
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const retryAfterGap = ContractWebSocket.instances.at(-1);
  assert.notEqual(
    retryAfterGap,
    gapSocket,
    "a durable sequence gap must reconnect.",
  );
  assert.equal(
    gapEvents,
    0,
    "a durable sequence gap must not reach the projection callback.",
  );
  assert.equal(
    new URL(retryAfterGap.url).searchParams.get("afterSequence"),
    "9",
    "a durable sequence gap must reconnect from the last contiguous cursor.",
  );
  gapSubscription?.close();

  ContractWebSocket.instances.length = 0;
  let freshGapEvents = 0;
  const freshGapSubscription = subscribeBirdCoderWorkspaceRealtime({
    codingSessionId: "coding-session-fresh-gap",
    workspaceId: "workspace-with-iam-session",
    maxReconnectAttempts: 2,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    onEvent() {
      freshGapEvents += 1;
    },
  });
  const freshGapSocket = ContractWebSocket.instances.at(-1);
  assert.ok(
    freshGapSocket,
    "fresh sequence-gap contract must create a websocket.",
  );
  assert.equal(
    new URL(freshGapSocket.url).searchParams.get("afterSequence"),
    "0",
    "a fresh durable subscription must explicitly resume from the cursor before sequence one.",
  );
  freshGapSocket.emit("message", {
    data: JSON.stringify({
      kind: "event",
      event: {
        eventId: "durable-event-2-fresh-gap",
        codingSessionId: "coding-session-fresh-gap",
        codingSessionEventSequence: "2",
      },
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const retryAfterFreshGap = ContractWebSocket.instances.at(-1);
  assert.notEqual(retryAfterFreshGap, freshGapSocket);
  assert.equal(
    freshGapEvents,
    0,
    "a fresh subscription must not skip sequence one.",
  );
  assert.equal(
    new URL(retryAfterFreshGap.url).searchParams.get("afterSequence"),
    "0",
    "fresh sequence-gap recovery must preserve the last contiguous cursor at zero.",
  );
  freshGapSubscription?.close();

  ContractWebSocket.instances.length = 0;
  let releaseOverflowEvent: (() => void) | undefined;
  const overflowEventGate = new Promise<void>((resolve) => {
    releaseOverflowEvent = resolve;
  });
  const overflowAppliedSequences: number[] = [];
  const overflowErrors: Error[] = [];
  const overflowSubscription = subscribeBirdCoderWorkspaceRealtime({
    codingSessionId: "coding-session-overflow",
    workspaceId: "workspace-with-iam-session",
    maxPendingEvents: 2,
    maxReconnectAttempts: 2,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    onError(error) {
      overflowErrors.push(error);
    },
    async onEvent(event) {
      const sequence = Number(event.codingSessionEventSequence);
      if (sequence === 1) {
        await overflowEventGate;
      }
      overflowAppliedSequences.push(sequence);
    },
  });
  const overflowSocket = ContractWebSocket.instances.at(-1);
  assert.ok(
    overflowSocket,
    "slow-consumer overflow contract must create a websocket.",
  );
  for (const sequence of [1, 2, 3]) {
    overflowSocket.emit("message", {
      data: JSON.stringify({
        kind: "event",
        event: {
          eventId: `durable-event-${sequence}-overflow`,
          codingSessionId: "coding-session-overflow",
          codingSessionEventSequence: String(sequence),
        },
      }),
    });
  }
  await Promise.resolve();
  assert.equal(
    overflowSocket.closeCalls,
    1,
    "overflow must close intake immediately.",
  );
  assert.equal(
    ContractWebSocket.instances.at(-1),
    overflowSocket,
    "overflow recovery must wait for the single in-flight callback before reconnecting.",
  );
  assert.deepEqual(
    overflowAppliedSequences,
    [],
    "queued events must not overtake an unresolved in-flight event.",
  );
  assert.equal(overflowErrors.length, 1);
  assert.match(overflowErrors[0]?.message ?? "", /pending event capacity 2/u);
  releaseOverflowEvent?.();
  await new Promise((resolve) => setTimeout(resolve, 5));
  const retryAfterOverflow = ContractWebSocket.instances.at(-1);
  assert.notEqual(
    retryAfterOverflow,
    overflowSocket,
    "overflow must reconnect after commit.",
  );
  assert.deepEqual(overflowAppliedSequences, [1]);
  assert.equal(
    new URL(retryAfterOverflow.url).searchParams.get("afterSequence"),
    "1",
    "a successful in-flight callback must commit before overflow recovery reconnects.",
  );
  retryAfterOverflow.emit("message", {
    data: JSON.stringify({
      kind: "event",
      event: {
        eventId: "durable-event-2-overflow-replay",
        codingSessionId: "coding-session-overflow",
        codingSessionEventSequence: "2",
      },
    }),
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(
    overflowAppliedSequences,
    [1, 2],
    "the dropped queued event must be recovered once from durable replay.",
  );
  overflowSubscription?.close();

  ContractWebSocket.instances.length = 0;
  let releaseDisconnectedEvent: (() => void) | undefined;
  const disconnectedEventGate = new Promise<void>((resolve) => {
    releaseDisconnectedEvent = resolve;
  });
  let disconnectedEventApplications = 0;
  const slowDisconnectSubscription = subscribeBirdCoderWorkspaceRealtime({
    codingSessionId: "coding-session-slow-disconnect",
    workspaceId: "workspace-with-iam-session",
    maxReconnectAttempts: 2,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    async onEvent() {
      await disconnectedEventGate;
      disconnectedEventApplications += 1;
    },
  });
  const slowDisconnectSocket = ContractWebSocket.instances.at(-1);
  assert.ok(
    slowDisconnectSocket,
    "slow disconnect contract must create a websocket.",
  );
  slowDisconnectSocket.emit("message", {
    data: JSON.stringify({
      kind: "event",
      event: {
        eventId: "durable-event-1-slow-disconnect",
        codingSessionId: "coding-session-slow-disconnect",
        codingSessionEventSequence: "1",
      },
    }),
  });
  slowDisconnectSocket.emit("close");
  await Promise.resolve();
  assert.equal(
    ContractWebSocket.instances.at(-1),
    slowDisconnectSocket,
    "disconnect recovery must wait for an already-started callback.",
  );
  releaseDisconnectedEvent?.();
  await new Promise((resolve) => setTimeout(resolve, 5));
  const retryAfterSlowDisconnect = ContractWebSocket.instances.at(-1);
  assert.notEqual(retryAfterSlowDisconnect, slowDisconnectSocket);
  assert.equal(disconnectedEventApplications, 1);
  assert.equal(
    new URL(retryAfterSlowDisconnect.url).searchParams.get("afterSequence"),
    "1",
    "disconnect during a successful callback must reconnect from its committed cursor.",
  );
  slowDisconnectSubscription?.close();

  ContractWebSocket.instances.length = 0;
  let asyncApplicationErrors = 0;
  const failingSubscription = subscribeBirdCoderWorkspaceRealtime({
    codingSessionId: "coding-session-async-failure",
    workspaceId: "workspace-with-iam-session",
    maxReconnectAttempts: 2,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    onError() {
      asyncApplicationErrors += 1;
    },
    async onEvent() {
      throw new Error("projection application failed");
    },
  });
  const failingSocket = ContractWebSocket.instances.at(-1);
  assert.ok(failingSocket, "async failure contract must create a websocket.");
  failingSocket.emit("message", {
    data: JSON.stringify({
      kind: "event",
      event: {
        eventId: "durable-event-1-failing",
        codingSessionId: "coding-session-async-failure",
        codingSessionEventSequence: "1",
      },
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const retryAfterApplicationFailure = ContractWebSocket.instances.at(-1);
  assert.notEqual(
    retryAfterApplicationFailure,
    failingSocket,
    "an async event application failure must reconnect the durable subscription.",
  );
  assert.equal(
    new URL(retryAfterApplicationFailure.url).searchParams.get("afterSequence"),
    "0",
    "an async event application failure must not advance the durable cursor.",
  );
  assert.equal(asyncApplicationErrors, 1);
  failingSubscription?.close();

  ContractWebSocket.instances.length = 0;
  const liveApplicationErrors: Error[] = [];
  const liveFailingSubscription = subscribeBirdCoderWorkspaceRealtime({
    workspaceId: "workspace-live-application-failure",
    maxReconnectAttempts: 1,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    onError(error) {
      liveApplicationErrors.push(error);
    },
    onEvent() {
      throw new Error("live projection application failed");
    },
  });
  const liveFailingSocket = ContractWebSocket.instances.at(-1);
  assert.ok(liveFailingSocket);
  liveFailingSocket.emit("message", {
    data: JSON.stringify({
      kind: "event",
      event: { eventId: "live-event-failing" },
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.notEqual(
    ContractWebSocket.instances.at(-1),
    liveFailingSocket,
    "a live-only projection failure must close intake and reconnect instead of repeatedly consuming invalid state.",
  );
  assert.equal(liveApplicationErrors.length, 1);
  liveFailingSubscription?.close();

  ContractWebSocket.instances.length = 0;
  let closeNotifications = 0;
  const lifecycleSubscription = subscribeBirdCoderWorkspaceRealtime({
    workspaceId: "workspace-lifecycle",
    maxReconnectAttempts: 2,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    onClose() {
      closeNotifications += 1;
    },
    onEvent() {},
  });
  const firstSocket = ContractWebSocket.instances.at(-1);
  assert.ok(firstSocket, "lifecycle contract must create the initial socket.");
  firstSocket.emit("close");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const secondSocket = ContractWebSocket.instances.at(-1);
  assert.notEqual(
    secondSocket,
    firstSocket,
    "active socket close must reconnect.",
  );
  const connectionCount = ContractWebSocket.instances.length;
  firstSocket.emit("close");
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(
    ContractWebSocket.instances.length,
    connectionCount,
    "a stale socket close must not schedule another connection.",
  );
  lifecycleSubscription?.close();
  secondSocket?.emit("close");
  assert.equal(
    closeNotifications,
    1,
    "explicit close must notify exactly once.",
  );

  ContractWebSocket.instances.length = 0;
  ContractWebSocket.negotiateApplicationProtocol = false;
  const protocolErrors: Error[] = [];
  const protocolSubscription = subscribeBirdCoderWorkspaceRealtime({
    workspaceId: "workspace-protocol-downgrade",
    maxReconnectAttempts: 1,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    onError(error) {
      protocolErrors.push(error);
    },
    onEvent() {},
  });
  const downgradedSocket = ContractWebSocket.instances.at(-1);
  assert.ok(downgradedSocket);
  downgradedSocket.emit("open");
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.match(protocolErrors[0]?.message ?? "", /protocol negotiation/u);
  assert.ok(
    downgradedSocket.closeCalls > 0,
    "an unnegotiated application protocol must close the socket before recovery.",
  );
  protocolSubscription?.close();
  ContractWebSocket.negotiateApplicationProtocol = true;

  ContractWebSocket.instances.length = 0;
  let oversizedFrameEvents = 0;
  const oversizedFrameErrors: Error[] = [];
  const oversizedFrameSubscription = subscribeBirdCoderWorkspaceRealtime({
    workspaceId: "workspace-oversized-frame",
    maxReconnectAttempts: 1,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    onError(error) {
      oversizedFrameErrors.push(error);
    },
    onEvent() {
      oversizedFrameEvents += 1;
    },
  });
  const oversizedFrameSocket = ContractWebSocket.instances.at(-1);
  assert.ok(oversizedFrameSocket);
  oversizedFrameSocket.emit("message", { data: "x".repeat(1024 * 1024 + 1) });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(oversizedFrameEvents, 0);
  assert.match(oversizedFrameErrors[0]?.message ?? "", /frame exceeded/u);
  assert.ok(oversizedFrameSocket.closeCalls > 0);
  oversizedFrameSubscription?.close();

  ContractWebSocket.instances.length = 0;
  const readyTimeoutErrors: Error[] = [];
  const readyTimeoutSubscription = subscribeBirdCoderWorkspaceRealtime({
    workspaceId: "workspace-ready-timeout",
    maxReconnectAttempts: 2,
    readyTimeoutMs: 1,
    reconnectDelayMs: 0,
    transportPreference: "websocket",
    onError(error) {
      readyTimeoutErrors.push(error);
    },
    onEvent() {},
  });
  const socketWithoutReady = ContractWebSocket.instances.at(-1);
  assert.ok(socketWithoutReady);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.notEqual(
    ContractWebSocket.instances.at(-1),
    socketWithoutReady,
    "a connection that never receives the ready handshake must recover instead of hanging forever.",
  );
  assert.match(readyTimeoutErrors[0]?.message ?? "", /ready message/u);
  readyTimeoutSubscription?.close();

  assert.deepEqual(
    resolveBirdCoderRealtimeTransportOrder({
      agentCapabilities: { streaming: true },
      preference: "auto",
      sseAvailable: true,
      webSocketAvailable: true,
    }),
    ["sse", "websocket"],
    "a streaming-only agent should prefer SSE while retaining WebSocket fallback.",
  );
  assert.deepEqual(
    resolveBirdCoderRealtimeTransportOrder({
      agentCapabilities: { approvalCheckpoints: true, streaming: true },
      preference: "auto",
      sseAvailable: true,
      webSocketAvailable: true,
    }),
    ["websocket", "sse"],
    "an interactive agent should prefer WebSocket while retaining SSE fallback.",
  );
  assert.equal(isTerminalBirdCoderRealtimeHttpError({ httpStatus: 400 }), true);
  assert.equal(isTerminalBirdCoderRealtimeHttpError({ httpStatus: 403 }), true);
  assert.equal(isTerminalBirdCoderRealtimeHttpError({ httpStatus: 408 }), false);
  assert.equal(isTerminalBirdCoderRealtimeHttpError({ httpStatus: 429 }), false);
  assert.equal(isTerminalBirdCoderRealtimeHttpError({ httpStatus: 500 }), false);

  const sseRequests: Array<{ init?: RequestInit; url: string }> = [];
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      sseRequests.push({ init, url: String(input) });
      return new Response(new ReadableStream<Uint8Array>(), {
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        status: 200,
      });
    },
  });
  configureDefaultBirdCoderIdeServicesRuntime({
    apiBaseUrl: "https://realtime.example.test",
    executionAuthorityMode: "remote-required",
    realtimeTransport: "sse",
  });
  const sseSubscription = subscribeBirdCoderWorkspaceRealtime({
    workspaceId: "workspace-sse",
    onEvent() {},
  });
  assert.notEqual(
    sseSubscription,
    null,
    "explicit SSE configuration must create a subscription.",
  );
  await Promise.resolve();
  const sseRequest = sseRequests.at(-1);
  assert.ok(sseRequest, "authenticated SSE must issue a fetch request.");
  const sseUrl = new URL(sseRequest.url);
  assert.equal(sseUrl.protocol, "https:");
  assert.equal(sseUrl.searchParams.get("transport"), "sse");
  assert.equal(
    sseUrl.searchParams.has("sessionId"),
    false,
  );
  const sseHeaders = new Headers(sseRequest.init?.headers);
  assert.equal(sseHeaders.get("Authorization"), "Bearer auth-token-with-iam-session");
  assert.equal(sseHeaders.get("Access-Token"), "access-token-with-iam-session");
  sseSubscription?.close();

  clearRuntimeServerSessionId();
  configureDefaultBirdCoderIdeServicesRuntime();
} finally {
  if (originalWebSocketDescriptor) {
    Object.defineProperty(globalThis, "WebSocket", originalWebSocketDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "WebSocket");
  }
  if (originalFetchDescriptor) {
    Object.defineProperty(globalThis, "fetch", originalFetchDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "fetch");
  }
}

console.log("workspace realtime client resilience contract passed.");
