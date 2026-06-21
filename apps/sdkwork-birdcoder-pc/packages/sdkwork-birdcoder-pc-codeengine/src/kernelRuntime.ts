import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BirdCoderEngineDescriptor } from '@sdkwork/birdcoder-pc-types';
import { stringifyBirdCoderLongInteger } from '@sdkwork/birdcoder-pc-types';
import type {
  ChatCanonicalEvent,
  ChatCanonicalRuntimeDescriptor,
  ChatEngineHealthReport,
  ChatEngineIntegrationDescriptor,
  ChatMessage,
  ChatOptions,
  IChatEngine,
} from '@sdkwork/birdcoder-pc-projection';
import {
  buildMessageTranscriptPrompt,
  createDefaultChatCanonicalRuntimeDescriptor,
  createRuntimeIntegrationDescriptor,
  createStaticHealthReport,
  resolveTransportKindForRuntimeMode,
} from '@sdkwork/birdcoder-pc-projection';

import type { WorkbenchCodeEngineId } from './catalog.ts';
import { findWorkbenchCodeEngineKernel } from './kernel.ts';

interface KernelTurnResult {
  assistantContent: string;
  nativeSessionId?: string | null;
}

const ADAPTER_NAMES: Record<WorkbenchCodeEngineId, string> = {
  codex: 'codex-kernel-sdk-adapter',
  'claude-code': 'claude-code-kernel-sdk-adapter',
  gemini: 'gemini-cli-kernel-sdk-adapter',
  opencode: 'opencode-kernel-sdk-adapter',
};

function resolveKernelTurnBinary(): string {
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
}): KernelTurnResult {
  const binary = resolveKernelTurnBinary();
  const payload = {
    engineId: input.engineId,
    modelId: input.modelId,
    requestKind: 'user_message',
    inputSummary: buildMessageTranscriptPrompt(input.messages),
    nativeSessionId: input.nativeSessionId ?? null,
    config: {
      ephemeral: false,
      fullAuto: false,
      skipGitRepoCheck: false,
    },
  };

  const stdout = execFileSync(binary, [], {
    encoding: 'utf8',
    input: JSON.stringify(payload),
    maxBuffer: 10 * 1024 * 1024,
  });

  const parsed = JSON.parse(stdout) as {
    assistantContent?: string;
    nativeSessionId?: string | null;
  };

  return {
    assistantContent: parsed.assistantContent?.trim() ?? '',
    nativeSessionId: parsed.nativeSessionId ?? null,
  };
}

function createIntegrationDescriptor(
  engineId: WorkbenchCodeEngineId,
  descriptor: BirdCoderEngineDescriptor,
): ChatEngineIntegrationDescriptor {
  const officialEntry = descriptor.officialIntegration?.officialEntry;
  return createRuntimeIntegrationDescriptor({
    engineId,
    integrationClass: 'official-sdk',
    runtimeMode: 'sdk',
    officialEntry: {
      packageName: officialEntry?.packageName ?? engineId,
      sdkPath: officialEntry?.sdkPath,
      cliPackageName: officialEntry?.cliPackageName,
      sourceMirrorPath: officialEntry?.sourceMirrorPath,
    },
    transportKinds: descriptor.transportKinds,
    sourceMirrorPath: officialEntry?.sourceMirrorPath,
    notes: 'Kernel bridge execution via sdkwork-birdcoder-kernel-bridge',
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
  const integration = createIntegrationDescriptor(kernel.id, descriptor);
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
      try {
        resolveKernelTurnBinary();
        return createStaticHealthReport({
          descriptor: integration,
          status: 'ready',
          sdkAvailable: true,
          diagnostics: ['Kernel bridge binary is available.'],
        });
      } catch (error) {
        return createStaticHealthReport({
          descriptor: integration,
          status: 'missing',
          sdkAvailable: false,
          diagnostics: [
            error instanceof Error ? error.message : String(error),
          ],
        });
      }
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
        });

        if (result.assistantContent) {
          yield createCanonicalEvent(++sequence, 'message.delta', 'streaming', {
            role: 'assistant',
            contentDelta: result.assistantContent,
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
