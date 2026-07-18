import { execFileSync as nodeExecFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BirdCoderEngineDescriptor } from '@sdkwork/birdcoder-pc-contracts-commons';
import { stringifyBirdCoderLongInteger } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  ChatCanonicalEvent,
  ChatCanonicalRuntimeDescriptor,
  ChatEngineCapabilitySnapshot,
  ChatEngineHealthReport,
  ChatEngineIntegrationDescriptor,
  ChatEngineRawExtensionDescriptor,
  ChatMessage,
  ChatOptions,
  IChatEngine,
} from '@sdkwork/birdcoder-pc-projection';
import {
  buildMessageTranscriptPrompt,
  createCapabilitySnapshot,
  createDefaultChatCanonicalRuntimeDescriptor,
  createRawExtensionDescriptor,
  createRuntimeIntegrationDescriptor,
  resolveExecutablePresence,
  resolvePackagePresence,
  resolveTransportKindForRuntimeMode,
} from '@sdkwork/birdcoder-pc-projection';

import type { WorkbenchCodeEngineId } from './catalog.ts';
import { findWorkbenchCodeEngineKernel } from './kernel.ts';

interface KernelTurnResult {
  assistantContent: string;
  nativeSessionId?: string | null;
  streamDeltas: string[];
}

const ADAPTER_NAMES: Record<WorkbenchCodeEngineId, string> = {
  codex: 'codex-kernel-cli-adapter',
  'claude-code': 'claude-code-kernel-cli-adapter',
  gemini: 'gemini-cli-kernel-cli-adapter',
  opencode: 'opencode-kernel-cli-adapter',
};

const DEFAULT_KERNEL_TURN_TIMEOUT_MS = 300_000;
const DEFAULT_KERNEL_TURN_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const LIVE_CONFIRMED_ENGINES = new Set<WorkbenchCodeEngineId>();

function resolveExecFileSync(): typeof nodeExecFileSync {
  const runtimeProcess = process as {
    getBuiltinModule?: (id: string) => { execFileSync?: typeof nodeExecFileSync } | undefined;
  };
  return runtimeProcess.getBuiltinModule?.('node:child_process')?.execFileSync ?? nodeExecFileSync;
}

function resolveKernelTurnBinary(): string {
  if (process.env.BIRDCODER_KERNEL_TURN_CONTRACT_MOCK === '1') {
    return 'birdcoder-kernel-turn';
  }

  const configured = process.env.BIRDCODER_KERNEL_TURN_BIN?.trim();
  if (configured && existsSync(configured)) {
    return configured;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(moduleDir, '../../../../../../..');
  const candidates = [
    join(repoRoot, 'target/debug/birdcoder-kernel-turn.exe'),
    join(repoRoot, 'target/debug/birdcoder-kernel-turn'),
    join(repoRoot, 'target/release/birdcoder-kernel-turn.exe'),
    join(repoRoot, 'target/release/birdcoder-kernel-turn'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'birdcoder-kernel-turn binary is unavailable. Build it with `cargo build -p sdkwork-birdcoder-kernel-bridge --bin birdcoder-kernel-turn` or set BIRDCODER_KERNEL_TURN_BIN.',
  );
}

function executeKernelTurn(input: {
  engineId: WorkbenchCodeEngineId;
  modelId: string;
  messages: readonly ChatMessage[];
  nativeSessionId?: string | null;
  options?: ChatOptions;
}): KernelTurnResult {
  const binary = resolveKernelTurnBinary();
  const context = input.options?.context;
  const workingDirectory = context?.workspaceRoot?.trim();
  if (context?.projectId?.trim() && !workingDirectory) {
    throw new Error(
      `Kernel turn for project ${context.projectId.trim()} requires an authoritative workspaceRoot.`,
    );
  }
  const payload = {
    engineId: input.engineId,
    modelId: input.modelId,
    requestKind: 'user_message',
    inputSummary: buildMessageTranscriptPrompt(input.messages),
    nativeSessionId: input.nativeSessionId ?? null,
    ideContext: context
      ? {
          workspaceId: context.workspaceId?.trim() || null,
          projectId: context.projectId?.trim() || null,
          sessionId: context.codingSessionId?.trim() || context.sessionId?.trim() || null,
          currentFile: context.currentFile
            ? {
                path: context.currentFile.path,
                content: context.currentFile.content,
                language: context.currentFile.language,
              }
            : null,
        }
      : null,
    workingDirectory: workingDirectory || null,
    timeoutMs: DEFAULT_KERNEL_TURN_TIMEOUT_MS,
    maxOutputBytes: DEFAULT_KERNEL_TURN_MAX_OUTPUT_BYTES,
    config: {
      approvalPolicy: 'on-failure',
      ephemeral: false,
      fullAuto: false,
      sandboxMode: 'danger-full-access',
      skipGitRepoCheck: false,
      temperature: input.options?.temperature,
      topP: input.options?.topP,
      maxTokens: input.options?.maxTokens,
    },
  };

  const stdout = resolveExecFileSync()(binary, [], {
    encoding: 'utf8',
    input: JSON.stringify(payload),
    maxBuffer: 10 * 1024 * 1024,
  });

  const parsed = JSON.parse(stdout) as {
    assistantContent?: string;
    nativeSessionId?: string | null;
    streamDeltas?: unknown;
  };

  return {
    assistantContent: parsed.assistantContent?.trim() ?? '',
    nativeSessionId: parsed.nativeSessionId ?? null,
    streamDeltas: Array.isArray(parsed.streamDeltas)
      ? parsed.streamDeltas.filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        )
      : [],
  };
}

const CLI_EXECUTABLE_BY_ENGINE: Record<WorkbenchCodeEngineId, string> = {
  codex: 'codex',
  'claude-code': 'claude',
  gemini: 'gemini',
  opencode: 'opencode',
};

const ENGINE_RAW_EXTENSION_PROFILES: Record<
  WorkbenchCodeEngineId,
  {
    nativeEventModel: readonly string[];
    experimentalFeatures?: readonly string[];
  }
> = {
  codex: {
    nativeEventModel: ['thread', 'turn', 'item'],
  },
  'claude-code': {
    nativeEventModel: ['agent-progress', 'tool-progress', 'approval'],
    experimentalFeatures: ['preview-session-api'],
  },
  gemini: {
    nativeEventModel: ['session', 'tool', 'skill', 'context'],
  },
  opencode: {
    nativeEventModel: ['session', 'part', 'artifact', 'event'],
  },
};

function createRawExtensionDescriptorForEngine(
  engineId: WorkbenchCodeEngineId,
  descriptor: BirdCoderEngineDescriptor,
): ChatEngineRawExtensionDescriptor {
  const officialEntry = descriptor.officialIntegration?.officialEntry;
  const profile = ENGINE_RAW_EXTENSION_PROFILES[engineId];

  return createRawExtensionDescriptor({
    provider: engineId,
    primaryLane: descriptor.accessPlan?.primaryLaneId ?? `${engineId}-sdk-stream`,
    supplementalLanes: officialEntry?.supplementalLanes?.length
      ? [...officialEntry.supplementalLanes]
      : [...(descriptor.accessPlan?.fallbackLaneIds ?? [])],
    nativeEventModel: [...profile.nativeEventModel],
    experimentalFeatures: profile.experimentalFeatures
      ? [...profile.experimentalFeatures]
      : undefined,
    notes: 'Provider-native semantics are exposed only through the extensions/raw lane.',
  });
}

function resolveEnginePackagePresence(
  engineId: WorkbenchCodeEngineId,
  descriptor: BirdCoderEngineDescriptor,
) {
  const officialEntry = descriptor.officialIntegration?.officialEntry;
  const packageName = officialEntry?.packageName ?? engineId;
  const mirrorPackageJsonPath = officialEntry?.sdkPath
    ? `${officialEntry.sdkPath}/package.json`
    : officialEntry?.sourceMirrorPath
      ? `${officialEntry.sourceMirrorPath}/package.json`
      : undefined;

  return resolvePackagePresence({
    packageName,
    mirrorPackageJsonPath,
  });
}

function createIntegrationDescriptor(
  engineId: WorkbenchCodeEngineId,
  descriptor: BirdCoderEngineDescriptor,
  packagePresence: ReturnType<typeof resolveEnginePackagePresence>,
): ChatEngineIntegrationDescriptor {
  const officialEntry = descriptor.officialIntegration?.officialEntry;
  const packageName = officialEntry?.packageName ?? engineId;

  return createRuntimeIntegrationDescriptor({
    engineId,
    integrationClass: 'official-protocol',
    runtimeMode: 'headless',
    officialEntry: {
      packageName,
      sdkPath: officialEntry?.sdkPath,
      cliPackageName: officialEntry?.cliPackageName,
      sourceMirrorPath: officialEntry?.sourceMirrorPath,
    },
    transportKinds: descriptor.transportKinds,
    sourceMirrorPath: officialEntry?.sourceMirrorPath,
    packagePresence,
    notes: 'Kernel bridge execution through the provider CLI lane via sdkwork-birdcoder-kernel-bridge.',
  });
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

export function createKernelTurnRuntime(
  engineId: unknown,
  input?: {
    defaultModelId?: string;
    descriptor?: BirdCoderEngineDescriptor;
  },
): IChatEngine {
  const kernel = findWorkbenchCodeEngineKernel(engineId);

  if (!kernel) {
    throw new Error(`Unknown engineId: ${String(engineId)}`);
  }

  const descriptor = input?.descriptor ?? kernel.descriptor;
  const packagePresence = resolveEnginePackagePresence(kernel.id, descriptor);
  const integration = createIntegrationDescriptor(kernel.id, descriptor, packagePresence);
  const adapterName = ADAPTER_NAMES[kernel.id];

  return {
    name: adapterName,
    version: '1.0.0',
    describeRuntime(options?: ChatOptions): ChatCanonicalRuntimeDescriptor {
      return createDefaultChatCanonicalRuntimeDescriptor({
        descriptor: integration,
        capabilityMatrix: descriptor.capabilityMatrix,
        options: {
          ...options,
          model: options?.model?.trim() || input?.defaultModelId || descriptor.defaultModelId,
        },
      });
    },
    describeIntegration(): ChatEngineIntegrationDescriptor {
      return integration;
    },
    async getHealth(): Promise<ChatEngineHealthReport> {
      const executable = CLI_EXECUTABLE_BY_ENGINE[kernel.id];
      const cliAvailable = resolveExecutablePresence(executable);
      const diagnostics: string[] = [];
      let kernelBinaryAvailable = false;

      try {
        resolveKernelTurnBinary();
        kernelBinaryAvailable = true;
        diagnostics.push('Kernel bridge binary is available.');
      } catch (error) {
        diagnostics.push(error instanceof Error ? error.message : String(error));
      }

      diagnostics.push(
        cliAvailable
          ? `Provider CLI executable ${executable} is available.`
          : `Provider CLI executable ${executable} was not found on PATH.`,
      );
      if (packagePresence.installed || packagePresence.mirrorVersion) {
        diagnostics.push(
          'An SDK package or source mirror is present, but the SDK lane remains planned until live conformance passes.',
        );
      }

      const runtimeAvailable = cliAvailable && kernelBinaryAvailable;
      const liveConfirmed = runtimeAvailable && LIVE_CONFIRMED_ENGINES.has(kernel.id);
      if (runtimeAvailable && !liveConfirmed) {
        diagnostics.push('CLI presence is detected; authentication and live provider conformance are not confirmed yet.');
      }

      return {
        status: runtimeAvailable ? (liveConfirmed ? 'ready' : 'degraded') : 'missing',
        runtimeMode: 'headless',
        officialEntry: integration.officialEntry,
        sdkAvailable: false,
        cliAvailable,
        authConfigured: liveConfirmed,
        fallbackActive: false,
        sourceMirrorStatus: integration.sourceMirrorStatus,
        diagnostics,
        checkedAt: Date.now(),
      };
    },
    async getCapabilities(): Promise<ChatEngineCapabilitySnapshot> {
      const health = await this.getHealth?.();
      if (!health) {
        throw new Error(`${adapterName} does not expose getHealth()`);
      }

      const rawExtensions = createRawExtensionDescriptorForEngine(kernel.id, descriptor);

      return createCapabilitySnapshot({
        capabilityMatrix: descriptor.capabilityMatrix,
        health,
        experimentalCapabilities: rawExtensions.experimentalFeatures,
      });
    },
    describeRawExtensions(): ChatEngineRawExtensionDescriptor {
      return createRawExtensionDescriptorForEngine(kernel.id, descriptor);
    },
    async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<never> {
      void messages;
      void options;
      throw new Error(`${adapterName} requires sendCanonicalEvents() streaming execution.`);
    },
    async *sendMessageStream(
      messages: ChatMessage[],
      options?: ChatOptions,
    ): AsyncGenerator<never, void, unknown> {
      void messages;
      void options;
      throw new Error(`${adapterName} requires sendCanonicalEvents() streaming execution.`);
    },
    async *sendCanonicalEvents(
      messages: ChatMessage[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatCanonicalEvent, void, unknown> {
      const runtime = this.describeRuntime?.(options);
      if (!runtime) {
        throw new Error(`${adapterName} does not expose describeRuntime()`);
      }

      let sequence = 0;
      yield createCanonicalEvent(++sequence, 'session.started', 'ready', {
        engineId: runtime.engineId,
        modelId: runtime.modelId,
        transportKind: runtime.transportKind,
        approvalPolicy: runtime.approvalPolicy,
      });
      yield createCanonicalEvent(++sequence, 'turn.started', 'streaming', {
        messageCount: messages.length,
        lastMessageRole: messages.at(-1)?.role ?? null,
      });

      try {
        const result = executeKernelTurn({
          engineId: kernel.id,
          modelId: runtime.modelId,
          messages,
          nativeSessionId: options?.context?.nativeSessionId,
          options,
        });
        LIVE_CONFIRMED_ENGINES.add(kernel.id);

        const contentDeltas = result.streamDeltas.length > 0
          ? result.streamDeltas
          : result.assistantContent
            ? [result.assistantContent]
            : [];
        for (const contentDelta of contentDeltas) {
          yield createCanonicalEvent(++sequence, 'message.delta', 'streaming', {
            role: 'assistant',
            contentDelta,
          });
        }

        yield createCanonicalEvent(++sequence, 'message.completed', 'completed', {
          role: 'assistant',
          content: result.assistantContent,
        });
        yield createCanonicalEvent(++sequence, 'operation.updated', 'completed', {
          status: 'completed',
        });
        yield createCanonicalEvent(++sequence, 'turn.completed', 'completed', {
          contentLength: result.assistantContent.length,
          finishReason: 'stop',
          nativeSessionId: result.nativeSessionId,
        });
      } catch (error) {
        yield createCanonicalEvent(++sequence, 'turn.failed', 'failed', {
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}

export function createChatEngineById(engineId: unknown): IChatEngine {
  const kernel = findWorkbenchCodeEngineKernel(engineId);

  if (!kernel) {
    throw new Error(`Unknown engineId: ${String(engineId)}`);
  }

  return createKernelTurnRuntime(kernel.id, {
    defaultModelId: kernel.descriptor.defaultModelId,
    descriptor: kernel.descriptor,
  });
}

export function listWorkbenchChatEngineIds(): readonly WorkbenchCodeEngineId[] {
  return ['codex', 'claude-code', 'gemini', 'opencode'];
}
