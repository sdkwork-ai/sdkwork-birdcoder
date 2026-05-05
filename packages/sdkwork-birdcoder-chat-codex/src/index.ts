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

const CODEX_PACKAGE_PRESENCE_INPUT = {
  packageName: '@openai/codex-sdk',
  mirrorPackageJsonPath: 'external/codex/sdk/typescript/package.json',
} as const;
const CODEX_SUPPLEMENTAL_LANES = ['CLI JSONL'] as const;

function resolveCodexPackagePresence() {
  return resolvePackagePresence(CODEX_PACKAGE_PRESENCE_INPUT);
}

function createCodexIntegrationDescriptor() {
  return createRuntimeIntegrationDescriptor({
    engineId: 'codex',
    runtimeMode: 'sdk',
    transportKinds: ['sdk-stream', 'cli-jsonl'],
    sourceMirrorPath: 'external/codex/sdk/typescript',
    packagePresence: resolveCodexPackagePresence(),
    officialEntry: {
      packageName: '@openai/codex-sdk',
      cliPackageName: '@openai/codex',
      sdkPath: 'external/codex/sdk/typescript',
      sourceMirrorPath: 'external/codex/sdk/typescript',
      supplementalLanes: CODEX_SUPPLEMENTAL_LANES,
    },
    notes: 'BirdCoder uses the official Codex TypeScript SDK as the primary adapter baseline and falls back to the real Codex CLI JSONL lane when the SDK package is unavailable.',
  });
}

const CODEX_RAW_EXTENSIONS = createRawExtensionDescriptor({
  provider: 'codex',
  primaryLane: 'thread-turn-item',
  supplementalLanes: CODEX_SUPPLEMENTAL_LANES,
  nativeEventModel: ['thread.created', 'turn.started', 'item.updated', 'item.completed'],
  nativeArtifactModel: ['structured-output', 'patch', 'command-log'],
  experimentalFeatures: ['structured-output-schema', 'thread-resume'],
  notes: 'Codex raw lane preserves native thread, turn, and item semantics outside the canonical event surface.',
});

export interface CodexChatEngineOptions {
  officialSdkBridgeLoader?: ChatEngineOfficialSdkBridgeLoader | null;
  cliJsonlTurnExecutor?: ((prompt: string, options?: ChatOptions) => Promise<Record<string, unknown>[]>) | null;
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

interface NodeFsModule {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: 'utf8'): string;
}

interface NodePathModule {
  join(...paths: string[]): string;
}

interface CodexCliCommandSpec {
  command: string;
  prefixArgs: readonly string[];
}

interface CodexCliInvocation {
  command: string;
  args: readonly string[];
  workingDirectory: string;
  stdinPrompt: string | null;
}

const CODEX_CLI_UNAVAILABLE_MESSAGE =
  'Codex CLI runtime is unavailable. Install Codex CLI and ensure the `codex` command is on PATH, or install `@openai/codex-sdk`.';
const CODEX_NATIVE_SESSION_ID_PREFIX = 'codex-native:';
const CODEX_AUTH_ENV_KEYS = ['OPENAI_API_KEY', 'CODEX_API_KEY'] as const;
const CODEX_AUTH_CONFIGURATION_HINTS = [
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'Codex auth.json (`codex login --with-api-key`)',
] as const;
const CODEX_CLI_AUTHENTICATION_MESSAGE =
  'Codex CLI authentication is not configured. BirdCoder reuses your existing Codex auth from `CODEX_HOME` or `~/.codex`; if none is configured, set `OPENAI_API_KEY` or run `codex login --with-api-key`.';

interface CodexLocalConfigurationSnapshot {
  authConfigured: boolean;
  authFileDetected: boolean;
  configFileDetected: boolean;
  modelProvider: string | null;
  providerBaseUrlConfigured: boolean;
}

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

function resolveCodexHomeDirectory(): string | null {
  const runtimeProcess = getRuntimeProcess();
  const pathModule = getBuiltinModule<NodePathModule>('node:path');
  if (!runtimeProcess || !pathModule) {
    return null;
  }

  const configuredCodexHome = runtimeProcess.env.CODEX_HOME?.trim();
  if (configuredCodexHome) {
    return configuredCodexHome;
  }

  const homeDirectory =
    runtimeProcess.env.HOME?.trim() ||
    runtimeProcess.env.USERPROFILE?.trim();
  return homeDirectory
    ? pathModule.join(homeDirectory, '.codex')
    : null;
}

function readCodexLocalConfiguration(): CodexLocalConfigurationSnapshot {
  const fsModule = getBuiltinModule<NodeFsModule>('node:fs');
  const pathModule = getBuiltinModule<NodePathModule>('node:path');
  const codexHomeDirectory = resolveCodexHomeDirectory();

  if (!fsModule || !pathModule || !codexHomeDirectory) {
    return {
      authConfigured: false,
      authFileDetected: false,
      configFileDetected: false,
      modelProvider: null,
      providerBaseUrlConfigured: false,
    };
  }

  const authFilePath = pathModule.join(codexHomeDirectory, 'auth.json');
  const configFilePath = pathModule.join(codexHomeDirectory, 'config.toml');

  let authConfigured = false;
  let authFileDetected = false;
  if (fsModule.existsSync(authFilePath)) {
    authFileDetected = true;
    try {
      const parsedAuth = JSON.parse(fsModule.readFileSync(authFilePath, 'utf8')) as unknown;
      if (parsedAuth && typeof parsedAuth === 'object') {
        const authRecord = parsedAuth as Record<string, unknown>;
        authConfigured = Object.entries(authRecord).some(([key, value]) =>
          key.endsWith('_API_KEY') &&
          typeof value === 'string' &&
          value.trim().length > 0,
        );
      }
    } catch {
      authConfigured = false;
    }
  }

  let configFileDetected = false;
  let modelProvider: string | null = null;
  let providerBaseUrlConfigured = false;
  if (fsModule.existsSync(configFilePath)) {
    configFileDetected = true;
    try {
      const configToml = fsModule.readFileSync(configFilePath, 'utf8');
      const modelProviderMatch = configToml.match(/^\s*model_provider\s*=\s*"([^"]+)"/m);
      modelProvider = modelProviderMatch?.[1] ?? null;
      providerBaseUrlConfigured = /^\s*base_url\s*=\s*"[^"]+"/m.test(configToml);
    } catch {
      modelProvider = null;
      providerBaseUrlConfigured = false;
    }
  }

  return {
    authConfigured,
    authFileDetected,
    configFileDetected,
    modelProvider,
    providerBaseUrlConfigured,
  };
}

function buildCodexPrompt(messages: readonly ChatMessage[]): string {
  return buildMessageTranscriptPrompt(messages) || 'Continue the coding turn.';
}

function buildCodexResumePrompt(messages: readonly ChatMessage[]): string {
  const latestUserPrompt = [...messages]
    .reverse()
    .find((message) => message.role === 'user' && message.content.trim());

  return latestUserPrompt?.content.trim() || buildCodexPrompt(messages);
}

function buildCodexCliPrompt(
  messages: readonly ChatMessage[],
  options?: ChatOptions,
): string {
  return resolveCodexCliResumeSessionId(options)
    ? buildCodexResumePrompt(messages)
    : buildCodexPrompt(messages);
}

function createCodexUsage(usage: Record<string, unknown> | null | undefined): ChatResponse['usage'] {
  if (!usage) {
    return undefined;
  }

  const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
  const cachedInputTokens =
    typeof usage.cached_input_tokens === 'number' ? usage.cached_input_tokens : 0;
  const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;

  return {
    prompt_tokens: inputTokens + cachedInputTokens,
    completion_tokens: outputTokens,
    total_tokens: inputTokens + cachedInputTokens + outputTokens,
  };
}

type CodexOfficialSdkClient = {
  startThread: (options?: Record<string, unknown>) => {
    run: (input: string, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
    runStreamed: (
      input: string,
      options?: Record<string, unknown>,
    ) => Promise<{ events: AsyncIterable<Record<string, unknown>> }>;
  };
};

type CodexOfficialSdkClientConstructor = new (
  options?: Record<string, unknown>,
) => CodexOfficialSdkClient;

function createCodexThread(codexClient: CodexOfficialSdkClient, options?: ChatOptions) {
  return codexClient.startThread({
    workingDirectory: options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory(),
    skipGitRepoCheck: true,
    ...(options?.model ? { model: options.model } : {}),
  });
}

function normalizeCodexFiniteNumber(
  value: number | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeCodexPositiveInteger(
  value: number | undefined,
  maximum: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function normalizeCodexTemperature(value: number | undefined): number | undefined {
  return normalizeCodexFiniteNumber(value, 0, 2);
}

function normalizeCodexTopP(value: number | undefined): number | undefined {
  return normalizeCodexFiniteNumber(value, 0, 1);
}

function normalizeCodexMaxTokens(value: number | undefined): number | undefined {
  return normalizeCodexPositiveInteger(value, 128000);
}

function compactCodexRunOptions(
  options: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );
}

function buildCodexRunOptions(options?: ChatOptions): Record<string, unknown> {
  return compactCodexRunOptions({
    signal: options?.signal,
    temperature: normalizeCodexTemperature(options?.temperature),
    topP: normalizeCodexTopP(options?.topP),
    maxTokens: normalizeCodexMaxTokens(options?.maxTokens),
  });
}

function createCodexCliCommandSpec(): CodexCliCommandSpec {
  return getRuntimeProcess()?.platform === 'win32'
    ? {
        command: getRuntimeProcess()?.env.ComSpec || 'cmd.exe',
        prefixArgs: ['/d', '/s', '/c', 'codex.cmd'],
      }
    : {
        command: 'codex',
        prefixArgs: [],
      };
}

function normalizeOptionalIdentifier(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue || null;
}

function normalizeCodexNativeSessionId(candidate: string | null | undefined): string | null {
  const normalizedCandidate = normalizeOptionalIdentifier(candidate);
  if (!normalizedCandidate) {
    return null;
  }

  const nativeSessionId = normalizedCandidate.startsWith(CODEX_NATIVE_SESSION_ID_PREFIX)
    ? normalizedCandidate.slice(CODEX_NATIVE_SESSION_ID_PREFIX.length).trim()
    : normalizedCandidate;
  return nativeSessionId || null;
}

function resolveCodexCliResumeSessionId(options?: ChatOptions): string | null {
  return normalizeCodexNativeSessionId(options?.context?.nativeSessionId);
}

function buildCodexCliInvocation(
  prompt: string,
  options?: ChatOptions,
): CodexCliInvocation {
  const commandSpec = createCodexCliCommandSpec();
  const resumeSessionId = resolveCodexCliResumeSessionId(options);
  const workingDirectory =
    options?.context?.workspaceRoot?.trim() || resolveRuntimeWorkingDirectory();
  const args = [
    ...commandSpec.prefixArgs,
    'exec',
    '--json',
    '--full-auto',
    '--skip-git-repo-check',
  ];

  if (options?.model?.trim()) {
    args.push('--model', options.model.trim());
  }

  if (workingDirectory) {
    args.push('--cd', workingDirectory);
  }

  if (resumeSessionId) {
    args.push('resume', resumeSessionId, prompt);
  }

  return {
    command: commandSpec.command,
    args,
    workingDirectory,
    stdinPrompt: resumeSessionId ? null : prompt,
  };
}

function isCodexCliAuthenticationError(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();
  return (
    normalizedMessage.includes('login') ||
    normalizedMessage.includes('api key') ||
    normalizedMessage.includes('unauthorized') ||
    normalizedMessage.includes('authentication')
  );
}

function formatCodexCliError(message: string): string {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return 'Codex CLI turn failed.';
  }

  if (isCodexCliAuthenticationError(normalizedMessage)) {
    return CODEX_CLI_AUTHENTICATION_MESSAGE;
  }

  return normalizedMessage;
}

function parseCodexCliJsonlLine(line: string): Record<string, unknown> {
  try {
    return parseBirdCoderApiJson<Record<string, unknown>>(line);
  } catch (error) {
    throw new Error(
      `Codex CLI JSONL parse failed: ${error instanceof Error ? error.message : String(error)}. Line: ${line}`,
    );
  }
}

function readCodexTurnError(events: readonly Record<string, unknown>[]): string | null {
  return events
    .map((event) => {
      switch (event.type) {
        case 'turn.failed':
          return event.error && typeof event.error === 'object'
            ? String((event.error as Record<string, unknown>).message ?? '')
            : '';
        case 'error':
          return String(event.message ?? '');
        default:
          return '';
      }
    })
    .find((message) => message.trim().length > 0) ?? null;
}

async function executeCodexCliJsonlTurn(
  prompt: string,
  options?: ChatOptions,
): Promise<Record<string, unknown>[]> {
  const events: Record<string, unknown>[] = [];
  for await (const event of streamCodexCliJsonlTurn(prompt, options)) {
    events.push(event);
  }
  return events;
}

async function* streamCodexCliJsonlTurn(
  prompt: string,
  options?: ChatOptions,
): AsyncGenerator<Record<string, unknown>, void, unknown> {
  if (!isNodeRuntime()) {
    throw new Error(CODEX_CLI_UNAVAILABLE_MESSAGE);
  }

  const childProcessModule = getBuiltinModule<NodeChildProcessModule>('node:child_process');
  const runtimeProcess = getRuntimeProcess();
  if (!childProcessModule || !runtimeProcess) {
    throw new Error(CODEX_CLI_UNAVAILABLE_MESSAGE);
  }

  const invocation = buildCodexCliInvocation(prompt, options);
  const child = childProcessModule.spawn(invocation.command, invocation.args, {
    cwd: invocation.workingDirectory || undefined,
    env: runtimeProcess.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  if (!child.stdin || !child.stdout || !child.stderr) {
    throw new Error(CODEX_CLI_UNAVAILABLE_MESSAGE);
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
        queuedEvents.push(parseCodexCliJsonlLine(line));
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
    if (invocation.stdinPrompt !== null) {
      child.stdin.write(invocation.stdinPrompt);
    }
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
        const event = parseCodexCliJsonlLine(line);
        yieldedEvents.push(event);
        yield event;
      }
    }

    const turnError = readCodexTurnError(yieldedEvents);

    if (turnError) {
      throw new Error(formatCodexCliError(turnError));
    }

    if (exitCode !== 0) {
      throw new Error(
        formatCodexCliError(
          stderr.trim() || `Codex CLI exited with status ${exitCode}.`,
        ),
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      message.toLowerCase().includes('enoent')
        ? CODEX_CLI_UNAVAILABLE_MESSAGE
        : formatCodexCliError(message),
    );
  } finally {
    abortSignal?.removeEventListener('abort', handleAbort);
  }
}

function toCodexToolCall(item: Record<string, unknown>): ToolCall | null {
  switch (item.type) {
    case 'command_execution':
      return {
        id: String(item.id ?? `codex-command-${Date.now()}`),
        type: 'function',
        function: {
          name: canonicalizeBirdCoderCodeEngineProviderToolName({
            fallbackToolName: 'run_command',
            provider: 'codex',
            toolName: item.type,
          }),
          arguments: stringifyProviderToolArgumentPayload({
            command: item.command,
            output: item.aggregated_output,
            exitCode: item.exit_code,
            status: item.status,
          }),
        },
      };
    case 'file_change':
      return {
        id: String(item.id ?? `codex-patch-${Date.now()}`),
        type: 'function',
        function: {
          name: canonicalizeBirdCoderCodeEngineProviderToolName({
            fallbackToolName: 'apply_patch',
            provider: 'codex',
            toolName: item.type,
          }),
          arguments: stringifyProviderToolArgumentPayload({
            changes: item.changes,
            status: item.status,
          }),
        },
      };
    case 'todo_list':
      return {
        id: String(item.id ?? `codex-todo-${Date.now()}`),
        type: 'function',
        function: {
          name: canonicalizeBirdCoderCodeEngineProviderToolName({
            fallbackToolName: 'write_todo',
            provider: 'codex',
            toolName: item.type,
          }),
          arguments: stringifyProviderToolArgumentPayload({
            items: item.items,
            status: item.status,
          }),
        },
      };
    case 'web_search':
      return {
        id: String(item.id ?? `codex-web-search-${Date.now()}`),
        type: 'function',
        function: {
          name: canonicalizeBirdCoderCodeEngineProviderToolName({
            fallbackToolName: 'web_search',
            provider: 'codex',
            toolName: item.type,
          }),
          arguments: stringifyProviderToolArgumentPayload({
            query: item.query,
          }),
        },
      };
    case 'mcp_tool_call':
      return {
        id: String(item.id ?? `codex-mcp-${Date.now()}`),
        type: 'function',
        function: {
          name: canonicalizeBirdCoderCodeEngineProviderToolName({
            fallbackToolName: 'mcp_tool_call',
            provider: 'codex',
            toolName: item.tool,
          }),
          arguments: stringifyProviderToolArgumentPayload(
            normalizeProviderToolArgumentRecord(item.arguments),
          ),
        },
      };
    default:
      return null;
  }
}

function extractCodexEventItem(event: Record<string, unknown>): Record<string, unknown> | null {
  if (
    event.type !== 'item.updated' &&
    event.type !== 'item.completed'
  ) {
    return null;
  }

  return event.item && typeof event.item === 'object'
    ? event.item as Record<string, unknown>
    : null;
}

function extractCodexItemsFromEvents(
  events: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  return events
    .map(extractCodexEventItem)
    .filter((item): item is Record<string, unknown> => item !== null);
}

function extractCodexToolCallsFromItems(value: unknown): ToolCall[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => item && typeof item === 'object' ? toCodexToolCall(item as Record<string, unknown>) : null)
    .filter((toolCall): toolCall is ToolCall => toolCall !== null);
}

export function createCodexOfficialSdkBridge(
  moduleNamespace: Record<string, unknown>,
): ChatEngineOfficialSdkBridge | null {
  const CodexClient = typeof moduleNamespace.Codex === 'function'
    ? moduleNamespace.Codex as CodexOfficialSdkClientConstructor
    : null;

  if (!CodexClient) {
    return null;
  }

  let codexClientFactory: (() => CodexOfficialSdkClient) | null = null;
  try {
    new CodexClient();
    codexClientFactory = () => new CodexClient();
  } catch {
    return null;
  }

  return {
    async sendMessage(messages, options) {
      const prompt = buildCodexPrompt(messages);
      const codexThread = createCodexThread(codexClientFactory(), options);
      const turn = await codexThread.run(prompt, buildCodexRunOptions(options));
      const finalResponse =
        typeof turn.finalResponse === 'string' ? turn.finalResponse : '';

      return createTextChatResponse({
        id: `codex-chat-${Date.now()}`,
        model: options?.model || 'codex',
        content: finalResponse,
        toolCalls: extractCodexToolCallsFromItems(turn.items),
        usage: createCodexUsage(
          turn.usage && typeof turn.usage === 'object'
            ? turn.usage as Record<string, unknown>
            : null,
        ),
      });
    },
    async *sendMessageStream(messages, options) {
      const id = `codex-chat-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      const model = options?.model || 'codex';
      const prompt = buildCodexPrompt(messages);
      const codexThread = createCodexThread(codexClientFactory(), options);
      const streamedTurn = await codexThread.runStreamed(prompt, buildCodexRunOptions(options));
      const itemContentById = new Map<string, string>();

      for await (const event of streamedTurn.events) {
        switch (event.type) {
          case 'item.started':
          case 'item.updated':
          case 'item.completed': {
            const item = event.item;
            if (!item || typeof item !== 'object') {
              continue;
            }

            const itemRecord = item as Record<string, unknown>;
            if (itemRecord.type === 'agent_message' && typeof itemRecord.text === 'string') {
              const itemId = String(itemRecord.id ?? 'codex-agent-message');
              const previousContent = itemContentById.get(itemId) ?? '';
              const contentDelta = resolveCumulativeTextDelta(previousContent, itemRecord.text);
              itemContentById.set(itemId, itemRecord.text);
              if (!contentDelta) {
                continue;
              }
              yield createTextStreamChunk({
                id,
                created,
                model,
                role: 'assistant',
                content: contentDelta,
              });
              continue;
            }

            const toolCall = toCodexToolCall(itemRecord);
            if (toolCall) {
              yield createToolCallStreamChunk({
                id,
                created,
                model,
                toolCall,
              });
            }
            break;
          }
          case 'turn.completed':
            yield createTextStreamChunk({
              id,
              created,
              model,
              finishReason: 'stop',
            });
            break;
          case 'turn.failed': {
            const errorRecord =
              event.error && typeof event.error === 'object'
                ? event.error as Record<string, unknown>
                : null;
            throw new Error(String(errorRecord?.message ?? 'Codex turn failed.'));
          }
          case 'error':
            throw new Error(String(event.message ?? 'Codex stream failed.'));
          default:
            break;
        }
      }
    },
  };
}

const DEFAULT_CODEX_OFFICIAL_SDK_BRIDGE_LOADER = createModuleBackedOfficialSdkBridgeLoader({
  candidates: [
    {
      kind: 'package',
      specifier: '@openai/codex-sdk',
    },
    {
      kind: 'path',
      specifier: 'external/codex/sdk/typescript/dist/index.js',
    },
    {
      kind: 'path',
      specifier: 'external/codex/sdk/typescript/src/index.ts',
    },
  ],
  createBridge: createCodexOfficialSdkBridge,
});

export class CodexChatEngine implements IChatEngine {
  name = 'codex-official-sdk-adapter';
  version = '1.2.0';

  private readonly officialSdkBridgeLoader: ChatEngineOfficialSdkBridgeLoader | null;
  private readonly cliJsonlTurnExecutor:
    | ((prompt: string, options?: ChatOptions) => Promise<Record<string, unknown>[]>)
    | null;
  private readonly cliJsonlTurnEventStreamer:
    | ((prompt: string, options?: ChatOptions) => AsyncGenerator<Record<string, unknown>, void, unknown>)
    | null;
  private readonly localState = createLocalChatEngineState();

  constructor(options: CodexChatEngineOptions = {}) {
    this.officialSdkBridgeLoader =
      'officialSdkBridgeLoader' in options
        ? options.officialSdkBridgeLoader ?? null
        : DEFAULT_CODEX_OFFICIAL_SDK_BRIDGE_LOADER;
    this.cliJsonlTurnExecutor =
      options.cliJsonlTurnExecutor === undefined
        ? executeCodexCliJsonlTurn
        : options.cliJsonlTurnExecutor;
    this.cliJsonlTurnEventStreamer =
      options.cliJsonlTurnExecutor === undefined
        ? streamCodexCliJsonlTurn
        : null;
  }

  describeIntegration() {
    return createCodexIntegrationDescriptor();
  }

  describeRawExtensions() {
    return CODEX_RAW_EXTENSIONS;
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
      experimentalCapabilities: CODEX_RAW_EXTENSIONS.experimentalFeatures,
    });
  }

  getHealth() {
    const localConfiguration = readCodexLocalConfiguration();
    const health = createDetectedHealthReport({
      descriptor: this.describeIntegration(),
      packagePresence: resolveCodexPackagePresence(),
      executable: 'codex',
      authEnvKeys: CODEX_AUTH_ENV_KEYS,
      authConfigurationHints: CODEX_AUTH_CONFIGURATION_HINTS,
      authConfigured:
        CODEX_AUTH_ENV_KEYS.some((envKey) => Boolean(getRuntimeProcess()?.env[envKey]?.trim())) ||
        localConfiguration.authConfigured,
    });
    const diagnostics = [...health.diagnostics];
    if (localConfiguration.authFileDetected) {
      diagnostics.push('Detected existing Codex auth.json in the local Codex home.');
    }
    if (localConfiguration.configFileDetected) {
      diagnostics.push('Detected existing Codex config.toml in the local Codex home.');
    }
    if (localConfiguration.modelProvider) {
      diagnostics.push(`Codex config selects model provider: ${localConfiguration.modelProvider}.`);
    }
    if (localConfiguration.providerBaseUrlConfigured) {
      diagnostics.push('Codex config overrides the provider base URL.');
    }
    return {
      ...health,
      diagnostics,
    };
  }

  private async sendMessageViaCodexCli(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const prompt = buildCodexCliPrompt(messages, options);
    if (!this.cliJsonlTurnExecutor) {
      throw new Error(CODEX_CLI_UNAVAILABLE_MESSAGE);
    }
    const events = await this.cliJsonlTurnExecutor(prompt, options);
    const items = extractCodexItemsFromEvents(events);
    const toolCalls = extractCodexToolCallsFromItems(items);
    const assistantContent = items
      .filter((item) => item.type === 'agent_message' && typeof item.text === 'string')
      .map((item) => String(item.text))
      .at(-1);

    if (!assistantContent && toolCalls.length === 0) {
      throw new Error('Codex CLI did not return an assistant response.');
    }

    return createTextChatResponse({
      id: `codex-chat-${Date.now()}`,
      model: options?.model || 'codex',
      content: assistantContent ?? '',
      toolCalls,
    });
  }

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return invokeWithOptionalOfficialSdk({
      loader: this.officialSdkBridgeLoader,
      messages,
      options,
      fallback: async () => this.sendMessageViaCodexCli(messages, options),
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
      fallback: async function* fallbackStream(streamOptions) {
        const id = `codex-chat-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        const model = streamOptions.model || 'codex';
        const itemContentById = new Map<string, string>();
        if (!this.cliJsonlTurnExecutor && !this.cliJsonlTurnEventStreamer) {
          throw new Error(CODEX_CLI_UNAVAILABLE_MESSAGE);
        }
        const prompt = buildCodexCliPrompt(messages, streamOptions);
        const events = this.cliJsonlTurnEventStreamer
          ? this.cliJsonlTurnEventStreamer(prompt, streamOptions)
          : await this.cliJsonlTurnExecutor!(prompt, streamOptions);

        for await (const event of events) {
          switch (event.type) {
            case 'item.started':
            case 'item.updated':
            case 'item.completed': {
              const item = event.item;
              if (!item || typeof item !== 'object') {
                continue;
              }

              const itemRecord = item as Record<string, unknown>;
              if (itemRecord.type === 'agent_message' && typeof itemRecord.text === 'string') {
                const itemId = String(itemRecord.id ?? 'codex-agent-message');
                const previousContent = itemContentById.get(itemId) ?? '';
                const contentDelta = resolveCumulativeTextDelta(previousContent, itemRecord.text);
                itemContentById.set(itemId, itemRecord.text);
                if (contentDelta) {
                  yield createTextStreamChunk({
                    id,
                    created,
                    model,
                    role: 'assistant',
                    content: contentDelta,
                  });
                }
                continue;
              }

              const toolCall = toCodexToolCall(itemRecord);
              if (toolCall) {
                yield createToolCallStreamChunk({
                  id,
                  created,
                  model,
                  toolCall,
                });
              }
              break;
            }
            case 'turn.completed':
              yield createTextStreamChunk({
                id,
                created,
                model,
                finishReason: 'stop',
              });
              break;
            default:
              break;
          }
        }
      }.bind(this),
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
