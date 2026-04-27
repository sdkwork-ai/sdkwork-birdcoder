import {
  buildMessageTranscriptPrompt,
  canonicalizeBirdCoderCodeEngineProviderToolName,
  createDetectedHealthReport,
  createModuleBackedOfficialSdkBridgeLoader,
  createRawExtensionDescriptor,
  createStaticIntegrationDescriptor,
  createTextChatResponse,
  createTextStreamChunk,
  createToolCallStreamChunk,
  invokeWithOptionalOfficialSdk,
  normalizeProviderToolArgumentRecord,
  parseBirdCoderApiJson,
  resolveCumulativeTextDelta,
  resolveRuntimeWorkingDirectory,
  resolvePackagePresence,
  streamResponseAsChunks,
  streamWithOptionalOfficialSdk,
  stringifyProviderToolArgumentPayload,
  type ChatEngineOfficialSdkBridge,
  type ChatEngineOfficialSdkBridgeLoader,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
  type IChatEngine,
  type ToolCall,
} from '@sdkwork/birdcoder-chat';

const CLAUDE_PACKAGE = resolvePackagePresence({
  packageName: '@anthropic-ai/claude-agent-sdk',
});

const CLAUDE_INTEGRATION = createStaticIntegrationDescriptor({
  engineId: 'claude-code',
  runtimeMode: 'sdk',
  transportKinds: ['sdk-stream', 'cli-jsonl'],
  sourceMirrorPath: 'external/claude-code',
  officialEntry: {
    packageName: '@anthropic-ai/claude-agent-sdk',
    packageVersion: CLAUDE_PACKAGE.installedVersion,
    cliPackageName: 'claude-code',
    sdkPath: null,
    sourceMirrorPath: 'external/claude-code',
    supplementalLanes: ['query stream', 'tool progress', 'preview sessions', 'Claude CLI print'],
  },
  notes:
    'BirdCoder uses the official Claude Agent SDK as the primary stable integration lane and falls back to the real Claude Code CLI print lane when the SDK package is unavailable.',
});

const CLAUDE_RAW_EXTENSIONS = createRawExtensionDescriptor({
  provider: 'claude-code',
  primaryLane: 'agent-query-tool-progress',
  supplementalLanes: CLAUDE_INTEGRATION.officialEntry.supplementalLanes,
  nativeEventModel: ['query.delta', 'tool.progress', 'approval.requested'],
  nativeArtifactModel: ['command-log', 'patch', 'review-note'],
  experimentalFeatures: ['preview-session-api'],
  notes: 'Claude raw lane preserves agent progress, headless control, and preview session semantics.',
});

export interface ClaudeChatEngineOptions {
  officialSdkBridgeLoader?: ChatEngineOfficialSdkBridgeLoader | null;
  claudeCliTurnExecutor?: ((prompt: string, options?: ChatOptions) => Promise<string>) | null;
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

interface ClaudeCliCommandSpec {
  command: string;
  prefixArgs: readonly string[];
}

interface ClaudeCliInvocation {
  command: string;
  args: readonly string[];
  workingDirectory: string;
  stdinPrompt: string;
}

const CLAUDE_CLI_UNAVAILABLE_MESSAGE =
  'Claude Code CLI runtime is unavailable. Install Claude Code and ensure the `claude` command is on PATH, or install `@anthropic-ai/claude-agent-sdk`.';
const CLAUDE_CLI_SPAWN_PERMISSION_MESSAGE =
  'Claude Code CLI could not be launched by the Node SDK bridge because the runtime denied child process creation (spawn EPERM). Allow BirdCoder to spawn the `claude` executable from the SDK bridge process, or run outside a process sandbox that blocks child_process.spawn.';
const CLAUDE_CLI_AUTHENTICATION_MESSAGE =
  'Claude Code CLI authentication is not configured. BirdCoder reuses your existing Claude Code login or ANTHROPIC_API_KEY; run `claude auth login` or set ANTHROPIC_API_KEY before using the claude-code engine.';
const CLAUDE_AUTH_ENV_KEYS = ['ANTHROPIC_API_KEY'] as const;
const CLAUDE_AUTH_CONFIGURATION_HINTS = [
  'ANTHROPIC_API_KEY',
  'Claude Code login (`claude auth login`)',
] as const;

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

function createClaudeCliCommandSpec(): ClaudeCliCommandSpec {
  const runtimeProcess = getRuntimeProcess();
  return runtimeProcess?.platform === 'win32'
    ? {
        command: runtimeProcess.env.ComSpec || 'cmd.exe',
        prefixArgs: ['/d', '/s', '/c', 'claude'],
      }
    : {
        command: 'claude',
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

function normalizeClaudeRequestedModel(value: string | null | undefined): string | null {
  const normalizedValue = normalizeOptionalIdentifier(value);
  if (!normalizedValue) {
    return null;
  }

  const normalizedModelKey = normalizedValue.toLowerCase();
  return normalizedModelKey === 'claude-code' || normalizedModelKey === 'claude code'
    ? null
    : normalizedValue;
}

function buildClaudeCliInvocation(
  prompt: string,
  options?: ChatOptions,
): ClaudeCliInvocation {
  const commandSpec = createClaudeCliCommandSpec();
  const workingDirectory =
    options?.context?.workspaceRoot?.trim() || resolveRuntimeWorkingDirectory();
  const args = [
    ...commandSpec.prefixArgs,
    '--print',
    '--output-format',
    'stream-json',
    '--verbose',
    '--no-session-persistence',
  ];
  const model = normalizeClaudeRequestedModel(options?.model);
  if (model) {
    args.push('--model', model);
  }

  return {
    command: commandSpec.command,
    args,
    workingDirectory,
    stdinPrompt: prompt,
  };
}

function isClaudeCliAuthenticationError(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();
  return (
    normalizedMessage.includes('auth') ||
    normalizedMessage.includes('login') ||
    normalizedMessage.includes('api key') ||
    normalizedMessage.includes('unauthorized') ||
    normalizedMessage.includes('subscription') ||
    normalizedMessage.includes('oauth')
  );
}

function isClaudeCliUnavailableError(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();
  return (
    normalizedMessage.includes('enoent') ||
    normalizedMessage.includes('not recognized') ||
    normalizedMessage.includes('not found') ||
    normalizedMessage.includes('command not found')
  );
}

function formatClaudeCliError(message: string): string {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return 'Claude Code CLI turn failed.';
  }

  if (isClaudeCliAuthenticationError(normalizedMessage)) {
    return CLAUDE_CLI_AUTHENTICATION_MESSAGE;
  }

  if (normalizedMessage.toLowerCase().includes('spawn eperm')) {
    return CLAUDE_CLI_SPAWN_PERMISSION_MESSAGE;
  }

  if (isClaudeCliUnavailableError(normalizedMessage)) {
    return CLAUDE_CLI_UNAVAILABLE_MESSAGE;
  }

  return normalizedMessage;
}

function buildClaudePrompt(messages: readonly ChatMessage[]): string {
  return buildMessageTranscriptPrompt(messages) || 'Review the current workspace.';
}

function extractClaudeText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => extractClaudeText(entry)).filter(Boolean).join('');
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  const preferredKeys = ['result', 'text', 'content', 'message', 'event'];
  for (const key of preferredKeys) {
    const text = extractClaudeText(record[key]);
    if (text) {
      return text;
    }
  }

  return '';
}

function isPlainClaudeRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeClaudeToolInput(
  value: unknown,
  nativeToolName: string,
): Record<string, unknown> {
  const input = normalizeProviderToolArgumentRecord(value);

  if (typeof input.file_path === 'string' && input.path === undefined) {
    input.path = input.file_path;
  }
  if (typeof input.command === 'string' && input.cmd === undefined) {
    input.cmd = input.command;
  }

  const canonicalToolName = canonicalizeBirdCoderCodeEngineProviderToolName({
    fallbackToolName: 'tool_use',
    provider: 'claude-code',
    toolName: nativeToolName,
  });
  if (canonicalToolName !== nativeToolName && input.claudeToolName === undefined) {
    return {
      claudeToolName: nativeToolName,
      ...input,
    };
  }

  return input;
}

function collectClaudeToolUseBlocks(
  value: unknown,
  toolCalls: ToolCall[],
  seenToolCallIds: Set<string>,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectClaudeToolUseBlocks(entry, toolCalls, seenToolCallIds);
    }
    return;
  }

  if (!isPlainClaudeRecord(value)) {
    return;
  }

  if (value.type === 'tool_use') {
    const nativeToolName = String(value.name ?? value.tool_name ?? 'tool_use');
    const toolCallId = String(
      value.id ?? value.tool_use_id ?? `claude-tool-use-${Date.now()}-${toolCalls.length}`,
    );
    if (!seenToolCallIds.has(toolCallId)) {
      seenToolCallIds.add(toolCallId);
      toolCalls.push({
        id: toolCallId,
        type: 'function',
        function: {
          name: canonicalizeBirdCoderCodeEngineProviderToolName({
            fallbackToolName: 'tool_use',
            provider: 'claude-code',
            toolName: nativeToolName,
          }),
          arguments: stringifyProviderToolArgumentPayload(
            normalizeClaudeToolInput(value.input ?? value.arguments, nativeToolName),
          ),
        },
      });
    }
    return;
  }

  for (const key of ['event', 'message', 'content']) {
    collectClaudeToolUseBlocks(value[key], toolCalls, seenToolCallIds);
  }
}

function extractClaudeToolCalls(value: unknown): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  collectClaudeToolUseBlocks(value, toolCalls, new Set());
  return toolCalls;
}

function createClaudeToolProgressCall(
  event: Record<string, unknown>,
): ToolCall {
  const nativeToolName = String(
    event.tool_name ?? event.toolName ?? 'tool_progress',
  );
  const progressInput = isPlainClaudeRecord(event.input)
    ? event.input
    : {};

  return {
    id: String(
      event.tool_use_id ?? event.toolUseId ?? `claude-tool-${Date.now()}`,
    ),
    type: 'function',
    function: {
      name: canonicalizeBirdCoderCodeEngineProviderToolName({
        fallbackToolName: 'tool_use',
        provider: 'claude-code',
        toolName: nativeToolName,
      }),
      arguments: stringifyProviderToolArgumentPayload(
        normalizeClaudeToolInput(
          {
            ...progressInput,
            elapsedTimeSeconds: event.elapsed_time_seconds,
            status: 'running',
          },
          nativeToolName,
        ),
      ),
    },
  };
}

function createClaudeSdkOptions(options?: ChatOptions): Record<string, unknown> {
  const model = normalizeClaudeRequestedModel(options?.model);
  return {
    ...(model ? { model } : {}),
    ...(options?.context?.workspaceRoot ? { cwd: options.context.workspaceRoot } : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  };
}

function mergeClaudeQueryResultText(
  streamedText: string,
  resultText: string,
): string {
  if (!resultText) {
    return streamedText;
  }

  if (!streamedText) {
    return resultText;
  }

  return streamedText + resolveCumulativeTextDelta(streamedText, resultText);
}

function parseClaudeCliJsonlResponseText(stdout: string): string {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return '';
  }

  let streamedResponseText = '';
  let resultResponseText = '';
  for (const line of lines) {
    let event: Record<string, unknown>;
    try {
      const parsed = parseBirdCoderApiJson(line) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return stdout.trim();
      }
      event = parsed as Record<string, unknown>;
    } catch {
      return stdout.trim();
    }

    switch (event.type) {
      case 'assistant':
        streamedResponseText += extractClaudeText(event.message ?? event);
        break;
      case 'result':
        resultResponseText = extractClaudeText(event.result ?? event);
        break;
      default:
        break;
    }
  }

  return mergeClaudeQueryResultText(streamedResponseText, resultResponseText);
}

async function executeClaudeCliTurn(
  prompt: string,
  options?: ChatOptions,
): Promise<string> {
  if (!isNodeRuntime()) {
    throw new Error(CLAUDE_CLI_UNAVAILABLE_MESSAGE);
  }

  const childProcessModule = getBuiltinModule<NodeChildProcessModule>('node:child_process');
  const runtimeProcess = getRuntimeProcess();
  if (!childProcessModule || !runtimeProcess) {
    throw new Error(CLAUDE_CLI_UNAVAILABLE_MESSAGE);
  }

  const invocation = buildClaudeCliInvocation(prompt, options);
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
      formatClaudeCliError(error instanceof Error ? error.message : String(error)),
    );
  }

  if (!child.stdin || !child.stdout || !child.stderr) {
    throw new Error(CLAUDE_CLI_UNAVAILABLE_MESSAGE);
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
    child.stdin.write(invocation.stdinPrompt);
    child.stdin.end();

    const exitCode = await waitForExit;
    if (exitCode !== 0) {
      throw new Error(
        formatClaudeCliError(
          stderr.trim() || stdout.trim() || `Claude Code CLI exited with status ${exitCode}.`,
        ),
      );
    }

    const assistantContent = parseClaudeCliJsonlResponseText(stdout).trim();
    if (!assistantContent) {
      throw new Error(
        stderr.trim()
          ? formatClaudeCliError(stderr.trim())
          : 'Claude Code CLI returned an empty assistant response.',
      );
    }

    return assistantContent;
  } catch (error) {
    throw new Error(
      formatClaudeCliError(error instanceof Error ? error.message : String(error)),
    );
  } finally {
    abortSignal?.removeEventListener('abort', handleAbort);
  }
}

export function createClaudeOfficialSdkBridge(
  moduleNamespace: Record<string, unknown>,
): ChatEngineOfficialSdkBridge | null {
  const promptOnce = typeof moduleNamespace.unstable_v2_prompt === 'function'
    ? moduleNamespace.unstable_v2_prompt as (
      prompt: string,
      options?: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>
    : null;
  const query = typeof moduleNamespace.query === 'function'
    ? moduleNamespace.query as (input: {
      prompt: string;
      options?: Record<string, unknown>;
    }) => AsyncIterable<Record<string, unknown>>
    : null;

  if (!promptOnce && !query) {
    return null;
  }

  return {
    async sendMessage(messages, options) {
      const prompt = buildClaudePrompt(messages);
      const sdkOptions = createClaudeSdkOptions(options);

      if (promptOnce) {
        const result = await promptOnce(prompt, sdkOptions);
        return createTextChatResponse({
          id: `claude-chat-${Date.now()}`,
          model: options?.model || 'claude-code',
          content: extractClaudeText(result),
          toolCalls: extractClaudeToolCalls(result),
        });
      }

      let streamedResponseText = '';
      let resultResponseText = '';
      const toolCalls: ToolCall[] = [];
      for await (const event of query!({ prompt, options: sdkOptions })) {
        switch (event.type) {
          case 'partial_assistant':
            streamedResponseText += extractClaudeText(event.event);
            break;
          case 'assistant': {
            const content = resolveCumulativeTextDelta(
              streamedResponseText,
              extractClaudeText(event),
            );
            streamedResponseText += content;
            toolCalls.push(...extractClaudeToolCalls(event));
            break;
          }
          case 'tool_progress': {
            toolCalls.push(createClaudeToolProgressCall(event));
            break;
          }
          case 'result':
            resultResponseText = extractClaudeText(event);
            break;
          default:
            break;
        }
      }

      return createTextChatResponse({
        id: `claude-chat-${Date.now()}`,
        model: options?.model || 'claude-code',
        content: mergeClaudeQueryResultText(
          streamedResponseText,
          resultResponseText,
        ),
        toolCalls,
      });
    },
    async *sendMessageStream(messages, options) {
      if (!query) {
        if (promptOnce) {
          const prompt = buildClaudePrompt(messages);
          const result = await promptOnce(prompt, createClaudeSdkOptions(options));
          yield* streamResponseAsChunks(createTextChatResponse({
            id: `claude-chat-${Date.now()}`,
            model: options?.model || 'claude-code',
            content: extractClaudeText(result),
            toolCalls: extractClaudeToolCalls(result),
          }));
        }
        return;
      }

      const id = `claude-chat-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      const model = options?.model || 'claude-code';
      const prompt = buildClaudePrompt(messages);
      let streamedResponseText = '';

      for await (const event of query({
        prompt,
        options: createClaudeSdkOptions(options),
      })) {
        switch (event.type) {
          case 'partial_assistant': {
            const content = extractClaudeText(event.event);
            if (content) {
              streamedResponseText += content;
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
          case 'assistant': {
            const content = resolveCumulativeTextDelta(
              streamedResponseText,
              extractClaudeText(event),
            );
            if (content) {
              streamedResponseText += content;
              yield createTextStreamChunk({
                id,
                created,
                model,
                role: 'assistant',
                content,
              });
            }
            for (const toolCall of extractClaudeToolCalls(event)) {
              yield createToolCallStreamChunk({
                id,
                created,
                model,
                toolCall,
              });
            }
            break;
          }
          case 'tool_progress': {
            yield createToolCallStreamChunk({
              id,
              created,
              model,
              toolCall: createClaudeToolProgressCall(event),
            });
            break;
          }
          case 'result': {
            const content = resolveCumulativeTextDelta(
              streamedResponseText,
              extractClaudeText(event),
            );
            if (content) {
              streamedResponseText += content;
              yield createTextStreamChunk({
                id,
                created,
                model,
                content,
                finishReason: 'stop',
              });
            } else {
              yield createTextStreamChunk({
                id,
                created,
                model,
                finishReason: 'stop',
              });
            }
            break;
          }
          case 'assistant_error':
            throw new Error(extractClaudeText(event.error) || 'Claude Agent SDK stream failed.');
          default:
            break;
        }
      }
    },
  };
}

const DEFAULT_CLAUDE_OFFICIAL_SDK_BRIDGE_LOADER = createModuleBackedOfficialSdkBridgeLoader({
  candidates: [
    {
      kind: 'package',
      specifier: '@anthropic-ai/claude-agent-sdk',
    },
  ],
  createBridge: createClaudeOfficialSdkBridge,
});

export class ClaudeChatEngine implements IChatEngine {
  name = 'claude-agent-sdk-adapter';
  version = '1.2.0';

  private readonly officialSdkBridgeLoader: ChatEngineOfficialSdkBridgeLoader | null;
  private readonly claudeCliTurnExecutor:
    | ((prompt: string, options?: ChatOptions) => Promise<string>)
    | null;

  constructor(options: ClaudeChatEngineOptions = {}) {
    this.officialSdkBridgeLoader =
      'officialSdkBridgeLoader' in options
        ? options.officialSdkBridgeLoader ?? null
        : DEFAULT_CLAUDE_OFFICIAL_SDK_BRIDGE_LOADER;
    this.claudeCliTurnExecutor =
      options.claudeCliTurnExecutor === undefined
        ? executeClaudeCliTurn
        : options.claudeCliTurnExecutor;
  }

  describeIntegration() {
    return CLAUDE_INTEGRATION;
  }

  describeRawExtensions() {
    return CLAUDE_RAW_EXTENSIONS;
  }

  getHealth() {
    return createDetectedHealthReport({
      descriptor: CLAUDE_INTEGRATION,
      packagePresence: CLAUDE_PACKAGE,
      executable: 'claude',
      authEnvKeys: CLAUDE_AUTH_ENV_KEYS,
      authConfigurationHints: CLAUDE_AUTH_CONFIGURATION_HINTS,
    });
  }

  private async sendMessageViaClaudeCli(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    if (!this.claudeCliTurnExecutor) {
      throw new Error(CLAUDE_CLI_UNAVAILABLE_MESSAGE);
    }

    const content = await this.claudeCliTurnExecutor(buildClaudePrompt(messages), options);
    if (!content.trim()) {
      throw new Error('Claude Code CLI returned an empty assistant response.');
    }

    return createTextChatResponse({
      id: `claude-chat-${Date.now()}`,
      model: options?.model || 'claude-code',
      content,
    });
  }

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return invokeWithOptionalOfficialSdk({
      loader: this.officialSdkBridgeLoader,
      messages,
      options,
      fallback: async () => this.sendMessageViaClaudeCli(messages, options),
    });
  }

  async *sendMessageStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const sendMessageViaClaudeCli = () => this.sendMessageViaClaudeCli(messages, options);
    yield* streamWithOptionalOfficialSdk({
      loader: this.officialSdkBridgeLoader,
      messages,
      options,
      fallback: async function* fallbackStream() {
        yield* streamResponseAsChunks(
          await sendMessageViaClaudeCli(),
        );
      },
    });
  }
}
