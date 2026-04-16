import assert from 'node:assert/strict';
import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderPromptSkillTemplateEvidenceRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts';
import { getBirdCoderSchemaMigrationDefinition } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts';
import {
  createProviderBackedBirdCoderCoreSessionProjectionStore,
  executeBirdCoderCoreSessionRun,
  persistBirdCoderCoreSessionRunProjection,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

type RuntimeProcessWithBuiltinModules = NodeJS.Process & {
  getBuiltinModule?: (id: string) => unknown;
};

type SpawnInvocation = {
  command: string;
  args: readonly string[];
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdio?: ['pipe', 'pipe', 'pipe'];
    windowsHide?: boolean;
  } | undefined;
};

function createFakeSpawnModule(options: {
  stdoutLines?: readonly string[];
  stderrLines?: readonly string[];
  exitCode?: number;
  onSpawn?: (invocation: SpawnInvocation) => void;
}) {
  return {
    spawn(
      command: string,
      args: readonly string[] = [],
      spawnOptions?: SpawnInvocation['options'],
    ) {
      options.onSpawn?.({
        command,
        args,
        options: spawnOptions,
      });

      const stdoutListeners: Array<(chunk: unknown) => void> = [];
      const stderrListeners: Array<(chunk: unknown) => void> = [];
      const onceListeners: {
        error?: (error: Error) => void;
        close?: (code: number | null) => void;
      } = {};

      return {
        stdin: {
          write() {
            return undefined;
          },
          end() {
            for (const line of options.stdoutLines ?? []) {
              for (const listener of stdoutListeners) {
                listener(line);
              }
            }
            for (const line of options.stderrLines ?? []) {
              for (const listener of stderrListeners) {
                listener(line);
              }
            }
            queueMicrotask(() => {
              onceListeners.close?.(options.exitCode ?? 0);
            });
          },
        },
        stdout: {
          on(event: 'data', listener: (chunk: unknown) => void) {
            if (event === 'data') {
              stdoutListeners.push(listener);
            }
          },
        },
        stderr: {
          on(event: 'data', listener: (chunk: unknown) => void) {
            if (event === 'data') {
              stderrListeners.push(listener);
            }
          },
        },
        kill() {
          return true;
        },
        once(event: 'error' | 'close', listener: (value: Error | number | null) => void) {
          if (event === 'error') {
            onceListeners.error = listener as (error: Error) => void;
          } else {
            onceListeners.close = listener as (code: number | null) => void;
          }
          return this;
        },
      };
    },
  };
}

async function withMockChildProcessModule<T>(
  moduleFactory: ReturnType<typeof createFakeSpawnModule>,
  callback: () => Promise<T>,
): Promise<T> {
  const runtimeProcess = process as RuntimeProcessWithBuiltinModules;
  const originalGetBuiltinModule = runtimeProcess.getBuiltinModule;

  runtimeProcess.getBuiltinModule = (id: string) => {
    if (id === 'node:child_process') {
      return moduleFactory;
    }
    return originalGetBuiltinModule?.(id);
  };

  try {
    return await callback();
  } finally {
    if (originalGetBuiltinModule) {
      runtimeProcess.getBuiltinModule = originalGetBuiltinModule;
    } else {
      delete runtimeProcess.getBuiltinModule;
    }
  }
}

const codexFakeJsonlLines = [
  `${JSON.stringify({
    type: 'item.updated',
    item: {
      id: 'codex-evidence-contract-message',
      type: 'agent_message',
      text: 'Stored coding-server evidence for the current turn.',
    },
  })}\n`,
  `${JSON.stringify({
    type: 'turn.completed',
  })}\n`,
];

const messages: ChatMessage[] = [
  {
    id: 'msg-coding-server-evidence-1',
    role: 'user',
    content: 'Generate coding-server evidence records for this turn.',
    timestamp: Date.now(),
  },
];

const provider = createBirdCoderStorageProvider('sqlite');
await provider.open();
await provider.runMigrations([getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2')]);

const evidenceRepositories = createBirdCoderPromptSkillTemplateEvidenceRepositories({
  providerId: provider.providerId,
  storage: provider,
});

await Promise.all([
  evidenceRepositories.promptRuns.clear(),
  evidenceRepositories.promptEvaluations.clear(),
  evidenceRepositories.templateInstantiations.clear(),
]);

const store = createProviderBackedBirdCoderCoreSessionProjectionStore(
  'coding-session-evidence-consumer-contract',
  provider,
);

const projection = await withMockChildProcessModule(
  createFakeSpawnModule({
    stdoutLines: codexFakeJsonlLines,
  }),
  async () =>
    executeBirdCoderCoreSessionRun({
      sessionId: 'coding-session-evidence-consumer-contract',
      runtimeId: 'runtime-evidence-consumer-contract',
      turnId: 'turn-evidence-consumer-contract',
      engineId: 'codex',
      modelId: 'codex',
      hostMode: 'server',
      messages,
      options: {
        model: 'codex',
      },
    }),
);

await persistBirdCoderCoreSessionRunProjection(store, projection);

const promptRunId = `prompt-run-${projection.operation.operationId}`;
const promptEvaluationId = `prompt-evaluation-${projection.operation.operationId}`;

const promptRun = await evidenceRepositories.promptRuns.findById(promptRunId);
assert.ok(promptRun, 'coding-server projection persistence should write prompt run evidence.');
assert.equal(promptRun?.projectId, projection.runtime.codingSessionId);
assert.equal(promptRun?.codingSessionId, projection.runtime.codingSessionId);
assert.equal(promptRun?.promptBundleId, `coding-server-${projection.runtime.engineId}-prompt-bundle`);
assert.equal(
  promptRun?.promptAssetVersionId,
  `coding-server-${projection.runtime.engineId}-${projection.runtime.modelId ?? 'default-model'}-prompt-asset-version`,
);
assert.equal(promptRun?.status, 'completed');
assert.equal(
  promptRun?.inputSnapshotRef,
  `coding-session:${projection.runtime.codingSessionId}:turn:turn-evidence-consumer-contract:input`,
);
assert.equal(
  promptRun?.outputSnapshotRef,
  `coding-session:${projection.runtime.codingSessionId}:turn:turn-evidence-consumer-contract:output`,
);

const promptEvaluation = await evidenceRepositories.promptEvaluations.findById(promptEvaluationId);
assert.ok(
  promptEvaluation,
  'coding-server projection persistence should write prompt evaluation evidence.',
);
assert.equal(promptEvaluation?.promptRunId, promptRunId);
assert.equal(promptEvaluation?.evaluator, 'coding-server-projection-store');
assert.equal(promptEvaluation?.score, 100);
assert.equal(promptEvaluation?.status, 'completed');
assert.equal(promptEvaluation?.summary.operationId, projection.operation.operationId);
assert.equal(promptEvaluation?.summary.eventCount, projection.events.length);
assert.equal(promptEvaluation?.summary.artifactCount, projection.artifacts.length);
assert.equal(promptEvaluation?.summary.engineId, projection.runtime.engineId);
assert.equal(promptEvaluation?.summary.modelId, projection.runtime.modelId);

console.log('coding server prompt skill template evidence consumer contract passed.');
