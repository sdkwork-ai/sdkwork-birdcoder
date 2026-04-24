import type {
  DesktopReplayEntrySnapshot,
  DesktopSessionReplaySnapshot,
  DesktopSessionStreamEvent,
} from '../../../../../sdkwork-terminal/packages/sdkwork-terminal-infrastructure/src/index.ts';

interface StructuredTerminalWarningPayload {
  code?: unknown;
  message?: unknown;
  phase?: unknown;
  program?: unknown;
  retryable?: unknown;
  status?: unknown;
}

function isStructuredTerminalWarningPayload(
  value: unknown,
): value is StructuredTerminalWarningPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function formatStructuredTerminalWarningPayload(payload: string): string | null {
  const normalizedPayload = payload.trim();
  if (!normalizedPayload.startsWith('{') || !normalizedPayload.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalizedPayload) as unknown;
    if (!isStructuredTerminalWarningPayload(parsed)) {
      return null;
    }

    const message =
      typeof parsed.message === 'string' && parsed.message.trim().length > 0
        ? parsed.message.trim()
        : 'Terminal runtime warning';
    const details: string[] = [];

    if (typeof parsed.code === 'string' && parsed.code.trim().length > 0) {
      details.push(`code: ${parsed.code.trim()}`);
    }
    if (typeof parsed.phase === 'string' && parsed.phase.trim().length > 0) {
      details.push(`phase: ${parsed.phase.trim()}`);
    }
    if (
      typeof parsed.status === 'number' ||
      (typeof parsed.status === 'string' && parsed.status.trim().length > 0)
    ) {
      details.push(`status: ${String(parsed.status).trim()}`);
    }
    if (typeof parsed.program === 'string' && parsed.program.trim().length > 0) {
      details.push(`program: ${parsed.program.trim()}`);
    }
    if (typeof parsed.retryable === 'boolean') {
      details.push(parsed.retryable ? 'retryable' : 'not retryable');
    }

    return details.length > 0 ? `${message} (${details.join(', ')})` : message;
  } catch {
    return null;
  }
}

function sanitizeDesktopReplayEntry(
  entry: DesktopReplayEntrySnapshot,
): DesktopReplayEntrySnapshot | null {
  if (entry.kind === 'state' || entry.kind === 'marker') {
    return null;
  }

  if (entry.kind === 'warning') {
    const warningPayload = typeof entry.payload === 'string' ? entry.payload : '';
    const formattedPayload = formatStructuredTerminalWarningPayload(warningPayload);
    if (formattedPayload) {
      return {
        ...entry,
        payload: formattedPayload,
      };
    }
  }

  return entry;
}

export function sanitizeDesktopSessionReplay(
  replay: DesktopSessionReplaySnapshot,
): DesktopSessionReplaySnapshot {
  const entries = replay.entries.flatMap((entry) => {
    const sanitizedEntry = sanitizeDesktopReplayEntry(entry);
    return sanitizedEntry ? [sanitizedEntry] : [];
  });

  return entries === replay.entries
    ? replay
    : {
        ...replay,
        entries,
      };
}

export function sanitizeDesktopSessionStreamEvent(
  event: DesktopSessionStreamEvent,
): DesktopSessionStreamEvent {
  if (event.entry.kind !== 'warning') {
    return event;
  }

  const warningPayload = typeof event.entry.payload === 'string' ? event.entry.payload : '';
  const formattedPayload = formatStructuredTerminalWarningPayload(warningPayload);
  if (!formattedPayload) {
    return event;
  }

  return {
    ...event,
    entry: {
      ...event.entry,
      payload: formattedPayload,
    },
  };
}
