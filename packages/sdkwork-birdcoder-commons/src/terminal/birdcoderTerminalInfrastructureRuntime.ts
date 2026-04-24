export * from '../../../../../sdkwork-terminal/packages/sdkwork-terminal-infrastructure/src/index.ts';
export {
  formatStructuredTerminalWarningPayload,
  sanitizeDesktopSessionReplay,
  sanitizeDesktopSessionStreamEvent,
} from './terminalRuntimeSanitization.ts';

import {
  createDesktopRuntimeBridgeClient as createUpstreamDesktopRuntimeBridgeClient,
  createTerminalViewAdapter as createUpstreamTerminalViewAdapter,
  type DesktopRuntimeBridgeClient,
} from '../../../../../sdkwork-terminal/packages/sdkwork-terminal-infrastructure/src/index.ts';
import {
  sanitizeDesktopSessionReplay,
  sanitizeDesktopSessionStreamEvent,
} from './terminalRuntimeSanitization.ts';

function wrapDesktopSessionReplay(
  client: DesktopRuntimeBridgeClient,
): DesktopRuntimeBridgeClient['sessionReplay'] {
  return async (sessionId, request) =>
    sanitizeDesktopSessionReplay(await client.sessionReplay(sessionId, request));
}

function wrapDesktopSessionEventSubscription(
  subscribe:
    | DesktopRuntimeBridgeClient['subscribeSessionEvents']
    | DesktopRuntimeBridgeClient['subscribeLocalShellSessionEvents'],
): typeof subscribe {
  if (!subscribe) {
    return subscribe;
  }

  return (async (sessionId, listener) =>
    subscribe(sessionId, (event) => {
      listener(sanitizeDesktopSessionStreamEvent(event));
    })) as typeof subscribe;
}

export function createDesktopRuntimeBridgeClient(
  ...args: Parameters<typeof createUpstreamDesktopRuntimeBridgeClient>
): ReturnType<typeof createUpstreamDesktopRuntimeBridgeClient> {
  const upstreamClient = createUpstreamDesktopRuntimeBridgeClient(...args);

  return {
    ...upstreamClient,
    sessionReplay: wrapDesktopSessionReplay(upstreamClient),
    subscribeSessionEvents: wrapDesktopSessionEventSubscription(
      upstreamClient.subscribeSessionEvents,
    ),
    subscribeLocalShellSessionEvents: wrapDesktopSessionEventSubscription(
      upstreamClient.subscribeLocalShellSessionEvents,
    ),
  };
}

export const createTerminalViewAdapter = createUpstreamTerminalViewAdapter;
