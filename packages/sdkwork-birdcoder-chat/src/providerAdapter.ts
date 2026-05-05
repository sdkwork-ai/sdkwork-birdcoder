import {
  parseBirdCoderApiJson,
  stringifyBirdCoderLongInteger,
  stringifyBirdCoderApiJson,
} from '@sdkwork/birdcoder-types';
import type {
  BirdCoderCodeEngineKey,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineTransportKind,
} from '@sdkwork/birdcoder-types';
import type {
  ChatCanonicalEvent,
  ChatCanonicalRuntimeDescriptor,
  ChatContext,
  ChatEngineCapabilityName,
  ChatEngineCapabilitySnapshot,
  ChatEngineHealthReport,
  ChatEngineIntegrationClass,
  ChatEngineIntegrationDescriptor,
  ChatEngineOfficialEntry,
  ChatEngineRawExtensionDescriptor,
  ChatEngineRuntimeMode,
  ChatEngineSourceMirrorStatus,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatStreamChunk,
  IChatCodingSession,
  IChatSession,
  Role,
  ToolCall,
} from './types.ts';

interface NodeFsModule {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
}

interface NodePathModule {
  resolve(...paths: string[]): string;
  dirname(path: string): string;
  join(...paths: string[]): string;
  parse(path: string): { root: string };
  extname(path: string): string;
  delimiter: string;
}

interface NodeUrlModule {
  pathToFileURL(path: string): { href: string };
}

interface NodeModuleModule {
  createRequire(url: string): {
    resolve(specifier: string): string;
  };
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

export interface ChatEngineOfficialSdkBridge {
  sendMessage?(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse>;
  sendMessageStream?(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncIterable<ChatStreamChunk> | Promise<AsyncIterable<ChatStreamChunk>>;
}

export interface ChatEngineOfficialSdkBridgeLoader<
  TBridge extends ChatEngineOfficialSdkBridge = ChatEngineOfficialSdkBridge,
> {
  load(): Promise<TBridge | null>;
}

export interface ChatEngineOfficialSdkModuleCandidate {
  kind?: 'package' | 'path';
  specifier: string;
}

export interface ModuleBackedOfficialSdkBridgeLoaderInput<
  TBridge extends ChatEngineOfficialSdkBridge,
> {
  candidates: readonly ChatEngineOfficialSdkModuleCandidate[];
  createBridge: (
    moduleNamespace: Record<string, unknown>,
  ) => Promise<TBridge | null> | TBridge | null;
}

export interface InvokeWithOptionalOfficialSdkInput<
  TBridge extends ChatEngineOfficialSdkBridge = ChatEngineOfficialSdkBridge,
> {
  loader?: ChatEngineOfficialSdkBridgeLoader<TBridge> | null;
  messages: ChatMessage[];
  options?: ChatOptions;
  fallback: () => Promise<ChatResponse>;
}

export interface StreamWithOptionalOfficialSdkInput<
  TBridge extends ChatEngineOfficialSdkBridge = ChatEngineOfficialSdkBridge,
> {
  loader?: ChatEngineOfficialSdkBridgeLoader<TBridge> | null;
  messages: ChatMessage[];
  options?: ChatOptions;
  fallback: (options: ChatOptions) => AsyncGenerator<ChatStreamChunk, void, unknown>;
}

export interface TextChatResponseInput {
  id: string;
  model: string;
  content: string;
  created?: number;
  messageId?: string;
  role?: Role;
  finishReason?: ChatResponse['choices'][number]['finish_reason'];
  toolCalls?: ToolCall[];
  usage?: ChatResponse['usage'];
}

export interface TextChatStreamChunkInput {
  id: string;
  model: string;
  content?: string;
  created?: number;
  role?: Role;
  finishReason?: ChatStreamChunk['choices'][number]['finish_reason'];
}

export interface ToolCallStreamChunkInput {
  id: string;
  model: string;
  toolCall: ToolCall;
  created?: number;
  finishReason?: ChatStreamChunk['choices'][number]['finish_reason'];
}

export interface StaticIntegrationDescriptorInput {
  engineId: BirdCoderCodeEngineKey;
  integrationClass?: ChatEngineIntegrationClass;
  runtimeMode?: ChatEngineRuntimeMode;
  officialEntry: ChatEngineOfficialEntry;
  transportKinds: readonly BirdCoderEngineTransportKind[];
  sourceMirrorPath?: string | null;
  notes?: string;
}

export interface RuntimeIntegrationDescriptorInput extends StaticIntegrationDescriptorInput {
  packagePresence?: ChatEnginePackagePresence;
}

export interface StaticHealthReportInput {
  descriptor: ChatEngineIntegrationDescriptor;
  status?: ChatEngineHealthReport['status'];
  sdkAvailable?: boolean;
  cliAvailable?: boolean;
  authConfigured?: boolean;
  fallbackActive?: boolean;
  diagnostics?: readonly string[];
}

export interface ChatEnginePackagePresence {
  packageName: string;
  installed: boolean;
  installedVersion?: string;
  installedPackageJsonPath?: string;
  mirrorVersion?: string;
  mirrorPackageJsonPath?: string | null;
}

export interface ResolvePackagePresenceInput {
  packageName: string;
  mirrorPackageJsonPath?: string | null;
}

export interface DetectedHealthReportInput {
  descriptor: ChatEngineIntegrationDescriptor;
  packagePresence: ChatEnginePackagePresence;
  executable?: string | null;
  authEnvKeys?: readonly string[];
  authConfigurationHints?: readonly string[];
  cliAvailable?: boolean;
  authConfigured?: boolean;
  fallbackRuntimeMode?: ChatEngineRuntimeMode | null;
  fallbackAvailable?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface CapabilitySnapshotInput {
  capabilityMatrix: BirdCoderEngineCapabilityMatrix;
  health: ChatEngineHealthReport;
  experimentalCapabilities?: readonly string[];
}

export interface RawExtensionDescriptorInput {
  provider: BirdCoderCodeEngineKey;
  primaryLane: string;
  supplementalLanes?: readonly string[];
  nativeEventModel: readonly string[];
  nativeArtifactModel?: readonly string[];
  experimentalFeatures?: readonly string[];
  notes?: string;
}

export interface DefaultChatEngineRuntimeDescriptorInput {
  descriptor: ChatEngineIntegrationDescriptor;
  capabilityMatrix?: Partial<BirdCoderEngineCapabilityMatrix>;
  health?: ChatEngineHealthReport | null;
  options?: ChatOptions;
}

export interface DefaultChatEngineCapabilitySnapshotInput {
  capabilityMatrix?: Partial<BirdCoderEngineCapabilityMatrix>;
  health: ChatEngineHealthReport;
  experimentalCapabilities?: readonly string[];
}

export interface CanonicalEventsFromChatStreamInput {
  messages: readonly ChatMessage[];
  runtime: ChatCanonicalRuntimeDescriptor;
  stream: AsyncIterable<ChatStreamChunk>;
}

export interface LocalChatEngineState {
  createCodingSession(sessionId: string, title?: string): Promise<IChatCodingSession>;
  createSession(projectId: string): Promise<IChatSession>;
  getCodingSession(codingSessionId: string): Promise<IChatCodingSession | null>;
  getContext(): ChatContext | null;
  getSession(sessionId: string): Promise<IChatSession | null>;
  onToolCall(toolCall: ToolCall): Promise<string>;
  updateContext(context: ChatContext): void;
  addMessageToCodingSession(codingSessionId: string, message: ChatMessage): Promise<void>;
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

function getFsModule(): NodeFsModule | null {
  return isNodeRuntime() ? getBuiltinModule<NodeFsModule>('node:fs') : null;
}

function getPathModule(): NodePathModule | null {
  return isNodeRuntime() ? getBuiltinModule<NodePathModule>('node:path') : null;
}

function getUrlModule(): NodeUrlModule | null {
  return isNodeRuntime() ? getBuiltinModule<NodeUrlModule>('node:url') : null;
}

function getCreateRequire(): NodeModuleModule['createRequire'] | null {
  const moduleModule = isNodeRuntime()
    ? getBuiltinModule<NodeModuleModule>('node:module')
    : null;
  return moduleModule?.createRequire ?? null;
}

function getWorkingDirectory(): string {
  return getRuntimeProcess()?.cwd() ?? '.';
}

function getRuntimeEnv(): NodeJS.ProcessEnv {
  return getRuntimeProcess()?.env ?? {};
}

export function resolveRuntimeWorkingDirectory(
  fallback = '.',
): string {
  const workingDirectory = getWorkingDirectory();
  return workingDirectory || fallback;
}

export function readRuntimeEnvValue(
  envKey: string,
): string | undefined {
  const value = getRuntimeEnv()[envKey];
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined;
}

export function withStreamEnabledChatOptions(options?: ChatOptions): ChatOptions {
  return {
    ...(options ?? {}),
    stream: true,
  };
}

function resolveImportSpecifier(
  candidate: ChatEngineOfficialSdkModuleCandidate,
): string {
  if (candidate.kind === 'path') {
    const pathModule = getPathModule();
    const urlModule = getUrlModule();
    if (!pathModule || !urlModule) {
      return candidate.specifier;
    }
    return urlModule.pathToFileURL(
      pathModule.resolve(getWorkingDirectory(), candidate.specifier),
    ).href;
  }

  return candidate.specifier;
}

export function buildMessageTranscriptPrompt(
  messages: readonly ChatMessage[],
): string {
  return messages
    .map(formatTranscriptMessage)
    .join('\n\n')
    .trim();
}

function formatTranscriptMessage(message: ChatMessage): string {
  const lines = [`${message.role.toUpperCase()}: ${message.content}`];
  const toolCallsJson = stringifyTranscriptPayload(message.tool_calls);
  if (toolCallsJson) {
    lines.push(`TOOL_CALLS: ${toolCallsJson}`);
  }
  if (message.tool_call_id?.trim()) {
    lines.push(`TOOL_CALL_ID: ${message.tool_call_id.trim()}`);
  }
  const attachmentsJson = stringifyTranscriptPayload(message.attachments);
  if (attachmentsJson) {
    lines.push(`ATTACHMENTS: ${attachmentsJson}`);
  }

  return lines.join('\n');
}

function stringifyTranscriptPayload(value: unknown): string | null {
  if (Array.isArray(value) && value.length === 0) {
    return null;
  }
  if (value === undefined || value === null) {
    return null;
  }

  try {
    const serializedValue = stringifyBirdCoderApiJson(value);
    return serializedValue && serializedValue !== 'null' ? serializedValue : null;
  } catch {
    return null;
  }
}

export function stringifyProviderToolArgumentPayload(value: unknown): string {
  return stringifyBirdCoderApiJson(value);
}

function isProviderToolArgumentRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeProviderToolArgumentRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return {};
    }

    try {
      const parsedValue = parseBirdCoderApiJson(normalizedValue) as unknown;
      return isProviderToolArgumentRecord(parsedValue)
        ? { ...parsedValue }
        : { input: parsedValue };
    } catch {
      return {
        input: value,
      };
    }
  }

  if (isProviderToolArgumentRecord(value)) {
    return {
      ...value,
    };
  }

  return value === undefined || value === null ? {} : { input: value };
}

export function resolveCumulativeTextDelta(
  previousText: string,
  nextText: string,
): string {
  if (!nextText) {
    return '';
  }

  if (!previousText) {
    return nextText;
  }

  if (nextText.startsWith(previousText)) {
    return nextText.slice(previousText.length);
  }

  const overlapLimit = Math.min(previousText.length, nextText.length);
  for (let overlapLength = overlapLimit; overlapLength > 0; overlapLength -= 1) {
    if (previousText.slice(-overlapLength) === nextText.slice(0, overlapLength)) {
      return nextText.slice(overlapLength);
    }
  }

  return nextText;
}

export function createTextChatResponse(
  input: TextChatResponseInput,
): ChatResponse {
  const created = input.created ?? Math.floor(Date.now() / 1000);

  return {
    id: input.id,
    object: 'chat.completion',
    created,
    model: input.model,
    choices: [
      {
        index: 0,
        message: {
          id: input.messageId ?? `${input.id}-message`,
          role: input.role ?? 'assistant',
          content: input.content,
          ...(input.toolCalls && input.toolCalls.length > 0 ? { tool_calls: input.toolCalls } : {}),
          timestamp: Date.now(),
        },
        finish_reason:
          input.finishReason ??
          (input.toolCalls && input.toolCalls.length > 0 ? 'tool_calls' : 'stop'),
      },
    ],
    usage: input.usage,
  };
}

export function createTextStreamChunk(
  input: TextChatStreamChunkInput,
): ChatStreamChunk {
  return {
    id: input.id,
    object: 'chat.completion.chunk',
    created: input.created ?? Math.floor(Date.now() / 1000),
    model: input.model,
    choices: [
      {
        index: 0,
        delta: {
          content: input.content,
          role: input.role,
        },
        finish_reason: input.finishReason ?? null,
      },
    ],
  };
}

export function createToolCallStreamChunk(
  input: ToolCallStreamChunkInput,
): ChatStreamChunk {
  return {
    id: input.id,
    object: 'chat.completion.chunk',
    created: input.created ?? Math.floor(Date.now() / 1000),
    model: input.model,
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [input.toolCall],
        },
        finish_reason: input.finishReason ?? 'tool_calls',
      },
    ],
  };
}

export async function* streamResponseAsChunks(
  response: ChatResponse,
): AsyncGenerator<ChatStreamChunk, void, unknown> {
  const choice = response.choices[0];
  if (!choice) {
    return;
  }

  if (choice.message.content) {
    yield createTextStreamChunk({
      id: response.id,
      model: response.model,
      content: choice.message.content,
      role: choice.message.role,
      created: response.created,
      finishReason: (choice.message.tool_calls?.length ?? 0) > 0 ? null : choice.finish_reason,
    });
  }

  for (const toolCall of choice.message.tool_calls ?? []) {
    yield createToolCallStreamChunk({
      id: response.id,
      model: response.model,
      created: response.created,
      toolCall,
      finishReason: 'tool_calls',
    });
  }

  if (!choice.message.content && (choice.message.tool_calls?.length ?? 0) === 0) {
    yield createTextStreamChunk({
      id: response.id,
      model: response.model,
      content: '',
      role: choice.message.role,
      created: response.created,
      finishReason: choice.finish_reason,
    });
  }
}

export function createModuleBackedOfficialSdkBridgeLoader<
  TBridge extends ChatEngineOfficialSdkBridge,
>(
  input: ModuleBackedOfficialSdkBridgeLoaderInput<TBridge>,
): ChatEngineOfficialSdkBridgeLoader<TBridge> {
  let loadPromise: Promise<TBridge | null> | null = null;

  return {
    async load(): Promise<TBridge | null> {
      if (!isNodeRuntime()) {
        return null;
      }

      if (!loadPromise) {
        loadPromise = (async () => {
          for (const candidate of input.candidates) {
            try {
              const specifier = resolveImportSpecifier(candidate);
              const moduleNamespace = await import(
                /* @vite-ignore */ specifier
              ) as Record<string, unknown>;
              const bridge = await input.createBridge(moduleNamespace);
              if (bridge) {
                return bridge;
              }
            } catch {
              // Try the next installed package or local mirror candidate.
            }
          }

          return null;
        })();
      }

      return loadPromise;
    },
  };
}

async function resolveOptionalOfficialSdkBridge<
  TBridge extends ChatEngineOfficialSdkBridge,
>(
  loader?: ChatEngineOfficialSdkBridgeLoader<TBridge> | null,
): Promise<TBridge | null> {
  if (!loader) {
    return null;
  }

  try {
    return await loader.load();
  } catch {
    return null;
  }
}

export async function invokeWithOptionalOfficialSdk<
  TBridge extends ChatEngineOfficialSdkBridge,
>(
  input: InvokeWithOptionalOfficialSdkInput<TBridge>,
): Promise<ChatResponse> {
  const bridge = await resolveOptionalOfficialSdkBridge(input.loader);
  if (bridge?.sendMessage) {
    return bridge.sendMessage(input.messages, input.options);
  }

  return input.fallback();
}

export async function* streamWithOptionalOfficialSdk<
  TBridge extends ChatEngineOfficialSdkBridge,
>(
  input: StreamWithOptionalOfficialSdkInput<TBridge>,
): AsyncGenerator<ChatStreamChunk, void, unknown> {
  const streamOptions = withStreamEnabledChatOptions(input.options);
  const bridge = await resolveOptionalOfficialSdkBridge(input.loader);
  if (bridge?.sendMessageStream) {
    yield* await bridge.sendMessageStream(input.messages, streamOptions);
    return;
  }

  if (bridge?.sendMessage) {
    yield* streamResponseAsChunks(
      await bridge.sendMessage(input.messages, streamOptions),
    );
    return;
  }

  yield* input.fallback(streamOptions);
}

function readPackageVersion(
  packageJsonPath: string | null | undefined,
): string | undefined {
  const fsModule = getFsModule();
  const pathModule = getPathModule();
  if (!packageJsonPath || !fsModule || !pathModule) {
    return undefined;
  }

  const absolutePath = pathModule.resolve(getWorkingDirectory(), packageJsonPath);
  if (!fsModule.existsSync(absolutePath)) {
    return undefined;
  }

  try {
    const packageJson = JSON.parse(fsModule.readFileSync(absolutePath, 'utf8')) as {
      version?: string;
    };
    return packageJson.version;
  } catch {
    return undefined;
  }
}

function findNearestPackageJsonPath(
  startPath: string,
): string | undefined {
  const fsModule = getFsModule();
  const pathModule = getPathModule();
  if (!fsModule || !pathModule) {
    return undefined;
  }

  let currentPath = pathModule.dirname(startPath);
  const rootPath = pathModule.parse(currentPath).root;

  while (currentPath && currentPath !== rootPath) {
    const candidate = pathModule.join(currentPath, 'package.json');
    if (fsModule.existsSync(candidate)) {
      return candidate;
    }
    currentPath = pathModule.dirname(currentPath);
  }

  const rootCandidate = pathModule.join(rootPath, 'package.json');
  return fsModule.existsSync(rootCandidate) ? rootCandidate : undefined;
}

export function resolveMirrorPresence(
  relativePath: string | null | undefined,
): ChatEngineSourceMirrorStatus {
  if (!relativePath) {
    return 'sdk-only';
  }

  const fsModule = getFsModule();
  const pathModule = getPathModule();
  if (!fsModule || !pathModule) {
    return 'missing';
  }

  const absolutePath = pathModule.resolve(getWorkingDirectory(), relativePath);
  return fsModule.existsSync(absolutePath) ? 'mirrored' : 'missing';
}

export function resolveRuntimeModeFromTransport(
  transportKinds: readonly BirdCoderEngineTransportKind[],
): ChatEngineRuntimeMode {
  const primaryTransport = transportKinds[0];
  switch (primaryTransport) {
    case 'sdk-stream':
      return 'sdk';
    case 'remote-control-http':
      return 'remote-control';
    case 'cli-jsonl':
      return 'headless';
    case 'json-rpc-v2':
    case 'openapi-http':
    default:
      return 'protocol-fallback';
  }
}

export function resolveFallbackRuntimeMode(
  transportKinds: readonly BirdCoderEngineTransportKind[],
): ChatEngineRuntimeMode | null {
  const fallbackTransport = transportKinds.find((transportKind) => transportKind !== 'sdk-stream');
  return fallbackTransport ? resolveRuntimeModeFromTransport([fallbackTransport]) : null;
}

function inferFallbackAvailability(
  fallbackRuntimeMode: ChatEngineRuntimeMode | null,
  cliAvailable: boolean,
): boolean {
  switch (fallbackRuntimeMode) {
    case 'headless':
      return cliAvailable;
    case 'remote-control':
    case 'protocol-fallback':
    case 'sdk':
    default:
      return false;
  }
}

export function resolveTransportKindForRuntimeMode(
  transportKinds: readonly BirdCoderEngineTransportKind[],
  runtimeMode: ChatEngineRuntimeMode,
): BirdCoderEngineTransportKind {
  const preferredTransportByRuntimeMode: Record<ChatEngineRuntimeMode, readonly BirdCoderEngineTransportKind[]> = {
    sdk: ['sdk-stream'],
    headless: ['cli-jsonl'],
    'remote-control': ['remote-control-http'],
    'protocol-fallback': ['json-rpc-v2', 'openapi-http'],
  };

  const preferredTransport = preferredTransportByRuntimeMode[runtimeMode]
    .find((transportKind) => transportKinds.includes(transportKind));
  if (preferredTransport) {
    return preferredTransport;
  }

  const sameRuntimeTransport = transportKinds.find(
    (transportKind) => resolveRuntimeModeFromTransport([transportKind]) === runtimeMode,
  );
  if (sameRuntimeTransport) {
    return sameRuntimeTransport;
  }

  return transportKinds[0] ?? 'sdk-stream';
}

export function resolvePackagePresence(
  input: ResolvePackagePresenceInput,
): ChatEnginePackagePresence {
  const mirrorVersion = readPackageVersion(input.mirrorPackageJsonPath);
  const createRequire = getCreateRequire();
  if (!createRequire) {
    return {
      packageName: input.packageName,
      installed: false,
      mirrorVersion,
      mirrorPackageJsonPath: input.mirrorPackageJsonPath ?? null,
    };
  }

  try {
    const runtimeRequire = createRequire(import.meta.url);
    const resolvedEntryPoint = runtimeRequire.resolve(input.packageName);
    const installedPackageJsonPath = findNearestPackageJsonPath(resolvedEntryPoint);
    return {
      packageName: input.packageName,
      installed: true,
      installedVersion: readPackageVersion(installedPackageJsonPath),
      installedPackageJsonPath,
      mirrorVersion,
      mirrorPackageJsonPath: input.mirrorPackageJsonPath ?? null,
    };
  } catch {
    return {
      packageName: input.packageName,
      installed: false,
      mirrorVersion,
      mirrorPackageJsonPath: input.mirrorPackageJsonPath ?? null,
    };
  }
}

export function resolveExecutablePresence(
  executable: string,
  env: NodeJS.ProcessEnv = getRuntimeEnv(),
): boolean {
  const fsModule = getFsModule();
  const pathModule = getPathModule();
  const runtimeProcess = getRuntimeProcess();
  if (!fsModule || !pathModule || !runtimeProcess) {
    return false;
  }

  const pathValue = env.PATH ?? '';
  if (!pathValue.trim()) {
    return false;
  }

  const pathEntries = pathValue.split(pathModule.delimiter).filter(Boolean);
  const usePathExt = runtimeProcess.platform === 'win32' || Boolean(env.PATHEXT?.trim());
  const pathExtEntries = usePathExt
    ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];
  const executableExtension = pathModule.extname(executable);
  const candidateSuffixes = executableExtension ? [''] : pathExtEntries;

  return pathEntries.some((directory) =>
    candidateSuffixes.some((suffix) =>
      fsModule.existsSync(pathModule.join(directory, `${executable}${suffix}`)),
    ),
  );
}

export function createDetectedHealthReport(
  input: DetectedHealthReportInput,
): ChatEngineHealthReport {
  const env = input.env ?? getRuntimeEnv();
  const cliAvailable = input.cliAvailable ?? (
    input.executable ? resolveExecutablePresence(input.executable, env) : false
  );
  const authConfigured = input.authConfigured ?? (
    input.authEnvKeys?.some((envKey) => Boolean(env[envKey]?.trim())) ?? true
  );
  const sdkAvailable = input.packagePresence.installed;
  const fallbackRuntimeMode = sdkAvailable
    ? null
    : input.fallbackRuntimeMode === undefined
      ? resolveFallbackRuntimeMode(input.descriptor.transportKinds)
      : input.fallbackRuntimeMode;
  const fallbackAvailable = !sdkAvailable && (
    input.fallbackAvailable ??
    inferFallbackAvailability(fallbackRuntimeMode, cliAvailable)
  );
  const fallbackActive = !sdkAvailable && fallbackAvailable && fallbackRuntimeMode !== null;
  const runtimeMode = sdkAvailable
    ? input.descriptor.runtimeMode
    : fallbackActive && fallbackRuntimeMode
      ? fallbackRuntimeMode
      : input.descriptor.runtimeMode;
  const diagnostics: string[] = [];

  if (!sdkAvailable) {
    diagnostics.push(`Official SDK package ${input.packagePresence.packageName} is not installed in this workspace.`);
  }
  if (input.packagePresence.installedVersion) {
    diagnostics.push(`Installed SDK version: ${input.packagePresence.installedVersion}.`);
  } else if (input.packagePresence.mirrorVersion) {
    diagnostics.push(`Local mirror version: ${input.packagePresence.mirrorVersion}.`);
  }
  if (fallbackActive && fallbackRuntimeMode) {
    diagnostics.push(`Runtime fell back to the ${fallbackRuntimeMode} lane.`);
  } else if (!sdkAvailable && fallbackRuntimeMode && !fallbackAvailable) {
    diagnostics.push(`Configured fallback lane ${fallbackRuntimeMode} is not executable in the current runtime.`);
  }
  const authConfigurationHints = input.authConfigurationHints ?? input.authEnvKeys;
  if (!authConfigured && authConfigurationHints?.length) {
    diagnostics.push(`Missing auth configuration. Expected one of: ${authConfigurationHints.join(', ')}.`);
  }
  if (input.executable && !cliAvailable) {
    diagnostics.push(`Executable ${input.executable} was not found on PATH.`);
  }

  const runtimeReachable = sdkAvailable || fallbackAvailable;
  const status: ChatEngineHealthReport['status'] = sdkAvailable && authConfigured
    ? 'ready'
    : runtimeReachable
      ? 'degraded'
      : 'missing';

  return {
    status,
    runtimeMode,
    officialEntry: {
      ...input.descriptor.officialEntry,
      packageVersion:
        input.packagePresence.installedVersion ??
        input.packagePresence.mirrorVersion ??
        input.descriptor.officialEntry.packageVersion,
    },
    sdkAvailable,
    cliAvailable,
    authConfigured,
    fallbackActive,
    sourceMirrorStatus: input.descriptor.sourceMirrorStatus,
    diagnostics,
    checkedAt: Date.now(),
  };
}

export function createCapabilitySnapshot(
  input: CapabilitySnapshotInput,
): ChatEngineCapabilitySnapshot {
  const allCapabilityNames = Object.keys(input.capabilityMatrix) as ChatEngineCapabilityName[];
  const declaredCapabilities = allCapabilityNames.filter(
    (capabilityName) => input.capabilityMatrix[capabilityName],
  );
  const disabledCapabilities = allCapabilityNames.filter(
    (capabilityName) => !input.capabilityMatrix[capabilityName],
  );
  const detectedCapabilities =
    input.health.status === 'missing'
      ? []
      : declaredCapabilities;
  const experimentalCapabilities =
    input.health.runtimeMode === 'sdk' &&
    input.health.sdkAvailable &&
    !input.health.fallbackActive
      ? [...(input.experimentalCapabilities ?? [])]
      : [];

  return {
    runtimeMode: input.health.runtimeMode,
    sdkAvailable: input.health.sdkAvailable,
    fallbackActive: input.health.fallbackActive,
    declaredCapabilities,
    detectedCapabilities,
    experimentalCapabilities,
    disabledCapabilities,
  };
}

const DEFAULT_CHAT_ENGINE_CAPABILITY_MATRIX: BirdCoderEngineCapabilityMatrix = {
  chat: true,
  streaming: true,
  structuredOutput: false,
  toolCalls: true,
  planning: false,
  patchArtifacts: true,
  commandArtifacts: true,
  todoArtifacts: true,
  ptyArtifacts: false,
  previewArtifacts: false,
  testArtifacts: false,
  approvalCheckpoints: true,
  sessionResume: false,
  remoteBridge: false,
  mcp: false,
};

function resolveDefaultCapabilityMatrix(
  capabilityMatrix?: Partial<BirdCoderEngineCapabilityMatrix>,
): BirdCoderEngineCapabilityMatrix {
  return {
    ...DEFAULT_CHAT_ENGINE_CAPABILITY_MATRIX,
    ...(capabilityMatrix ?? {}),
  };
}

export function createDefaultChatEngineCapabilitySnapshot(
  input: DefaultChatEngineCapabilitySnapshotInput,
): ChatEngineCapabilitySnapshot {
  return createCapabilitySnapshot({
    capabilityMatrix: resolveDefaultCapabilityMatrix(input.capabilityMatrix),
    health: input.health,
    experimentalCapabilities: input.experimentalCapabilities,
  });
}

export function createDefaultChatCanonicalRuntimeDescriptor(
  input: DefaultChatEngineRuntimeDescriptorInput,
): ChatCanonicalRuntimeDescriptor {
  const health = input.health ?? null;
  const runtimeMode = health?.runtimeMode ?? input.descriptor.runtimeMode;

  return {
    engineId: input.descriptor.engineId,
    modelId: input.options?.model?.trim() || input.descriptor.engineId,
    transportKind: resolveTransportKindForRuntimeMode(
      input.descriptor.transportKinds,
      runtimeMode,
    ),
    approvalPolicy: 'OnRequest',
    capabilityMatrix: resolveDefaultCapabilityMatrix(input.capabilityMatrix),
  };
}

function createCanonicalEvent(
  sequence: number,
  kind: ChatCanonicalEvent['kind'],
  runtimeStatus: ChatCanonicalEvent['runtimeStatus'],
  payload: Record<string, unknown>,
): ChatCanonicalEvent {
  return {
    kind,
    sequence: stringifyBirdCoderLongInteger(sequence),
    runtimeStatus,
    payload,
  };
}

export async function* canonicalEventsFromChatStream(
  input: CanonicalEventsFromChatStreamInput,
): AsyncGenerator<ChatCanonicalEvent, void, unknown> {
  let sequence = 0;
  let combinedContent = '';
  let sawTerminalFinishReason = false;

  yield createCanonicalEvent(++sequence, 'session.started', 'ready', {
    engineId: input.runtime.engineId,
    modelId: input.runtime.modelId,
    transportKind: input.runtime.transportKind,
    approvalPolicy: input.runtime.approvalPolicy,
  });
  yield createCanonicalEvent(++sequence, 'turn.started', 'streaming', {
    messageCount: input.messages.length,
    lastMessageRole: input.messages.at(-1)?.role ?? null,
  });

  try {
    for await (const chunk of input.stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta;
      if (!choice || !delta) {
        continue;
      }

      if (typeof delta.content === 'string' && delta.content.length > 0) {
        combinedContent += delta.content;
        yield createCanonicalEvent(++sequence, 'message.delta', 'streaming', {
          chunkId: chunk.id,
          model: chunk.model,
          role: delta.role ?? 'assistant',
          contentDelta: delta.content,
        });
      }

      for (const toolCall of delta.tool_calls ?? []) {
        yield createCanonicalEvent(++sequence, 'tool.call.requested', 'awaiting_tool', {
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          toolArguments: toolCall.function.arguments,
        });
      }

      if (choice.finish_reason) {
        sawTerminalFinishReason = true;
        yield createCanonicalEvent(++sequence, 'operation.updated', 'completed', {
          finishReason: choice.finish_reason,
          status: 'completed',
        });
      }
    }
  } catch (error) {
    yield createCanonicalEvent(++sequence, 'turn.failed', 'failed', {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  yield createCanonicalEvent(++sequence, 'message.completed', 'completed', {
    role: 'assistant',
    content: combinedContent,
  });
  if (!sawTerminalFinishReason) {
    yield createCanonicalEvent(++sequence, 'operation.updated', 'completed', {
      status: 'completed',
    });
  }
  yield createCanonicalEvent(++sequence, 'turn.completed', 'completed', {
    contentLength: combinedContent.length,
    finishReason: 'stop',
  });
}

export function createLocalChatEngineState(): LocalChatEngineState {
  const sessions = new Map<string, IChatSession>();
  const codingSessions = new Map<string, IChatCodingSession>();
  let context: ChatContext | null = null;

  return {
    async createSession(projectId: string): Promise<IChatSession> {
      const now = Date.now();
      const session: IChatSession = {
        id: `chat-session-${now}-${sessions.size + 1}`,
        projectId,
        createdAt: now,
        updatedAt: now,
      };
      sessions.set(session.id, session);
      return session;
    },
    async getSession(sessionId: string): Promise<IChatSession | null> {
      return sessions.get(sessionId) ?? null;
    },
    async createCodingSession(sessionId: string, title = 'Coding Session'): Promise<IChatCodingSession> {
      const now = Date.now();
      const codingSession: IChatCodingSession = {
        id: `chat-coding-session-${now}-${codingSessions.size + 1}`,
        sessionId,
        title,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      codingSessions.set(codingSession.id, codingSession);
      return codingSession;
    },
    async getCodingSession(codingSessionId: string): Promise<IChatCodingSession | null> {
      return codingSessions.get(codingSessionId) ?? null;
    },
    async addMessageToCodingSession(codingSessionId: string, message: ChatMessage): Promise<void> {
      const codingSession = codingSessions.get(codingSessionId);
      if (!codingSession) {
        return;
      }

      codingSession.messages = [...codingSession.messages, message];
      codingSession.updatedAt = Date.now();
    },
    updateContext(nextContext: ChatContext): void {
      context = {
        ...(context ?? {}),
        ...nextContext,
      };
    },
    getContext(): ChatContext | null {
      return context;
    },
    async onToolCall(toolCall: ToolCall): Promise<string> {
      return stringifyProviderToolArgumentPayload({
        status: 'unhandled',
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
      });
    },
  };
}

export function createRawExtensionDescriptor(
  input: RawExtensionDescriptorInput,
): ChatEngineRawExtensionDescriptor {
  return {
    channel: 'extensions/raw',
    provider: input.provider,
    primaryLane: input.primaryLane,
    supplementalLanes: [...(input.supplementalLanes ?? [])],
    nativeEventModel: [...input.nativeEventModel],
    nativeArtifactModel: input.nativeArtifactModel ? [...input.nativeArtifactModel] : undefined,
    experimentalFeatures: [...(input.experimentalFeatures ?? [])],
    notes: input.notes,
  };
}

export function createStaticIntegrationDescriptor(
  input: StaticIntegrationDescriptorInput,
): ChatEngineIntegrationDescriptor {
  return createRuntimeIntegrationDescriptor(input);
}

export function createRuntimeIntegrationDescriptor(
  input: RuntimeIntegrationDescriptorInput,
): ChatEngineIntegrationDescriptor {
  const sourceMirrorPath = input.sourceMirrorPath ?? input.officialEntry.sourceMirrorPath ?? null;
  const sourceMirrorStatus = resolveMirrorPresence(sourceMirrorPath);
  const packageVersion =
    input.packagePresence?.installedVersion ??
    input.packagePresence?.mirrorVersion ??
    input.officialEntry.packageVersion;

  return {
    engineId: input.engineId,
    integrationClass: input.integrationClass ?? 'official-sdk',
    runtimeMode: input.runtimeMode ?? resolveRuntimeModeFromTransport(input.transportKinds),
    officialEntry: {
      ...input.officialEntry,
      packageVersion,
      sourceMirrorPath,
    },
    transportKinds: [...input.transportKinds],
    sourceMirrorPath,
    sourceMirrorStatus,
    notes: input.notes,
  };
}

export function createStaticHealthReport(
  input: StaticHealthReportInput,
): ChatEngineHealthReport {
  const diagnostics = [...(input.diagnostics ?? [])];
  const sdkAvailable = input.sdkAvailable ?? input.descriptor.sourceMirrorStatus !== 'missing';

  if (!sdkAvailable) {
    diagnostics.push('Official SDK mirror is not available in the current workspace.');
  }

  return {
    status: input.status ?? (sdkAvailable ? 'ready' : 'missing'),
    runtimeMode: input.descriptor.runtimeMode,
    officialEntry: input.descriptor.officialEntry,
    sdkAvailable,
    cliAvailable: input.cliAvailable ?? true,
    authConfigured: input.authConfigured ?? true,
    fallbackActive: input.fallbackActive ?? false,
    sourceMirrorStatus: input.descriptor.sourceMirrorStatus,
    diagnostics,
    checkedAt: Date.now(),
  };
}
