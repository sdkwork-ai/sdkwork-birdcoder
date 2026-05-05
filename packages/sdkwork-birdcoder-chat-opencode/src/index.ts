import {
  buildMessageTranscriptPrompt,
  canonicalEventsFromChatStream,
  canonicalizeBirdCoderCodeEngineProviderToolName,
  createDetectedHealthReport,
  createDefaultChatCanonicalRuntimeDescriptor,
  createDefaultChatEngineCapabilitySnapshot,
  createLocalChatEngineState,
  createModuleBackedOfficialSdkBridgeLoader,
  createRawExtensionDescriptor,
  readRuntimeEnvValue,
  createRuntimeIntegrationDescriptor,
  resolveRuntimeWorkingDirectory,
  createTextChatResponse,
  createTextStreamChunk,
  createToolCallStreamChunk,
  invokeWithOptionalOfficialSdk,
  normalizeProviderToolArgumentRecord,
  parseBirdCoderApiJson,
  resolveCumulativeTextDelta,
  resolvePackagePresence,
  streamResponseAsChunks,
  streamWithOptionalOfficialSdk,
  normalizeBirdCoderCodeEngineToolLifecycleStatus,
  resolveBirdCoderCodeEngineApprovalRuntimeStatus,
  stringifyProviderToolArgumentPayload,
  type ChatCanonicalEvent,
  type ChatContext,
  type ChatEngineOfficialSdkBridge,
  type ChatEngineOfficialSdkBridgeLoader,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
  type IChatCodingSession,
  type IChatEngine,
  type IChatSession,
  type ToolCall,
} from '@sdkwork/birdcoder-chat';

const OPENCODE_PACKAGE_PRESENCE_INPUT = {
  packageName: '@opencode-ai/sdk',
  mirrorPackageJsonPath: 'external/opencode/packages/sdk/js/package.json',
} as const;
const OPENCODE_SUPPLEMENTAL_LANES = ['OpenAPI', 'SSE', 'server mode'] as const;

function resolveOpenCodePackagePresence() {
  return resolvePackagePresence(OPENCODE_PACKAGE_PRESENCE_INPUT);
}

function createOpenCodeIntegrationDescriptor() {
  return createRuntimeIntegrationDescriptor({
    engineId: 'opencode',
    runtimeMode: 'sdk',
    transportKinds: ['sdk-stream', 'cli-jsonl', 'openapi-http'],
    sourceMirrorPath: 'external/opencode/packages/sdk/js',
    packagePresence: resolveOpenCodePackagePresence(),
    officialEntry: {
      packageName: '@opencode-ai/sdk',
      cliPackageName: 'opencode-ai',
      sdkPath: 'external/opencode/packages/sdk/js',
      sourceMirrorPath: 'external/opencode/packages/sdk/js',
      supplementalLanes: OPENCODE_SUPPLEMENTAL_LANES,
    },
    notes: 'BirdCoder uses the official OpenCode SDK as the primary client and server adapter lane.',
  });
}

const OPENCODE_RAW_EXTENSIONS = createRawExtensionDescriptor({
  provider: 'opencode',
  primaryLane: 'session-part-artifact-event',
  supplementalLanes: OPENCODE_SUPPLEMENTAL_LANES,
  nativeEventModel: ['session.updated', 'part.delta', 'artifact.created', 'event.subscribed'],
  nativeArtifactModel: ['diff', 'todo', 'pty', 'question'],
  experimentalFeatures: ['server-mode', 'sse-subscriptions'],
  notes: 'OpenCode raw lane preserves client/server duality and native artifact streams.',
});

export interface OpenCodeChatEngineOptions {
  officialSdkBridgeLoader?: ChatEngineOfficialSdkBridgeLoader | null;
  openCodeCliJsonlTurnExecutor?:
    | ((prompt: string, options?: ChatOptions) => AsyncIterable<Record<string, unknown>> | Promise<AsyncIterable<Record<string, unknown>>>)
    | null;
}

interface NodeRuntimeProcess {
  cwd(): string;
  env: NodeJS.ProcessEnv;
  platform: string;
  versions?: {
    node?: string;
  };
  getBuiltinModule?: (id: string) => unknown;
}

interface NodeReadableStreamLike {
  on(event: 'data', listener: (chunk: unknown) => void): void;
}

interface NodeWritableStreamLike {
  write(chunk: string): void;
  end(): void;
}

interface NodeChildProcessLike {
  stdin: NodeWritableStreamLike | null;
  stdout: NodeReadableStreamLike | null;
  stderr: NodeReadableStreamLike | null;
  kill(signal?: NodeJS.Signals | number): boolean;
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'close', listener: (code: number | null) => void): this;
}

interface NodeChildProcessModule {
  spawn(
    command: string,
    args?: readonly string[],
    options?: {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      stdio?: ['pipe', 'pipe', 'pipe'];
      windowsHide?: boolean;
    },
  ): NodeChildProcessLike;
}

interface OpenCodeSessionRecord {
  id: string;
}

interface OpenCodeCliCommandSpec {
  command: string;
  prefixArgs: readonly string[];
}

interface OpenCodeCliInvocation {
  command: string;
  args: readonly string[];
  workingDirectory: string;
}

interface OpenCodeSseResult {
  stream: AsyncIterable<unknown>;
}

interface OpenCodeSessionApi {
  create: (options?: Record<string, unknown>) => Promise<OpenCodeSessionRecord>;
  prompt: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
  promptAsync?: (options: Record<string, unknown>) => Promise<unknown>;
}

interface OpenCodeEventApi {
  subscribe?: (options?: Record<string, unknown>) => Promise<OpenCodeSseResult>;
}

interface OpenCodeSdkClient {
  session: OpenCodeSessionApi;
  event?: OpenCodeEventApi;
}

const OPENCODE_CLI_UNAVAILABLE_MESSAGE =
  'OpenCode CLI runtime is unavailable. Install OpenCode CLI and ensure the `opencode` command is on PATH, or install `@opencode-ai/sdk`.';
const OPENCODE_CLI_AUTHENTICATION_MESSAGE =
  'OpenCode CLI authentication is not configured. Configure the provider API key required by your selected OpenCode model before using the opencode engine.';

function getRuntimeProcess(): NodeRuntimeProcess | null {
  const runtime = globalThis as typeof globalThis & {
    process?: NodeRuntimeProcess;
  };
  return runtime.process ?? null;
}

function isNodeRuntime(): boolean {
  return Boolean(getRuntimeProcess()?.versions?.node);
}

function getBuiltinModule<T>(id: string): T | null {
  return getRuntimeProcess()?.getBuiltinModule?.(id) as T | null;
}

function createOpenCodeCliCommandSpec(): OpenCodeCliCommandSpec {
  const runtimeProcess = getRuntimeProcess();
  return runtimeProcess?.platform === 'win32'
    ? {
        command: runtimeProcess.env.ComSpec || 'cmd.exe',
        prefixArgs: ['/d', '/s', '/c', 'opencode'],
      }
    : {
        command: 'opencode',
        prefixArgs: [],
      };
}

function buildOpenCodePrompt(messages: readonly ChatMessage[]): string {
  const nonSystemMessages = messages.filter((message) => message.role !== 'system');
  return buildMessageTranscriptPrompt(nonSystemMessages.length ? nonSystemMessages : messages)
    || 'Prepare the next artifact update.';
}

function buildOpenCodeSystemPrompt(messages: readonly ChatMessage[]): string | undefined {
  const systemMessages = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean);

  return systemMessages.length ? systemMessages.join('\n\n') : undefined;
}

function normalizeOpenCodePromptModel(
  value: string | null | undefined,
): { providerID: string; modelID: string } | null {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return null;
  }

  const normalizedModelKey = normalizedValue.toLowerCase();
  if (
    normalizedModelKey === 'opencode'
    || normalizedModelKey === 'open-code'
    || normalizedModelKey === 'open code'
  ) {
    return null;
  }

  const separatorIndex = normalizedValue.indexOf('/');
  if (separatorIndex < 1 || separatorIndex === normalizedValue.length - 1) {
    return null;
  }

  const providerID = normalizedValue.slice(0, separatorIndex).trim();
  const modelID = normalizedValue.slice(separatorIndex + 1).trim();
  return providerID && modelID
    ? {
      providerID,
      modelID,
    }
    : null;
}

function buildOpenCodeCliInvocation(
  prompt: string,
  options?: ChatOptions,
): OpenCodeCliInvocation {
  const commandSpec = createOpenCodeCliCommandSpec();
  const workingDirectory =
    options?.context?.workspaceRoot?.trim() || resolveRuntimeWorkingDirectory();
  const args = [
    ...commandSpec.prefixArgs,
    'run',
    '--format',
    'json',
  ];
  const promptModel = normalizeOpenCodePromptModel(options?.model);
  if (promptModel) {
    args.push('--model', `${promptModel.providerID}/${promptModel.modelID}`);
  }
  if (workingDirectory) {
    args.push('--dir', workingDirectory);
  }
  args.push(prompt);

  return {
    command: commandSpec.command,
    args,
    workingDirectory,
  };
}

function isOpenCodeCliAuthenticationError(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();
  return (
    normalizedMessage.includes('auth') ||
    normalizedMessage.includes('login') ||
    normalizedMessage.includes('api key') ||
    normalizedMessage.includes('unauthorized') ||
    normalizedMessage.includes('forbidden')
  );
}

function isOpenCodeCliUnavailableError(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();
  return (
    normalizedMessage.includes('enoent') ||
    normalizedMessage.includes('not recognized') ||
    normalizedMessage.includes('not found') ||
    normalizedMessage.includes('command not found')
  );
}

function formatOpenCodeCliError(message: string): string {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return 'OpenCode CLI turn failed.';
  }

  if (isOpenCodeCliAuthenticationError(normalizedMessage)) {
    return OPENCODE_CLI_AUTHENTICATION_MESSAGE;
  }

  if (isOpenCodeCliUnavailableError(normalizedMessage)) {
    return OPENCODE_CLI_UNAVAILABLE_MESSAGE;
  }

  return normalizedMessage;
}

function parseOpenCodeCliJsonlLine(line: string): Record<string, unknown> {
  try {
    return parseBirdCoderApiJson<Record<string, unknown>>(line);
  } catch (error) {
    throw new Error(
      `OpenCode CLI JSONL parse failed: ${error instanceof Error ? error.message : String(error)}. Line: ${line}`,
    );
  }
}

function readOpenCodeCliTurnError(events: readonly Record<string, unknown>[]): string | null {
  return events
    .map((event) =>
      event.type === 'error'
        ? getOpenCodeCliEventErrorMessage(event)
        : '',
    )
    .find((message) => message.trim().length > 0) ?? null;
}

async function* streamOpenCodeCliJsonlTurn(
  prompt: string,
  options?: ChatOptions,
): AsyncGenerator<Record<string, unknown>, void, unknown> {
  if (!isNodeRuntime()) {
    throw new Error(OPENCODE_CLI_UNAVAILABLE_MESSAGE);
  }

  const childProcessModule = getBuiltinModule<NodeChildProcessModule>('node:child_process');
  const runtimeProcess = getRuntimeProcess();
  if (!childProcessModule || !runtimeProcess) {
    throw new Error(OPENCODE_CLI_UNAVAILABLE_MESSAGE);
  }

  const invocation = buildOpenCodeCliInvocation(prompt, options);
  let child: NodeChildProcessLike;
  try {
    child = childProcessModule.spawn(invocation.command, invocation.args, {
      cwd: invocation.workingDirectory || undefined,
      env: runtimeProcess.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (error) {
    throw new Error(
      formatOpenCodeCliError(error instanceof Error ? error.message : String(error)),
    );
  }

  if (!child.stdin || !child.stdout || !child.stderr) {
    throw new Error(OPENCODE_CLI_UNAVAILABLE_MESSAGE);
  }

  let stdout = '';
  let stderr = '';
  let settled = false;
  const queuedEvents: Record<string, unknown>[] = [];
  let notifyQueuedEvent: (() => void) | null = null;
  let streamError: Error | null = null;

  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
    const lines = stdout.split(/\r?\n/);
    stdout = lines.pop() ?? '';
    for (const line of lines.map((entry) => entry.trim()).filter(Boolean)) {
      try {
        queuedEvents.push(parseOpenCodeCliJsonlLine(line));
      } catch (error) {
        streamError = error instanceof Error ? error : new Error(String(error));
      }
    }
    notifyQueuedEvent?.();
    notifyQueuedEvent = null;
  });
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });

  const waitForExit = new Promise<number>((resolve, reject) => {
    child.once('error', (error) => {
      settled = true;
      reject(error);
    });
    child.once('close', (code) => {
      settled = true;
      resolve(code ?? -1);
    });
  });

  const abortSignal = options?.signal;
  const handleAbort = () => {
    if (!settled) {
      child.kill();
    }
  };

  abortSignal?.addEventListener('abort', handleAbort);

  try {
    child.stdin.end();

    let exitCode: number | null = null;
    const exitCodePromise = waitForExit.then((code) => {
      exitCode = code;
      notifyQueuedEvent?.();
      notifyQueuedEvent = null;
      return code;
    });
    const yieldedEvents: Record<string, unknown>[] = [];

    while (exitCode === null || queuedEvents.length > 0) {
      if (streamError) {
        throw streamError;
      }

      const event = queuedEvents.shift();
      if (event) {
        yieldedEvents.push(event);
        yield event;
        continue;
      }

      if (exitCode !== null) {
        break;
      }

      await new Promise<void>((resolve) => {
        notifyQueuedEvent = resolve;
      });
    }

    await exitCodePromise;

    if (stdout.trim()) {
      for (const line of stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)) {
        const event = parseOpenCodeCliJsonlLine(line);
        yieldedEvents.push(event);
        yield event;
      }
    }

    const turnError = readOpenCodeCliTurnError(yieldedEvents);
    if (turnError) {
      throw new Error(formatOpenCodeCliError(turnError));
    }

    if (exitCode !== 0) {
      throw new Error(
        formatOpenCodeCliError(
          stderr.trim() || `OpenCode CLI exited with status ${exitCode}.`,
        ),
      );
    }
  } catch (error) {
    throw new Error(
      formatOpenCodeCliError(error instanceof Error ? error.message : String(error)),
    );
  } finally {
    abortSignal?.removeEventListener('abort', handleAbort);
  }
}

function extractOpenCodeText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => extractOpenCodeText(entry)).filter(Boolean).join('');
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return record.text;
  }
  if (typeof record.delta === 'string') {
    return record.delta;
  }

  return ['parts', 'message', 'content', 'properties']
    .map((key) => extractOpenCodeText(record[key]))
    .find(Boolean) ?? '';
}

function createOpenCodePromptBody(
  messages: readonly ChatMessage[],
  model: string | null | undefined,
): Record<string, unknown> {
  const promptBody: Record<string, unknown> = {
    system: buildOpenCodeSystemPrompt(messages),
    parts: [
      {
        type: 'text',
        text: buildOpenCodePrompt(messages),
      },
    ],
  };

  const promptModel = normalizeOpenCodePromptModel(model);
  if (promptModel) {
    promptBody.model = promptModel;
  }

  return promptBody;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

function getOpenCodeEventType(event: Record<string, unknown>): string | null {
  return typeof event.type === 'string' ? event.type : null;
}

function getOpenCodeEventProperties(
  event: Record<string, unknown>,
): Record<string, unknown> {
  return asRecord(event.properties) ?? {};
}

function getOpenCodeEventSessionId(
  event: Record<string, unknown>,
): string | null {
  const properties = getOpenCodeEventProperties(event);
  if (typeof properties.sessionID === 'string') {
    return properties.sessionID;
  }

  const info = asRecord(properties.info);
  if (typeof info?.id === 'string') {
    return info.id;
  }

  const part = asRecord(properties.part);
  if (typeof part?.sessionID === 'string') {
    return part.sessionID;
  }

  return null;
}

function normalizeOpenCodeString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return null;
  }
  const normalizedValue = String(value).trim();
  return normalizedValue ? normalizedValue : null;
}

function resolveOpenCodeRequestId(
  properties: Record<string, unknown>,
  fallbackPrefix: string,
): string {
  const tool = asRecord(properties.tool);
  return normalizeOpenCodeString(properties.requestID) ??
    normalizeOpenCodeString(properties.requestId) ??
    normalizeOpenCodeString(properties.id) ??
    normalizeOpenCodeString(properties.callID) ??
    normalizeOpenCodeString(tool?.callID) ??
    `${fallbackPrefix}-${Date.now()}`;
}

function resolveOpenCodePermissionRuntimeStatus(value: unknown): string | undefined {
  return normalizeBirdCoderCodeEngineToolLifecycleStatus(value)
    ? resolveBirdCoderCodeEngineApprovalRuntimeStatus({ status: value })
    : undefined;
}

function toOpenCodeToolCall(
  event: Record<string, unknown>,
): ToolCall | null {
  const eventType = getOpenCodeEventType(event);
  const properties = getOpenCodeEventProperties(event);

  if (eventType === 'permission.asked') {
    const requestId = resolveOpenCodeRequestId(properties, 'opencode-permission');
    return {
      id: requestId,
      type: 'function',
      function: {
        name: 'permission_request',
        arguments: stringifyProviderToolArgumentPayload({
          status: 'awaiting_approval',
          permission: properties.permission,
          patterns: properties.patterns,
          metadata: properties.metadata,
          always: properties.always,
          tool: properties.tool,
        }),
      },
    };
  }

  if (eventType === 'permission.updated') {
    const requestId = resolveOpenCodeRequestId(properties, 'opencode-permission');
    const runtimeStatus = resolveOpenCodePermissionRuntimeStatus(
      properties.status ?? properties.type,
    );
    return {
      id: requestId,
      type: 'function',
      function: {
        name: 'permission_request',
        arguments: stringifyProviderToolArgumentPayload({
          status: properties.status ?? properties.type,
          ...(runtimeStatus ? { runtimeStatus } : {}),
          type: properties.type,
          title: properties.title,
          pattern: properties.pattern,
          metadata: properties.metadata,
        }),
      },
    };
  }

  if (eventType === 'question.asked') {
    const requestId = resolveOpenCodeRequestId(properties, 'opencode-question');
    return {
      id: requestId,
      type: 'function',
      function: {
        name: 'user_question',
        arguments: stringifyProviderToolArgumentPayload({
          status: 'awaiting_user',
          requestId,
          sessionID: properties.sessionID,
          questions: properties.questions,
          tool: properties.tool,
        }),
      },
    };
  }

  if (eventType === 'question.replied') {
    const requestId = resolveOpenCodeRequestId(properties, 'opencode-question');
    const answers = Array.isArray(properties.answers) ? properties.answers : [];
    const answer = answers
      .flatMap((entry) => (Array.isArray(entry) ? entry : []))
      .find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      ?.trim();

    return {
      id: requestId,
      type: 'function',
      function: {
        name: 'user_question',
        arguments: stringifyProviderToolArgumentPayload({
          status: 'completed',
          runtimeStatus: 'awaiting_tool',
          requestId,
          sessionID: properties.sessionID,
          answer,
          answers: properties.answers,
        }),
      },
    };
  }

  if (eventType === 'question.rejected') {
    const requestId = resolveOpenCodeRequestId(properties, 'opencode-question');
    return {
      id: requestId,
      type: 'function',
      function: {
        name: 'user_question',
        arguments: stringifyProviderToolArgumentPayload({
          status: 'rejected',
          runtimeStatus: 'failed',
          requestId,
          sessionID: properties.sessionID,
        }),
      },
    };
  }

  if (eventType !== 'message.part.updated') {
    return null;
  }

  const part = asRecord(properties.part);
  if (!part || part.type !== 'tool') {
    return null;
  }

  return {
    id: String(part.callID ?? part.id ?? `opencode-tool-${Date.now()}`),
    type: 'function',
    function: {
      name: canonicalizeBirdCoderCodeEngineProviderToolName({
        fallbackToolName: 'opencode_tool',
        provider: 'opencode',
        toolName: part.tool,
      }),
      arguments: stringifyProviderToolArgumentPayload(buildOpenCodeToolArguments(part)),
    },
  };
}

function buildOpenCodeToolArguments(
  part: Record<string, unknown>,
): Record<string, unknown> {
  const state = asRecord(part.state);
  const toolArguments = normalizeProviderToolArgumentRecord(state?.input);

  if (state?.status !== undefined && toolArguments.status === undefined) {
    toolArguments.status = state.status;
  }
  if (state?.title !== undefined && toolArguments.title === undefined) {
    toolArguments.title = state.title;
  }
  if (state?.output !== undefined && toolArguments.output === undefined) {
    toolArguments.output = state.output;
  }
  if (state?.result !== undefined && toolArguments.result === undefined) {
    toolArguments.result = state.result;
  }

  toolArguments.openCodeState = part.state ?? null;
  if (part.metadata !== undefined && part.metadata !== null) {
    toolArguments.metadata = part.metadata;
  }

  return toolArguments;
}

function extractOpenCodePromptParts(value: unknown): Record<string, unknown>[] {
  const record = asRecord(value);
  const parts = Array.isArray(record?.parts) ? record.parts : [];
  return parts
    .map(asRecord)
    .filter((part): part is Record<string, unknown> => part !== null);
}

function extractOpenCodePromptToolCalls(value: unknown): ToolCall[] {
  return extractOpenCodePromptParts(value)
    .map((part) => toOpenCodeToolCall({
      type: 'message.part.updated',
      properties: {
        part,
      },
    }))
    .filter((toolCall): toolCall is ToolCall => toolCall !== null);
}

function getOpenCodeTextDelta(
  event: Record<string, unknown>,
  textByPartId: Map<string, string>,
): string {
  const eventType = getOpenCodeEventType(event);
  const properties = getOpenCodeEventProperties(event);
  const part = asRecord(properties.part);
  const partKey = getOpenCodeTextPartKey(properties, part);

  if (eventType === 'message.part.delta') {
    const field = typeof properties.field === 'string' ? properties.field : 'text';
    const delta = field === 'text' && typeof properties.delta === 'string'
      ? properties.delta
      : '';
    if (delta && partKey) {
      textByPartId.set(partKey, `${textByPartId.get(partKey) ?? ''}${delta}`);
    }
    return delta;
  }

  if (eventType !== 'message.part.updated') {
    return '';
  }

  if (typeof properties.delta === 'string') {
    if (partKey) {
      const snapshotText = part?.type === 'text' && typeof part.text === 'string'
        ? part.text
        : null;
      textByPartId.set(
        partKey,
        snapshotText ?? `${textByPartId.get(partKey) ?? ''}${properties.delta}`,
      );
    }
    return properties.delta;
  }

  if (part?.type !== 'text' || typeof part.text !== 'string') {
    return '';
  }

  if (!partKey) {
    return part.text;
  }

  const previousText = textByPartId.get(partKey) ?? '';
  textByPartId.set(partKey, part.text);
  return resolveCumulativeTextDelta(previousText, part.text);
}

function getOpenCodeTextPartKey(
  properties: Record<string, unknown>,
  part: Record<string, unknown> | null,
): string | null {
  const rawPartId = properties.partID ?? properties.partId ?? part?.id;
  if (typeof rawPartId === 'string' || typeof rawPartId === 'number') {
    const partId = String(rawPartId).trim();
    if (partId) {
      return partId;
    }
  }

  const rawMessageId = properties.messageID ?? properties.messageId ?? part?.messageID;
  if (typeof rawMessageId === 'string' || typeof rawMessageId === 'number') {
    const messageId = String(rawMessageId).trim();
    if (messageId) {
      return `${messageId}:text`;
    }
  }

  return null;
}

function getOpenCodeEventErrorMessage(
  event: Record<string, unknown>,
): string {
  const properties = getOpenCodeEventProperties(event);
  const errorRecord = asRecord(properties.error);
  const errorData = asRecord(errorRecord?.data);

  return String(
    errorData?.message ??
    errorRecord?.message ??
    'OpenCode official SDK stream failed.',
  );
}

function getOpenCodeCliEventErrorMessage(
  event: Record<string, unknown>,
): string {
  const errorRecord = asRecord(event.error);
  const errorData = asRecord(errorRecord?.data);

  return String(
    errorData?.message ??
    errorRecord?.message ??
    event.message ??
    event.error ??
    'OpenCode CLI stream failed.',
  );
}

function createUnavailableOpenCodeSdkError(): Error {
  return new Error(
    'OpenCode official SDK bridge and OpenCode CLI fallback are unavailable. Install OpenCode CLI and ensure the `opencode` command is on PATH, or install `@opencode-ai/sdk`.',
  );
}

function normalizeOpenCodeCliEventForPartUpdate(
  event: Record<string, unknown>,
): Record<string, unknown> | null {
  if (event.type !== 'text' && event.type !== 'tool_use') {
    return null;
  }

  const part = asRecord(event.part);
  if (!part) {
    return null;
  }

  return {
    type: 'message.part.updated',
    properties: {
      part,
      partID: part.id,
      sessionID: event.sessionID,
    },
  };
}

export function createOpenCodeOfficialSdkBridge(
  moduleNamespace: Record<string, unknown>,
): ChatEngineOfficialSdkBridge | null {
  const createOpencodeClient = typeof moduleNamespace.createOpencodeClient === 'function'
    ? moduleNamespace.createOpencodeClient as (options?: Record<string, unknown>) => OpenCodeSdkClient
    : null;
  const createOpencode = typeof moduleNamespace.createOpencode === 'function'
    ? moduleNamespace.createOpencode as (options?: Record<string, unknown>) => Promise<{
      client: OpenCodeSdkClient;
    }>
    : null;

  if (!createOpencodeClient && !createOpencode) {
    return null;
  }

  let clientPromise: Promise<OpenCodeSdkClient> | null = null;

  async function resolveClient(options?: ChatOptions) {
    if (!clientPromise) {
      clientPromise = (async () => {
        const directory = options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory();
        const baseUrl = readRuntimeEnvValue('OPENCODE_BASE_URL');

        if (baseUrl && createOpencodeClient) {
          return createOpencodeClient({
            baseUrl,
            directory,
          });
        }

        if (createOpencode) {
          const runtime = await createOpencode();
          return runtime.client;
        }

        if (createOpencodeClient) {
          return createOpencodeClient({
            directory,
          });
        }

        throw new Error(
          'OpenCode official SDK requires OPENCODE_BASE_URL or a runtime that can create a local OpenCode server.',
        );
      })();
    }

    return clientPromise;
  }

  async function createSession(
    client: OpenCodeSdkClient,
    directory: string,
  ): Promise<OpenCodeSessionRecord> {
    const session = await client.session.create({
      query: {
        directory,
      },
      body: {
        title: 'BirdCoder OpenCode SDK session',
      },
    });
    return {
      ...session,
      id: String(session.id),
    };
  }

  return {
    async sendMessage(messages, options) {
      const client = await resolveClient(options);
      const directory = options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory();
      const session = await createSession(client, directory);
      const promptResponse = await client.session.prompt({
        path: {
          id: String(session.id),
        },
        query: {
          directory,
        },
        body: createOpenCodePromptBody(messages, options?.model),
      });

      return createTextChatResponse({
        id: `opencode-chat-${Date.now()}`,
        model: options?.model || 'opencode',
        content: extractOpenCodeText(promptResponse),
        toolCalls: extractOpenCodePromptToolCalls(promptResponse),
      });
    },
    async *sendMessageStream(messages, options) {
      const client = await resolveClient(options);
      const directory = options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory();
      const session = await createSession(client, directory);
      const sessionId = String(session.id);
      const id = `opencode-chat-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      const model = options?.model || 'opencode';
      const textByPartId = new Map<string, string>();

      if (!client.session.promptAsync || !client.event?.subscribe) {
        const promptResponse = await client.session.prompt({
          path: {
            id: sessionId,
          },
          query: {
            directory,
          },
          body: createOpenCodePromptBody(messages, options?.model),
        });
        yield* streamResponseAsChunks(createTextChatResponse({
          id,
          created,
          model,
          content: extractOpenCodeText(promptResponse),
          toolCalls: extractOpenCodePromptToolCalls(promptResponse),
        }));
        return;
      }

      const eventStream = await client.event.subscribe({
        query: {
          directory,
        },
      });

      await client.session.promptAsync({
        path: {
          id: sessionId,
        },
        query: {
          directory,
        },
        body: createOpenCodePromptBody(messages, options?.model),
      });

      for await (const rawEvent of eventStream.stream) {
        const event = asRecord(rawEvent);
        if (!event) {
          continue;
        }

        const eventSessionId = getOpenCodeEventSessionId(event);
        if (eventSessionId && eventSessionId !== sessionId) {
          continue;
        }

        const eventType = getOpenCodeEventType(event);
        if (!eventType) {
          continue;
        }

        if (eventType === 'session.error') {
          throw new Error(getOpenCodeEventErrorMessage(event));
        }

        if (eventType === 'session.idle') {
          yield createTextStreamChunk({
            id,
            created,
            model,
            finishReason: 'stop',
          });
          return;
        }

        const textDelta = getOpenCodeTextDelta(event, textByPartId);
        if (textDelta) {
          yield createTextStreamChunk({
            id,
            created,
            model,
            role: 'assistant',
            content: textDelta,
          });
        }

        const toolCall = toOpenCodeToolCall(event);
        if (toolCall) {
          yield createToolCallStreamChunk({
            id,
            created,
            model,
            toolCall,
          });
        }
      }

      yield createTextStreamChunk({
        id,
        created,
        model,
        finishReason: 'stop',
      });
    },
  };
}

const DEFAULT_OPENCODE_OFFICIAL_SDK_BRIDGE_LOADER = createModuleBackedOfficialSdkBridgeLoader({
  candidates: [
    {
      kind: 'package',
      specifier: '@opencode-ai/sdk',
    },
    {
      kind: 'path',
      specifier: 'external/opencode/packages/sdk/js/src/index.ts',
    },
  ],
  createBridge: createOpenCodeOfficialSdkBridge,
});

export class OpenCodeChatEngine implements IChatEngine {
  name = 'opencode-sdk-adapter';
  version = '1.2.0';

  private readonly officialSdkBridgeLoader: ChatEngineOfficialSdkBridgeLoader | null;
  private readonly openCodeCliJsonlTurnExecutor:
    | ((prompt: string, options?: ChatOptions) => AsyncIterable<Record<string, unknown>> | Promise<AsyncIterable<Record<string, unknown>>>)
    | null;
  private readonly localState = createLocalChatEngineState();

  constructor(options: OpenCodeChatEngineOptions = {}) {
    this.officialSdkBridgeLoader =
      'officialSdkBridgeLoader' in options
        ? options.officialSdkBridgeLoader ?? null
        : DEFAULT_OPENCODE_OFFICIAL_SDK_BRIDGE_LOADER;
    this.openCodeCliJsonlTurnExecutor =
      options.openCodeCliJsonlTurnExecutor === undefined
        ? streamOpenCodeCliJsonlTurn
        : options.openCodeCliJsonlTurnExecutor;
  }

  describeIntegration() {
    return createOpenCodeIntegrationDescriptor();
  }

  describeRawExtensions() {
    return OPENCODE_RAW_EXTENSIONS;
  }

  describeRuntime(options?: ChatOptions) {
    return createDefaultChatCanonicalRuntimeDescriptor({
      descriptor: this.describeIntegration(),
      health: this.getHealth(),
      options,
    });
  }

  getCapabilities() {
    return createDefaultChatEngineCapabilitySnapshot({
      health: this.getHealth(),
      experimentalCapabilities: OPENCODE_RAW_EXTENSIONS.experimentalFeatures,
    });
  }

  getHealth() {
    return createDetectedHealthReport({
      descriptor: this.describeIntegration(),
      packagePresence: resolveOpenCodePackagePresence(),
      executable: 'opencode',
      authEnvKeys: ['OPENCODE_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY'],
      fallbackRuntimeMode: 'headless',
    });
  }

  async *sendCanonicalEvents(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<ChatCanonicalEvent, void, unknown> {
    yield* canonicalEventsFromChatStream({
      messages,
      runtime: this.describeRuntime(options),
      stream: this.sendMessageStream(messages, options),
    });
  }

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return invokeWithOptionalOfficialSdk({
      loader: this.officialSdkBridgeLoader,
      messages,
      options,
      fallback: async () => this.sendMessageViaOpenCodeCli(messages, options),
    });
  }

  async *sendMessageStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    yield* streamWithOptionalOfficialSdk({
      loader: this.officialSdkBridgeLoader,
      messages,
      options,
      fallback: async function* fallbackStream(_streamOptions) {
        yield* this.streamMessageViaOpenCodeCli(messages, _streamOptions);
      }.bind(this),
    });
  }

  private async resolveOpenCodeCliEvents(
    prompt: string,
    options?: ChatOptions,
  ): Promise<AsyncIterable<Record<string, unknown>>> {
    if (!this.openCodeCliJsonlTurnExecutor) {
      throw createUnavailableOpenCodeSdkError();
    }
    return this.openCodeCliJsonlTurnExecutor(prompt, options);
  }

  private async sendMessageViaOpenCodeCli(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const prompt = buildOpenCodePrompt(messages);
    const textByPartId = new Map<string, string>();
    let responseText = '';
    const toolCalls: ToolCall[] = [];

    for await (const event of await this.resolveOpenCodeCliEvents(prompt, options)) {
      if (event.type === 'error') {
        throw new Error(formatOpenCodeCliError(getOpenCodeCliEventErrorMessage(event)));
      }

      const partUpdateEvent = normalizeOpenCodeCliEventForPartUpdate(event);
      if (!partUpdateEvent) {
        continue;
      }

      const textDelta = getOpenCodeTextDelta(partUpdateEvent, textByPartId);
      if (textDelta) {
        responseText += textDelta;
      }

      const toolCall = toOpenCodeToolCall(partUpdateEvent);
      if (toolCall) {
        toolCalls.push(toolCall);
      }
    }

    if (!responseText && toolCalls.length === 0) {
      throw new Error('OpenCode CLI did not return an assistant response.');
    }

    return createTextChatResponse({
      id: `opencode-chat-${Date.now()}`,
      model: options?.model || 'opencode',
      content: responseText,
      toolCalls,
    });
  }

  private async *streamMessageViaOpenCodeCli(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const id = `opencode-chat-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = options.model || 'opencode';
    const textByPartId = new Map<string, string>();
    const prompt = buildOpenCodePrompt(messages);

    for await (const event of await this.resolveOpenCodeCliEvents(prompt, options)) {
      if (event.type === 'error') {
        throw new Error(formatOpenCodeCliError(getOpenCodeCliEventErrorMessage(event)));
      }

      const partUpdateEvent = normalizeOpenCodeCliEventForPartUpdate(event);
      if (!partUpdateEvent) {
        continue;
      }

      const textDelta = getOpenCodeTextDelta(partUpdateEvent, textByPartId);
      if (textDelta) {
        yield createTextStreamChunk({
          id,
          created,
          model,
          role: 'assistant',
          content: textDelta,
        });
      }

      const toolCall = toOpenCodeToolCall(partUpdateEvent);
      if (toolCall) {
        yield createToolCallStreamChunk({
          id,
          created,
          model,
          toolCall,
        });
      }
    }

    yield createTextStreamChunk({
      id,
      created,
      model,
      finishReason: 'stop',
    });
  }

  createSession(projectId: string): Promise<IChatSession> {
    return this.localState.createSession(projectId);
  }

  getSession(sessionId: string): Promise<IChatSession | null> {
    return this.localState.getSession(sessionId);
  }

  createCodingSession(sessionId: string, title?: string): Promise<IChatCodingSession> {
    return this.localState.createCodingSession(sessionId, title);
  }

  getCodingSession(codingSessionId: string): Promise<IChatCodingSession | null> {
    return this.localState.getCodingSession(codingSessionId);
  }

  addMessageToCodingSession(codingSessionId: string, message: ChatMessage): Promise<void> {
    return this.localState.addMessageToCodingSession(codingSessionId, message);
  }

  updateContext(context: ChatContext): void {
    this.localState.updateContext(context);
  }

  onToolCall(toolCall: ToolCall): Promise<string> {
    return this.localState.onToolCall(toolCall);
  }
}
