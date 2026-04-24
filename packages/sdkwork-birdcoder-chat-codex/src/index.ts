import {
  buildMessageTranscriptPrompt,
  createDetectedHealthReport,
  createModuleBackedOfficialSdkBridgeLoader,
  createRawExtensionDescriptor,
  resolveRuntimeWorkingDirectory,
  createStaticIntegrationDescriptor,
  createTextChatResponse,
  createTextStreamChunk,
  createToolCallStreamChunk,
  resolvePackagePresence,
  type ChatEngineOfficialSdkBridge,
  type ChatEngineOfficialSdkBridgeLoader,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
  type IChatEngine,
  type ToolCall,
} from '@sdkwork/birdcoder-chat';

const CODEX_PACKAGE = resolvePackagePresence({
  packageName: '@openai/codex-sdk',
  mirrorPackageJsonPath: 'external/codex/sdk/typescript/package.json',
});

const CODEX_INTEGRATION = createStaticIntegrationDescriptor({
  engineId: 'codex',
  runtimeMode: 'sdk',
  transportKinds: ['sdk-stream', 'cli-jsonl'],
  sourceMirrorPath: 'external/codex/sdk/typescript',
  officialEntry: {
    packageName: '@openai/codex-sdk',
    packageVersion: CODEX_PACKAGE.mirrorVersion,
    cliPackageName: '@openai/codex',
    sdkPath: 'external/codex/sdk/typescript',
    sourceMirrorPath: 'external/codex/sdk/typescript',
    supplementalLanes: ['CLI JSONL'],
  },
  notes: 'BirdCoder uses the official Codex TypeScript SDK as the primary adapter baseline and falls back to the real Codex CLI JSONL lane when the SDK package is unavailable.',
});

const CODEX_RAW_EXTENSIONS = createRawExtensionDescriptor({
  provider: 'codex',
  primaryLane: 'thread-turn-item',
  supplementalLanes: CODEX_INTEGRATION.officialEntry.supplementalLanes,
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

function toNativeCodexSessionId(candidate: string | null | undefined): string | null {
  const normalizedCandidate = normalizeOptionalIdentifier(candidate);
  if (!normalizedCandidate?.startsWith(CODEX_NATIVE_SESSION_ID_PREFIX)) {
    return null;
  }

  const nativeSessionId = normalizedCandidate
    .slice(CODEX_NATIVE_SESSION_ID_PREFIX.length)
    .trim();
  return nativeSessionId || null;
}

function resolveCodexCliResumeSessionId(options?: ChatOptions): string | null {
  return (
    toNativeCodexSessionId(options?.context?.sessionId) ||
    toNativeCodexSessionId(options?.context?.codingSessionId)
  );
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

function getCodexAgentMessageDelta(
  itemId: string,
  nextText: string,
  itemContentById: Map<string, string>,
): string {
  const previousText = itemContentById.get(itemId) ?? '';
  itemContentById.set(itemId, nextText);

  if (!previousText) {
    return nextText;
  }

  return nextText.startsWith(previousText)
    ? nextText.slice(previousText.length)
    : nextText;
}

async function executeCodexCliJsonlTurn(
  prompt: string,
  options?: ChatOptions,
): Promise<Record<string, unknown>[]> {
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

  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
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

  abortSignal?.addEventListener('abort', handleAbort, { once: true });

  try {
    if (invocation.stdinPrompt !== null) {
      child.stdin.write(invocation.stdinPrompt);
    }
    child.stdin.end();

    const exitCode = await waitForExit;
    const parsedEvents = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch (error) {
          throw new Error(
            `Codex CLI JSONL parse failed: ${error instanceof Error ? error.message : String(error)}. Line: ${line}`,
          );
        }
      });

    const turnError = parsedEvents
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
      .find((message) => message.trim().length > 0);

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

    return parsedEvents;
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
          name: 'execute_command',
          arguments: JSON.stringify({
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
          name: 'apply_patch',
          arguments: JSON.stringify({
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
          name: 'write_todo',
          arguments: JSON.stringify({
            items: item.items,
          }),
        },
      };
    case 'mcp_tool_call':
      return {
        id: String(item.id ?? `codex-mcp-${Date.now()}`),
        type: 'function',
        function: {
          name: String(item.tool ?? 'mcp_tool_call'),
          arguments: JSON.stringify(item.arguments ?? {}),
        },
      };
    default:
      return null;
  }
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
      const turn = await codexThread.run(prompt, {
        signal: options?.signal,
      });
      const finalResponse =
        typeof turn.finalResponse === 'string' ? turn.finalResponse : '';

      return createTextChatResponse({
        id: `codex-chat-${Date.now()}`,
        model: options?.model || 'codex',
        content: finalResponse,
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
      const streamedTurn = await codexThread.runStreamed(prompt, {
        signal: options?.signal,
      });

      for await (const event of streamedTurn.events) {
        switch (event.type) {
          case 'item.updated':
          case 'item.completed': {
            const item = event.item;
            if (!item || typeof item !== 'object') {
              continue;
            }

            const itemRecord = item as Record<string, unknown>;
            if (itemRecord.type === 'agent_message' && typeof itemRecord.text === 'string') {
              yield createTextStreamChunk({
                id,
                created,
                model,
                role: 'assistant',
                content: itemRecord.text,
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

  constructor(options: CodexChatEngineOptions = {}) {
    this.officialSdkBridgeLoader =
      options.officialSdkBridgeLoader ?? DEFAULT_CODEX_OFFICIAL_SDK_BRIDGE_LOADER;
    this.cliJsonlTurnExecutor =
      options.cliJsonlTurnExecutor === undefined
        ? executeCodexCliJsonlTurn
        : options.cliJsonlTurnExecutor;
  }

  describeIntegration() {
    return CODEX_INTEGRATION;
  }

  describeRawExtensions() {
    return CODEX_RAW_EXTENSIONS;
  }

  getHealth() {
    const localConfiguration = readCodexLocalConfiguration();
    const health = createDetectedHealthReport({
      descriptor: CODEX_INTEGRATION,
      packagePresence: CODEX_PACKAGE,
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

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const bridge = await this.officialSdkBridgeLoader?.load();
    if (bridge?.sendMessage) {
      return bridge.sendMessage(messages, options);
    }

    const prompt = buildCodexCliPrompt(messages, options);
    if (!this.cliJsonlTurnExecutor) {
      throw new Error(CODEX_CLI_UNAVAILABLE_MESSAGE);
    }
    const events = await this.cliJsonlTurnExecutor(prompt, options);
    const assistantContent = events
      .map((event) =>
        event.type === 'item.updated' || event.type === 'item.completed'
          ? event.item && typeof event.item === 'object'
            ? event.item as Record<string, unknown>
            : null
          : null,
      )
      .filter((item): item is Record<string, unknown> => item !== null)
      .filter((item) => item.type === 'agent_message' && typeof item.text === 'string')
      .map((item) => String(item.text))
      .at(-1);

    if (!assistantContent) {
      throw new Error('Codex CLI did not return an assistant response.');
    }

    return createTextChatResponse({
      id: `codex-chat-${Date.now()}`,
      model: options?.model || 'codex',
      content: assistantContent,
    });
  }

  async *sendMessageStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const bridge = await this.officialSdkBridgeLoader?.load();
    if (bridge?.sendMessageStream) {
      yield* await bridge.sendMessageStream(messages, options);
      return;
    }

    if (bridge?.sendMessage) {
      const response = await bridge.sendMessage(messages, options);
      yield createTextStreamChunk({
        id: response.id,
        created: response.created,
        model: response.model,
        role: response.choices[0]?.message.role,
        content: response.choices[0]?.message.content,
        finishReason: response.choices[0]?.finish_reason,
      });
      return;
    }

    const id = `codex-chat-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = options?.model || 'codex';
    const itemContentById = new Map<string, string>();
    if (!this.cliJsonlTurnExecutor) {
      throw new Error(CODEX_CLI_UNAVAILABLE_MESSAGE);
    }
    const events = await this.cliJsonlTurnExecutor(buildCodexCliPrompt(messages, options), options);

    for (const event of events) {
      switch (event.type) {
        case 'item.updated':
        case 'item.completed': {
          const item = event.item;
          if (!item || typeof item !== 'object') {
            continue;
          }

          const itemRecord = item as Record<string, unknown>;
          if (itemRecord.type === 'agent_message' && typeof itemRecord.text === 'string') {
            const itemId = String(itemRecord.id ?? 'codex-agent-message');
            const contentDelta = getCodexAgentMessageDelta(
              itemId,
              itemRecord.text,
              itemContentById,
            );
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
  }
}
