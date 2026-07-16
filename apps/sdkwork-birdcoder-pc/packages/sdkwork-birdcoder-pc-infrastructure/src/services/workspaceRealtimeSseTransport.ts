import {
  RUNTIME_SERVER_ACCESS_TOKEN_HEADER_NAME,
  RUNTIME_SERVER_AUTHORIZATION_HEADER_NAME,
} from './runtimeServerSession.ts';
import {
  resolveWorkspaceRealtimeDualTokenCredentials,
  type WorkspaceRealtimeSessionHeaderResolver,
} from './workspaceRealtimeAuthentication.ts';
import { BirdCoderApiTransportError } from '@sdkwork/birdcoder-pc-types/apiTransportError';

const DEFAULT_MAX_SSE_BUFFER_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_SSE_LINE_BYTES = 64 * 1024;
const DEFAULT_MAX_SSE_EVENT_BYTES = 1024 * 1024;
const DEFAULT_MAX_SSE_EVENT_LINES = 4_096;
const MAX_SSE_RETRY_MS = 5 * 60 * 1000;

export interface WorkspaceRealtimeSseEvent {
  data: string;
  event: string;
  lastEventId: string;
}

export interface WorkspaceRealtimeSseParserLimits {
  maxBufferBytes?: number;
  maxEventBytes?: number;
  maxEventLines?: number;
  maxLineBytes?: number;
}

export interface WorkspaceRealtimeSseSubscription {
  close(): void;
}

export interface CreateWorkspaceRealtimeSseTransportOptions {
  fetchImpl?: typeof fetch;
  limits?: WorkspaceRealtimeSseParserLimits;
  onError: (error: Error) => void;
  onEvent: (event: WorkspaceRealtimeSseEvent) => void;
  onOpen?: () => void;
  resolveHeaders?: WorkspaceRealtimeSessionHeaderResolver;
  url: string;
}

function normalizePositiveLimit(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && (value ?? 0) > 0
    ? value ?? fallback
    : fallback;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export class BoundedWorkspaceRealtimeSseParser {
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private readonly maxBufferBytes: number;
  private readonly maxEventBytes: number;
  private readonly maxEventLines: number;
  private readonly maxLineBytes: number;
  private readonly onEvent: (event: WorkspaceRealtimeSseEvent) => void;
  private dataLines: string[] = [];
  private eventBytes = 0;
  private eventType = '';
  private lastEventId = '';
  private pendingText = '';
  private started = false;
  private retryMs: number | null = null;

  constructor(
    onEvent: (event: WorkspaceRealtimeSseEvent) => void,
    limits: WorkspaceRealtimeSseParserLimits = {},
  ) {
    this.onEvent = onEvent;
    this.maxBufferBytes = normalizePositiveLimit(
      limits.maxBufferBytes,
      DEFAULT_MAX_SSE_BUFFER_BYTES,
    );
    this.maxLineBytes = normalizePositiveLimit(
      limits.maxLineBytes,
      DEFAULT_MAX_SSE_LINE_BYTES,
    );
    this.maxEventBytes = normalizePositiveLimit(
      limits.maxEventBytes,
      DEFAULT_MAX_SSE_EVENT_BYTES,
    );
    this.maxEventLines = normalizePositiveLimit(
      limits.maxEventLines,
      DEFAULT_MAX_SSE_EVENT_LINES,
    );
  }

  get reconnectionTimeMs(): number | null {
    return this.retryMs;
  }

  push(chunk: Uint8Array): void {
    if (chunk.byteLength > this.maxBufferBytes) {
      throw new Error('Workspace realtime SSE read buffer exceeded its limit.');
    }
    this.consumeDecodedText(this.decoder.decode(chunk, { stream: true }), false);
  }

  finish(): void {
    this.consumeDecodedText(this.decoder.decode(), true);
    if (this.pendingText.length > 0) {
      this.processLine(this.pendingText);
      this.pendingText = '';
    }
    if (this.dataLines.length > 0 || this.eventType.length > 0) {
      throw new Error('Workspace realtime SSE ended with an incomplete event frame.');
    }
  }

  private consumeDecodedText(decodedText: string, final: boolean): void {
    let text = decodedText;
    if (!this.started && text.length > 0) {
      this.started = true;
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }
    }

    const input = this.pendingText + text;
    let lineStart = 0;
    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      if (character !== '\n' && character !== '\r') {
        continue;
      }
      if (character === '\r' && index === input.length - 1 && !final) {
        break;
      }

      this.processLine(input.slice(lineStart, index));
      if (character === '\r' && input[index + 1] === '\n') {
        index += 1;
      }
      lineStart = index + 1;
    }

    this.pendingText = input.slice(lineStart);
    const pendingBytes = utf8ByteLength(this.pendingText);
    if (pendingBytes > this.maxLineBytes || pendingBytes > this.maxBufferBytes) {
      throw new Error('Workspace realtime SSE line exceeded its limit.');
    }
  }

  private processLine(line: string): void {
    if (utf8ByteLength(line) > this.maxLineBytes) {
      throw new Error('Workspace realtime SSE line exceeded its limit.');
    }
    if (line.length === 0) {
      this.dispatchEvent();
      return;
    }
    if (line.startsWith(':')) {
      return;
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex < 0 ? line : line.slice(0, separatorIndex);
    let value = separatorIndex < 0 ? '' : line.slice(separatorIndex + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    if (field === 'data') {
      if (this.dataLines.length >= this.maxEventLines) {
        throw new Error('Workspace realtime SSE event line count exceeded its limit.');
      }
      const valueBytes = utf8ByteLength(value) + 1;
      if (this.eventBytes + valueBytes > this.maxEventBytes) {
        throw new Error('Workspace realtime SSE event exceeded its limit.');
      }
      this.eventBytes += valueBytes;
      this.dataLines.push(value);
      return;
    }
    if (field === 'event') {
      this.eventType = value;
      return;
    }
    if (field === 'id' && !value.includes('\u0000')) {
      this.lastEventId = value;
      return;
    }
    if (field === 'retry' && /^\d+$/u.test(value)) {
      const retryMs = Number(value);
      if (Number.isSafeInteger(retryMs)) {
        this.retryMs = Math.min(retryMs, MAX_SSE_RETRY_MS);
      }
    }
  }

  private dispatchEvent(): void {
    if (this.dataLines.length === 0) {
      this.eventType = '';
      this.eventBytes = 0;
      return;
    }

    const event: WorkspaceRealtimeSseEvent = {
      data: this.dataLines.join('\n'),
      event: this.eventType || 'message',
      lastEventId: this.lastEventId,
    };
    this.dataLines = [];
    this.eventType = '';
    this.eventBytes = 0;
    this.onEvent(event);
  }
}

function isEventStreamResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return Boolean(
    contentType && /^text\/event-stream(?:\s*;|$)/iu.test(contentType),
  );
}

function normalizeTransportError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error('Workspace realtime SSE transport failed.');
}

async function createSseHttpError(response: Response, url: string): Promise<Error> {
  let problem: Record<string, unknown> = {};
  try {
    const body = await response.text();
    const parsed = body.trim() ? JSON.parse(body) : null;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      problem = parsed as Record<string, unknown>;
    }
  } catch {
    // The HTTP status remains authoritative when a proxy returns a non-JSON body.
  }

  const code = typeof problem.code === 'number' ? problem.code : undefined;
  const detail = typeof problem.detail === 'string' ? problem.detail : undefined;
  const traceId = typeof problem.traceId === 'string'
    ? problem.traceId
    : response.headers.get('x-sdkwork-trace-id') ?? undefined;
  const path = (() => {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.pathname}${parsedUrl.search}`;
    } catch {
      return url;
    }
  })();

  return new BirdCoderApiTransportError({
    code,
    detail,
    httpStatus: response.status,
    method: 'GET',
    path,
    traceId,
  });
}

export function canUseWorkspaceRealtimeSseTransport(): boolean {
  return typeof fetch === 'function' && typeof ReadableStream === 'function';
}

export function createWorkspaceRealtimeSseTransport(
  options: CreateWorkspaceRealtimeSseTransportOptions,
): WorkspaceRealtimeSseSubscription {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Workspace realtime SSE transport is unavailable.');
  }
  const credentials = resolveWorkspaceRealtimeDualTokenCredentials(
    options.resolveHeaders,
  );
  if (!credentials) {
    throw new Error(
      'Workspace realtime requires a complete authenticated IAM token bundle.',
    );
  }

  const controller = new AbortController();
  let terminated = false;
  let errorNotified = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const terminateWithError = async (error: unknown) => {
    if (terminated || errorNotified) {
      return;
    }
    errorNotified = true;
    terminated = true;
    controller.abort();
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // Cancellation is best-effort after a stream/parser failure.
      }
    }
    try {
      options.onError(normalizeTransportError(error));
    } catch {
      // Observers cannot reopen or strand a failed transport.
    }
  };

  const run = async () => {
    await Promise.resolve();
    try {
      const response = await fetchImpl(options.url, {
        cache: 'no-store',
        credentials: 'omit',
        headers: {
          Accept: 'text/event-stream',
          [RUNTIME_SERVER_ACCESS_TOKEN_HEADER_NAME]: credentials.accessToken,
          [RUNTIME_SERVER_AUTHORIZATION_HEADER_NAME]: credentials.authorization,
        },
        method: 'GET',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw await createSseHttpError(response, options.url);
      }
      if (!isEventStreamResponse(response)) {
        throw new Error(
          'Workspace realtime SSE response has an invalid content type.',
        );
      }
      if (!response.body) {
        throw new Error('Workspace realtime SSE response has no readable body.');
      }

      const parser = new BoundedWorkspaceRealtimeSseParser(
        options.onEvent,
        options.limits,
      );
      reader = response.body.getReader();
      if (!terminated) {
        options.onOpen?.();
      }
      while (!terminated) {
        const result = await reader.read();
        if (result.done) {
          parser.finish();
          throw new Error('Workspace realtime SSE stream ended unexpectedly.');
        }
        parser.push(result.value);
      }
    } catch (error) {
      if (!terminated) {
        await terminateWithError(error);
      }
    } finally {
      try {
        reader?.releaseLock();
      } catch {
        // A concurrently aborted browser stream may already have released its reader.
      }
      reader = null;
    }
  };

  void run().catch(() => undefined);
  return {
    close() {
      if (terminated) {
        return;
      }
      terminated = true;
      controller.abort();
      if (reader) {
        void reader.cancel().catch(() => undefined);
      }
    },
  };
}
