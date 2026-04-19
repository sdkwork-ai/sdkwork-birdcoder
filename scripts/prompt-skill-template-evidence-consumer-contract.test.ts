import assert from 'node:assert/strict';
import type { BirdCoderCoreWriteApiClient } from '@sdkwork/birdcoder-types';

const dataKernelModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts',
  import.meta.url,
);
const sqlExecutorModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts',
  import.meta.url,
);
const providersModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts',
  import.meta.url,
);
const consoleRepositoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts',
  import.meta.url,
);
const evidenceRepositoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts',
  import.meta.url,
);
const consoleQueriesModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts',
  import.meta.url,
);
const appAdminApiClientModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
  import.meta.url,
);
const typesEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/index.ts',
  import.meta.url,
);
const defaultServicesModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
  import.meta.url,
);

const backingStore = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        return backingStore.has(key) ? backingStore.get(key)! : null;
      },
      setItem(key: string, value: string) {
        backingStore.set(key, value);
      },
      removeItem(key: string) {
        backingStore.delete(key);
      },
    },
  },
});

try {
  const { createBirdCoderStorageProvider } = await import(
    `${dataKernelModulePath.href}?t=${Date.now()}`
  );
  const { createBirdCoderInMemorySqlExecutor } = await import(
    `${sqlExecutorModulePath.href}?t=${Date.now()}`
  );
  const { getBirdCoderSchemaMigrationDefinition } = await import(
    `${providersModulePath.href}?t=${Date.now()}`
  );
  const { createBirdCoderConsoleRepositories } = await import(
    `${consoleRepositoryModulePath.href}?t=${Date.now()}`
  );
  const { createBirdCoderPromptSkillTemplateEvidenceRepositories } = await import(
    `${evidenceRepositoryModulePath.href}?t=${Date.now()}`
  );
  const { createBirdCoderAppAdminConsoleQueries } = await import(
    `${consoleQueriesModulePath.href}?t=${Date.now()}`
  );
  const {
    createBirdCoderInProcessAppAdminApiTransport,
  } = await import(`${appAdminApiClientModulePath.href}?t=${Date.now()}`);
  const { createBirdCoderGeneratedAppAdminApiClient } = await import(
    `${typesEntryModulePath.href}?t=${Date.now()}`
  );
  const { createDefaultBirdCoderIdeServices } = await import(
    `${defaultServicesModulePath.href}?t=${Date.now()}`
  );

  const sqlExecutor = createBirdCoderInMemorySqlExecutor('sqlite');
  const provider = createBirdCoderStorageProvider('sqlite', {
    sqlExecutor,
  });
  await provider.open();
  await provider.runMigrations([getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2')]);

  const repositories = createBirdCoderConsoleRepositories({
    providerId: provider.providerId,
    storage: provider,
  });
  const evidenceRepositories = createBirdCoderPromptSkillTemplateEvidenceRepositories({
    providerId: provider.providerId,
    storage: provider,
  });
  const queries = createBirdCoderAppAdminConsoleQueries({ repositories });

  await Promise.all([
    repositories.workspaces.clear(),
    repositories.projects.clear(),
    evidenceRepositories.promptRuns.clear(),
    evidenceRepositories.promptEvaluations.clear(),
    evidenceRepositories.templateInstantiations.clear(),
  ]);

  await repositories.workspaces.save({
    id: 'workspace-evidence-consumer-contract',
    name: 'Evidence Consumer Contract Workspace',
    description: 'Workspace for prompt/skill/template evidence consumer contract.',
    ownerId: 'user-evidence-consumer-contract',
    createdAt: '2026-04-12T11:00:00.000Z',
    updatedAt: '2026-04-12T11:00:00.000Z',
  });

  const appAdminClient = createBirdCoderGeneratedAppAdminApiClient({
    transport: createBirdCoderInProcessAppAdminApiTransport({
      queries,
    }),
  });

  const coreWriteClient: BirdCoderCoreWriteApiClient = {
    async createCodingSession(request) {
      return {
        id: 'coding-session-evidence-consumer-contract',
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        title: request.title ?? 'Evidence Consumer Session',
        status: 'active',
        hostMode: request.hostMode ?? 'server',
        engineId: request.engineId ?? 'codex',
        modelId: request.modelId ?? request.engineId ?? 'codex',
        createdAt: '2026-04-12T11:00:05.000Z',
        updatedAt: '2026-04-12T11:00:05.000Z',
        lastTurnAt: '2026-04-12T11:00:05.000Z',
      };
    },
    async updateCodingSession() {
      throw new Error('not implemented');
    },
    async forkCodingSession() {
      throw new Error('not implemented');
    },
    async deleteCodingSession() {
      throw new Error('not implemented');
    },
    async createCodingSessionTurn(codingSessionId, request) {
      return {
        id: 'coding-turn-evidence-consumer-contract',
        codingSessionId,
        runtimeId: request.runtimeId ?? 'runtime-evidence-consumer-contract',
        requestKind: request.requestKind,
        status: 'running',
        inputSummary: request.inputSummary,
        startedAt: '2026-04-12T11:00:08.000Z',
        completedAt: undefined,
      };
    },
    async submitApprovalDecision() {
      throw new Error('not implemented');
    },
    async deleteCodingSessionMessage() {
      throw new Error('not implemented');
    },
  };

  const services = createDefaultBirdCoderIdeServices({
    appAdminClient,
    coreWriteClient,
    storageProvider: provider,
  });

  const createdProject = await services.projectService.createProject(
    'workspace-evidence-consumer-contract',
    'Evidence Consumer Contract Project',
    {
      path: 'D:/sdkwork/contracts/evidence-consumer-project',
    },
  );
  const createdSession = await services.projectService.createCodingSession(
    createdProject.id,
    'Evidence Consumer Session',
  );
  const createdMessage = await services.projectService.addCodingSessionMessage(
    createdProject.id,
    createdSession.id,
    {
      role: 'user',
      content: 'Capture prompt runtime evidence.',
    },
  );

  const promptRunId = `prompt-run-${createdMessage.id}`;
  const promptEvaluationId = `prompt-evaluation-${createdMessage.id}`;
  const templateInstantiationId = `template-instantiation-${createdProject.id}`;

  const promptRun = await evidenceRepositories.promptRuns.findById(promptRunId);
  assert.ok(promptRun, 'project message writes must persist prompt run evidence.');
  assert.equal(promptRun?.projectId, createdProject.id);
  assert.equal(promptRun?.codingSessionId, createdSession.id);
  assert.equal(promptRun?.status, 'completed');

  const promptEvaluation = await evidenceRepositories.promptEvaluations.findById(promptEvaluationId);
  assert.ok(promptEvaluation, 'project message writes must persist prompt evaluation evidence.');
  assert.equal(promptEvaluation?.promptRunId, promptRunId);
  assert.equal(promptEvaluation?.evaluator, 'provider-backed-project-service');
  assert.equal(promptEvaluation?.status, 'completed');

  const templateInstantiation =
    await evidenceRepositories.templateInstantiations.findById(templateInstantiationId);
  assert.ok(
    templateInstantiation,
    'project creation must persist template instantiation evidence.',
  );
  assert.equal(templateInstantiation?.projectId, createdProject.id);
  assert.equal(templateInstantiation?.presetKey, 'default');
  assert.equal(templateInstantiation?.status, 'planned');
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('prompt skill template evidence consumer contract passed.');
