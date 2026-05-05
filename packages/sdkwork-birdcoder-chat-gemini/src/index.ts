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
  resolveRuntimeWorkingDirectory,
  createRuntimeIntegrationDescriptor,
  createTextChatResponse,
  createTextStreamChunk,
  createToolCallStreamChunk,
  invokeWithOptionalOfficialSdk,
  normalizeProviderToolArgumentRecord,
  parseBirdCoderApiJson,
  resolveCumulativeTextDelta,
  resolvePackagePresence,
  streamWithOptionalOfficialSdk,
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

const GEMINI_PACKAGE_PRESENCE_INPUT = {
  packageName: '@google/gemini-cli-sdk',
  mirrorPackageJsonPath: 'external/gemini/packages/sdk/package.json',
} as const;
const GEMINI_SUPPLEMENTAL_LANES = ['CLI core runtime', 'tool and skill registry'] as const;

function resolveGeminiPackagePresence() {
  return resolvePackagePresence(GEMINI_PACKAGE_PRESENCE_INPUT);
}

function createGeminiIntegrationDescriptor() {
  return createRuntimeIntegrationDescriptor({
    engineId: 'gemini',
    runtimeMode: 'sdk',
    transportKinds: ['sdk-stream', 'cli-jsonl', 'json-rpc-v2'],
    sourceMirrorPath: 'external/gemini/packages/sdk',
    packagePresence: resolveGeminiPackagePresence(),
    officialEntry: {
      packageName: '@google/gemini-cli-sdk',
      cliPackageName: '@google/gemini-cli',
      sdkPath: 'external/gemini/packages/sdk',
      sourceMirrorPath: 'external/gemini/packages/sdk',
      supplementalLanes: GEMINI_SUPPLEMENTAL_LANES,
    },
    notes: 'BirdCoder uses the Gemini CLI SDK as the primary session and tool orchestration lane.',
  });
}

const GEMINI_RAW_EXTENSIONS = createRawExtensionDescriptor({
  provider: 'gemini',
  primaryLane: 'session-tool-skill-context',
  supplementalLanes: GEMINI_SUPPLEMENTAL_LANES,
  nativeEventModel: ['session.started', 'tool.called', 'skill.loaded', 'context.updated'],
  nativeArtifactModel: ['diagnostic-bundle', 'todo-list', 'question'],
  experimentalFeatures: ['dynamic-instructions', 'skill-registry-hooks'],
  notes: 'Gemini raw lane preserves skills, tool registry hooks, and dynamic instruction assembly.',
});

export interface GeminiChatEngineOptions {
  officialSdkBridgeLoader?: ChatEngineOfficialSdkBridgeLoader | null;
  geminiCliJsonlTurnExecutor?:
    | ((prompt: string, options?: ChatOptions) => AsyncIterable<Record<string, unknown>> | Promise<AsyncIterable<Record<string, unknown>>>)
    | null;
}

function createUnavailableGeminiSdkError(): Error {
  return new Error(
    'Gemini CLI SDK bridge and Gemini CLI fallback are unavailable. Install Gemini CLI and ensure the `gemini` command is on PATH, or install `@google/gemini-cli-sdk`.',
  );
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

interface GeminiCliCommandSpec {
  command: string;
  prefixArgs: readonly string[];
}

interface GeminiCliInvocation {
  command: string;
  args: readonly string[];
  workingDirectory: string;
}

const GEMINI_CLI_UNAVAILABLE_MESSAGE =
  'Gemini CLI runtime is unavailable. Install Gemini CLI and ensure the `gemini` command is on PATH, or install `@google/gemini-cli-sdk`.';
const GEMINI_CLI_AUTHENTICATION_MESSAGE =
  'Gemini CLI authentication is not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY, or authenticate the Gemini CLI before using the gemini engine.';
const GEMINI_AUTH_ENV_KEYS = ['GOOGLE_API_KEY', 'GEMINI_API_KEY'] as const;

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

function createGeminiCliCommandSpec(): GeminiCliCommandSpec {
  const runtimeProcess = getRuntimeProcess();
  return runtimeProcess?.platform === 'win32'
    ? {
        command: runtimeProcess.env.ComSpec || 'cmd.exe',
        prefixArgs: ['/d', '/s', '/c', 'gemini'],
      }
    : {
        command: 'gemini',
        prefixArgs: [],
      };
}

const GEMINI_DEFAULT_PROMPT = 'Inspect the workspace session.';

function buildGeminiInstructions(messages: readonly ChatMessage[]): string {
  const systemMessages = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean);

  return systemMessages.join('\n\n') || 'You are the BirdCoder Gemini official SDK adapter.';
}

function buildGeminiPrompt(messages: readonly ChatMessage[]): string {
  const nonSystemMessages = messages.filter(
    (message) => message.role !== 'system' && message.content.trim(),
  );
  return buildMessageTranscriptPrompt(nonSystemMessages)
    || GEMINI_DEFAULT_PROMPT;
}

function buildGeminiCliPrompt(messages: readonly ChatMessage[]): string {
  return buildMessageTranscriptPrompt(messages) || GEMINI_DEFAULT_PROMPT;
}

function normalizeGeminiRequestedModel(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return null;
  }

  const normalizedModelKey = normalizedValue.toLowerCase();
  return normalizedModelKey === 'gemini'
    || normalizedModelKey === 'gemini cli'
    || normalizedModelKey === 'gemini-cli'
    || normalizedModelKey === 'google gemini'
    ? null
    : normalizedValue;
}

function buildGeminiCliInvocation(
  prompt: string,
  options?: ChatOptions,
): GeminiCliInvocation {
  const commandSpec = createGeminiCliCommandSpec();
  const workingDirectory =
    options?.context?.workspaceRoot?.trim() || resolveRuntimeWorkingDirectory();
  const args = [
    ...commandSpec.prefixArgs,
    '--prompt',
    prompt,
    '--output-format',
    'stream-json',
  ];
  const model = normalizeGeminiRequestedModel(options?.model);
  if (model) {
    args.push('--model', model);
  }

  return {
    command: commandSpec.command,
    args,
    workingDirectory,
  };
}

function isGeminiCliAuthenticationError(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();
  return (
    normalizedMessage.includes('auth') ||
    normalizedMessage.includes('login') ||
    normalizedMessage.includes('api key') ||
    normalizedMessage.includes('unauthorized') ||
    normalizedMessage.includes('oauth')
  );
}

function isGeminiCliUnavailableError(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();
  return (
    normalizedMessage.includes('enoent') ||
    normalizedMessage.includes('not recognized') ||
    normalizedMessage.includes('not found') ||
    normalizedMessage.includes('command not found')
  );
}

function formatGeminiCliError(message: string): string {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return 'Gemini CLI turn failed.';
  }

  if (isGeminiCliAuthenticationError(normalizedMessage)) {
    return GEMINI_CLI_AUTHENTICATION_MESSAGE;
  }

  if (isGeminiCliUnavailableError(normalizedMessage)) {
    return GEMINI_CLI_UNAVAILABLE_MESSAGE;
  }

  return normalizedMessage;
}

function parseGeminiCliJsonlLine(line: string): Record<string, unknown> {
  try {
    return parseBirdCoderApiJson<Record<string, unknown>>(line);
  } catch (error) {
    throw new Error(
      `Gemini CLI JSONL parse failed: ${error instanceof Error ? error.message : String(error)}. Line: ${line}`,
    );
  }
}

function readGeminiCliTurnError(events: readonly Record<string, unknown>[]): string | null {
  return events
    .map((event) => {
      if (event.type === 'error') {
        const severity = typeof event.severity === 'string' ? event.severity : 'error';
        return severity === 'warning'
          ? ''
          : extractGeminiText(event.message ?? event.error ?? event);
      }
      if (event.type === 'result' && event.status === 'error') {
        return extractGeminiText(event.error ?? event.message ?? event);
      }
      return '';
    })
    .find((message) => message.trim().length > 0) ?? null;
}

async function* streamGeminiCliJsonlTurn(
  prompt: string,
  options?: ChatOptions,
): AsyncGenerator<Record<string, unknown>, void, unknown> {
  if (!isNodeRuntime()) {
    throw new Error(GEMINI_CLI_UNAVAILABLE_MESSAGE);
  }

  const childProcessModule = getBuiltinModule<NodeChildProcessModule>('node:child_process');
  const runtimeProcess = getRuntimeProcess();
  if (!childProcessModule || !runtimeProcess) {
    throw new Error(GEMINI_CLI_UNAVAILABLE_MESSAGE);
  }

  const invocation = buildGeminiCliInvocation(prompt, options);
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
      formatGeminiCliError(error instanceof Error ? error.message : String(error)),
    );
  }

  if (!child.stdin || !child.stdout || !child.stderr) {
    throw new Error(GEMINI_CLI_UNAVAILABLE_MESSAGE);
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
        queuedEvents.push(parseGeminiCliJsonlLine(line));
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
        const event = parseGeminiCliJsonlLine(line);
        yieldedEvents.push(event);
        yield event;
      }
    }

    const turnError = readGeminiCliTurnError(yieldedEvents);
    if (turnError) {
      throw new Error(formatGeminiCliError(turnError));
    }

    if (exitCode !== 0) {
      throw new Error(
        formatGeminiCliError(
          stderr.trim() || `Gemini CLI exited with status ${exitCode}.`,
        ),
      );
    }
  } catch (error) {
    throw new Error(
      formatGeminiCliError(error instanceof Error ? error.message : String(error)),
    );
  } finally {
    abortSignal?.removeEventListener('abort', handleAbort);
  }
}

function extractGeminiText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => extractGeminiText(entry)).filter(Boolean).join('');
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  const directText = typeof record.text === 'string' ? record.text : '';
  if (directText) {
    return directText;
  }

  return ['value', 'content', 'parts', 'message']
    .map((key) => extractGeminiText(record[key]))
    .find(Boolean) ?? '';
}

function formatGeminiSdkError(event: Record<string, unknown>): string {
  return extractGeminiText(event.value ?? event.error ?? event.message ?? event)
    || 'Gemini CLI SDK stream failed.';
}

function formatGeminiControlEventError(event: Record<string, unknown>): string | null {
  const eventType = typeof event.type === 'string' ? event.type : '';
  const value = event.value && typeof event.value === 'object'
    ? event.value as Record<string, unknown>
    : {};
  const diagnostic = extractGeminiText(value.systemMessage ?? value.reason ?? event.value).trim();

  switch (eventType) {
    case 'agent_execution_blocked':
      return `Gemini agent execution blocked: ${diagnostic || 'policy denied execution'}`;
    case 'context_window_will_overflow': {
      const estimated = value.estimatedRequestTokenCount;
      const remaining = value.remainingTokenCount;
      const tokenDetail =
        typeof estimated === 'number' && typeof remaining === 'number'
          ? ` (estimated request tokens: ${estimated}, remaining tokens: ${remaining})`
          : '';
      return `Gemini CLI SDK context window will overflow${tokenDetail}.`;
    }
    case 'invalid_stream':
      return 'Gemini CLI SDK received an invalid model stream.';
    case 'loop_detected':
      return 'Gemini CLI SDK detected a loop and stopped execution.';
    case 'max_session_turns':
      return 'Gemini CLI SDK reached the maximum session turn limit.';
    case 'user_cancelled':
      return 'Gemini CLI SDK turn was cancelled.';
    default:
      return null;
  }
}

function asGeminiRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toJsonSafeGeminiValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonSafeGeminiValue(entry));
  }

  if (!value || typeof value !== 'object') {
    return typeof value === 'function' ? undefined : value;
  }

  const safeRecord: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'function') {
      continue;
    }
    const safeValue = toJsonSafeGeminiValue(entry);
    if (safeValue !== undefined) {
      safeRecord[key] = safeValue;
    }
  }
  return safeRecord;
}

function compactGeminiRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}

interface PendingGeminiToolRequest {
  args: Record<string, unknown>;
  name: string;
}

function normalizeGeminiToolRequestArgs(
  name: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (name === 'user_question') {
    return compactGeminiRecord({
      ...args,
      status: args.status ?? 'awaiting_user',
    });
  }

  if (name === 'permission_request') {
    return compactGeminiRecord({
      ...args,
      status: args.status ?? 'awaiting_approval',
    });
  }

  return args;
}

function createGeminiToolRequestCall(
  value: unknown,
  pendingToolRequests: Map<string, PendingGeminiToolRequest>,
): ToolCall {
  const toolRequest = asGeminiRecord(value) ?? {};
  const callId = String(toolRequest.callId ?? `gemini-tool-${Date.now()}`);
  const name = canonicalizeBirdCoderCodeEngineProviderToolName({
    fallbackToolName: 'tool_call_request',
    provider: 'gemini',
    toolName: toolRequest.name,
  });
  const args = normalizeGeminiToolRequestArgs(
    name,
    normalizeProviderToolArgumentRecord(
      toolRequest.args ?? toolRequest.arguments ?? toolRequest.input,
    ),
  );
  pendingToolRequests.set(callId, {
    args,
    name,
  });

  return {
    id: callId,
    type: 'function',
    function: {
      name,
      arguments: stringifyProviderToolArgumentPayload(args),
    },
  };
}

function extractGeminiErrorMessage(value: unknown): string | undefined {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  const record = asGeminiRecord(value);
  if (!record) {
    return undefined;
  }

  return extractGeminiText(record.message ?? record.error ?? record).trim() || undefined;
}

function extractGeminiToolResponseOutput(value: Record<string, unknown>): string | undefined {
  const errorMessage = extractGeminiErrorMessage(value.error);
  if (errorMessage) {
    return errorMessage;
  }

  if (typeof value.resultDisplay === 'string' && value.resultDisplay.trim()) {
    return value.resultDisplay;
  }

  if (value.resultDisplay && typeof value.resultDisplay === 'object') {
    return stringifyProviderToolArgumentPayload(toJsonSafeGeminiValue(value.resultDisplay));
  }

  const responsePartsText = extractGeminiText(value.responseParts).trim();
  return responsePartsText || undefined;
}

function createGeminiToolResponseCall(
  value: unknown,
  pendingToolRequests: Map<string, PendingGeminiToolRequest>,
): ToolCall {
  const toolResponse = asGeminiRecord(value) ?? {};
  const callId = String(toolResponse.callId ?? `gemini-tool-response-${Date.now()}`);
  const pendingToolRequest = pendingToolRequests.get(callId);
  const errorMessage = extractGeminiErrorMessage(toolResponse.error);
  const args = compactGeminiRecord({
    ...(pendingToolRequest?.args ?? {}),
    status: errorMessage ? 'error' : 'success',
    output: extractGeminiToolResponseOutput(toolResponse),
    responseParts: toJsonSafeGeminiValue(toolResponse.responseParts),
    resultDisplay: toJsonSafeGeminiValue(toolResponse.resultDisplay),
    error: errorMessage,
    errorType: toJsonSafeGeminiValue(toolResponse.errorType),
    outputFile: toolResponse.outputFile,
    contentLength: toolResponse.contentLength,
    data: toJsonSafeGeminiValue(toolResponse.data),
  });
  pendingToolRequests.delete(callId);

  return {
    id: callId,
    type: 'function',
    function: {
      name: pendingToolRequest?.name ?? String(toolResponse.name ?? 'tool_call_response'),
      arguments: stringifyProviderToolArgumentPayload(args),
    },
  };
}

function createGeminiPermissionRequestCall(value: unknown): ToolCall {
  const confirmation = asGeminiRecord(value) ?? {};
  const request = asGeminiRecord(confirmation.request);
  const callId = String(
    request?.callId ??
      confirmation.callId ??
      confirmation.correlationId ??
      `gemini-confirmation-${Date.now()}`,
  );

  return {
    id: callId,
    type: 'function',
    function: {
      name: 'permission_request',
      arguments: stringifyProviderToolArgumentPayload(
        compactGeminiRecord({
          status: 'awaiting_approval',
          request: toJsonSafeGeminiValue(confirmation.request),
          details: toJsonSafeGeminiValue(confirmation.details),
          correlationId: confirmation.correlationId,
        }),
      ),
    },
  };
}

function normalizeGeminiCliToolArguments(
  parameters: unknown,
): Record<string, unknown> {
  return normalizeProviderToolArgumentRecord(parameters);
}

function toGeminiCliToolCall(event: Record<string, unknown>): ToolCall | null {
  if (event.type !== 'tool_use') {
    return null;
  }

  const toolName = canonicalizeBirdCoderCodeEngineProviderToolName({
    fallbackToolName: 'tool_use',
    provider: 'gemini',
    toolName: event.tool_name ?? event.name,
  });
  const args = normalizeGeminiCliToolArguments(event.parameters ?? event.args);

  return {
    id: String(event.tool_id ?? event.toolId ?? `gemini-tool-${Date.now()}`),
    type: 'function',
    function: {
      name: toolName,
      arguments: stringifyProviderToolArgumentPayload(args),
    },
  };
}

function normalizeGeminiFiniteNumber(
  value: number | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeGeminiPositiveInteger(
  value: number | undefined,
  maximum: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function normalizeGeminiTemperature(value: number | undefined): number | undefined {
  return normalizeGeminiFiniteNumber(value, 0, 2);
}

function normalizeGeminiTopP(value: number | undefined): number | undefined {
  return normalizeGeminiFiniteNumber(value, 0, 1);
}

function normalizeGeminiMaxTokens(value: number | undefined): number | undefined {
  return normalizeGeminiPositiveInteger(value, 128000);
}

function compactGeminiGenerationConfig(
  config: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const compactConfig = compactGeminiRecord(config);
  return Object.keys(compactConfig).length > 0 ? compactConfig : undefined;
}

function buildGeminiGenerationConfig(options?: ChatOptions): Record<string, unknown> | undefined {
  return compactGeminiGenerationConfig({
    temperature: normalizeGeminiTemperature(options?.temperature),
    topP: normalizeGeminiTopP(options?.topP),
    maxOutputTokens: normalizeGeminiMaxTokens(options?.maxTokens),
  });
}

export function createGeminiOfficialSdkBridge(
  moduleNamespace: Record<string, unknown>,
): ChatEngineOfficialSdkBridge | null {
  const GeminiCliAgent = typeof moduleNamespace.GeminiCliAgent === 'function'
    ? moduleNamespace.GeminiCliAgent as new (options: Record<string, unknown>) => {
      session: (options?: Record<string, unknown>) => {
        sendStream: (
          prompt: string,
          signal?: AbortSignal,
        ) => AsyncIterable<Record<string, unknown>>;
      };
    }
    : null;

  if (!GeminiCliAgent) {
    return null;
  }

  return {
    async sendMessage(messages, options) {
      const model = normalizeGeminiRequestedModel(options?.model);
      const agent = new GeminiCliAgent({
        instructions: buildGeminiInstructions(messages),
        model: model ?? undefined,
        cwd: options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory(),
        generationConfig: buildGeminiGenerationConfig(options),
      });
      const session = agent.session();
      const prompt = buildGeminiPrompt(messages);
      let responseText = '';
      const pendingToolRequests = new Map<string, PendingGeminiToolRequest>();
      const toolCalls: ToolCall[] = [];

      for await (const event of session.sendStream(prompt, options?.signal)) {
        const controlEventError = formatGeminiControlEventError(event);
        if (controlEventError) {
          throw new Error(controlEventError);
        }
        if (event.type === 'content') {
          responseText += extractGeminiText(event.value);
          continue;
        }
        if (event.type === 'error') {
          throw new Error(formatGeminiSdkError(event));
        }
        if (event.type === 'tool_call_request') {
          toolCalls.push(createGeminiToolRequestCall(event.value, pendingToolRequests));
          continue;
        }
        if (event.type === 'tool_call_response') {
          toolCalls.push(createGeminiToolResponseCall(event.value, pendingToolRequests));
          continue;
        }
        if (event.type === 'tool_call_confirmation') {
          toolCalls.push(createGeminiPermissionRequestCall(event.value));
        }
      }

      return createTextChatResponse({
        id: `gemini-chat-${Date.now()}`,
        model: options?.model || 'gemini',
        content: responseText,
        toolCalls,
      });
    },
    async *sendMessageStream(messages, options) {
      const id = `gemini-chat-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      const model = options?.model || 'gemini';
      const sdkModel = normalizeGeminiRequestedModel(options?.model);
      const agent = new GeminiCliAgent({
        instructions: buildGeminiInstructions(messages),
        model: sdkModel ?? undefined,
        cwd: options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory(),
        generationConfig: buildGeminiGenerationConfig(options),
      });
      const session = agent.session();
      const prompt = buildGeminiPrompt(messages);
      const pendingToolRequests = new Map<string, PendingGeminiToolRequest>();

      for await (const event of session.sendStream(prompt, options?.signal)) {
        const controlEventError = formatGeminiControlEventError(event);
        if (controlEventError) {
          throw new Error(controlEventError);
        }
        switch (event.type) {
          case 'content': {
            const content = extractGeminiText(event.value);
            if (content) {
              yield createTextStreamChunk({
                id,
                created,
                model,
                role: 'assistant',
                content,
              });
            }
            break;
          }
          case 'error':
            throw new Error(formatGeminiSdkError(event));
          case 'tool_call_request': {
            yield createToolCallStreamChunk({
              id,
              created,
              model,
              toolCall: createGeminiToolRequestCall(event.value, pendingToolRequests),
            });
            break;
          }
          case 'tool_call_response': {
            yield createToolCallStreamChunk({
              id,
              created,
              model,
              toolCall: createGeminiToolResponseCall(event.value, pendingToolRequests),
            });
            break;
          }
          case 'tool_call_confirmation': {
            yield createToolCallStreamChunk({
              id,
              created,
              model,
              toolCall: createGeminiPermissionRequestCall(event.value),
            });
            break;
          }
          default:
            break;
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

const DEFAULT_GEMINI_OFFICIAL_SDK_BRIDGE_LOADER = createModuleBackedOfficialSdkBridgeLoader({
  candidates: [
    {
      kind: 'package',
      specifier: '@google/gemini-cli-sdk',
    },
    {
      kind: 'path',
      specifier: 'external/gemini/packages/sdk/dist/index.js',
    },
    {
      kind: 'path',
      specifier: 'external/gemini/packages/sdk/src/index.ts',
    },
  ],
  createBridge: createGeminiOfficialSdkBridge,
});

export class GeminiChatEngine implements IChatEngine {
  name = 'gemini-cli-sdk-adapter';
  version = '1.2.0';

  private readonly officialSdkBridgeLoader: ChatEngineOfficialSdkBridgeLoader | null;
  private readonly geminiCliJsonlTurnExecutor:
    | ((prompt: string, options?: ChatOptions) => AsyncIterable<Record<string, unknown>> | Promise<AsyncIterable<Record<string, unknown>>>)
    | null;
  private readonly localState = createLocalChatEngineState();

  constructor(options: GeminiChatEngineOptions = {}) {
    this.officialSdkBridgeLoader =
      'officialSdkBridgeLoader' in options
        ? options.officialSdkBridgeLoader ?? null
        : DEFAULT_GEMINI_OFFICIAL_SDK_BRIDGE_LOADER;
    this.geminiCliJsonlTurnExecutor =
      options.geminiCliJsonlTurnExecutor === undefined
        ? streamGeminiCliJsonlTurn
        : options.geminiCliJsonlTurnExecutor;
  }

  describeIntegration() {
    return createGeminiIntegrationDescriptor();
  }

  describeRawExtensions() {
    return GEMINI_RAW_EXTENSIONS;
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
      experimentalCapabilities: GEMINI_RAW_EXTENSIONS.experimentalFeatures,
    });
  }

  getHealth() {
    return createDetectedHealthReport({
      descriptor: this.describeIntegration(),
      packagePresence: resolveGeminiPackagePresence(),
      executable: 'gemini',
      authEnvKeys: GEMINI_AUTH_ENV_KEYS,
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
      fallback: async () => this.sendMessageViaGeminiCli(messages, options),
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
        yield* this.streamMessageViaGeminiCli(messages, _streamOptions);
      }.bind(this),
    });
  }

  private async resolveGeminiCliEvents(
    prompt: string,
    options?: ChatOptions,
  ): Promise<AsyncIterable<Record<string, unknown>>> {
    if (!this.geminiCliJsonlTurnExecutor) {
      throw createUnavailableGeminiSdkError();
    }
    return this.geminiCliJsonlTurnExecutor(prompt, options);
  }

  private async sendMessageViaGeminiCli(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const prompt = buildGeminiCliPrompt(messages);
    let responseText = '';
    const textByMessageKey = new Map<string, string>();
    const toolCalls: ToolCall[] = [];

    for await (const event of await this.resolveGeminiCliEvents(prompt, options)) {
      if (event.type === 'message' && event.role === 'assistant') {
        const eventText = extractGeminiText(event.content ?? event.message);
        if (eventText) {
          if (event.delta === true) {
            responseText += eventText;
          } else {
            const messageKey = String(event.id ?? 'gemini-cli-message');
            const previousText = textByMessageKey.get(messageKey) ?? '';
            const textDelta = resolveCumulativeTextDelta(previousText, eventText);
            textByMessageKey.set(messageKey, eventText);
            responseText += textDelta || eventText;
          }
        }
        continue;
      }

      const toolCall = toGeminiCliToolCall(event);
      if (toolCall) {
        toolCalls.push(toolCall);
        continue;
      }

      const turnError = readGeminiCliTurnError([event]);
      if (turnError) {
        throw new Error(formatGeminiCliError(turnError));
      }
    }

    if (!responseText && toolCalls.length === 0) {
      throw new Error('Gemini CLI did not return an assistant response.');
    }

    return createTextChatResponse({
      id: `gemini-chat-${Date.now()}`,
      model: options?.model || 'gemini',
      content: responseText,
      toolCalls,
    });
  }

  private async *streamMessageViaGeminiCli(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const id = `gemini-chat-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = options.model || 'gemini';
    const textByMessageKey = new Map<string, string>();
    const prompt = buildGeminiCliPrompt(messages);

    for await (const event of await this.resolveGeminiCliEvents(prompt, options)) {
      if (event.type === 'message' && event.role === 'assistant') {
        const eventText = extractGeminiText(event.content ?? event.message);
        const content = event.delta === true
          ? eventText
          : (() => {
              const messageKey = String(event.id ?? 'gemini-cli-message');
              const previousText = textByMessageKey.get(messageKey) ?? '';
              const textDelta = resolveCumulativeTextDelta(previousText, eventText);
              textByMessageKey.set(messageKey, eventText);
              return textDelta || eventText;
            })();
        if (content) {
          yield createTextStreamChunk({
            id,
            created,
            model,
            role: 'assistant',
            content,
          });
        }
        continue;
      }

      const toolCall = toGeminiCliToolCall(event);
      if (toolCall) {
        yield createToolCallStreamChunk({
          id,
          created,
          model,
          toolCall,
        });
        continue;
      }

      const turnError = readGeminiCliTurnError([event]);
      if (turnError) {
        throw new Error(formatGeminiCliError(turnError));
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
