import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { BirdCoderCoreWriteApiClient } from '@sdkwork/birdcoder-types';
import { buildTestCodeEngineModelConfigSyncResult } from './test-code-engine-model-config-fixture.ts';

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
const codingSessionRepositoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionRepository.ts',
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
const apiBackedProjectServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts',
  import.meta.url,
);
const providerBackedProjectServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
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
  const defaultIdeServicesSource = fs.readFileSync(defaultServicesModulePath, 'utf8');
  assert.match(
    defaultIdeServicesSource,
    /projectMirror:\s*runtime\.providerBackedProjectService/u,
    'default IDE services must route authoritative project reads back through the provider-backed project mirror.',
  );
  assert.match(
    defaultIdeServicesSource,
    /writeService:\s*runtime\.providerBackedProjectService/u,
    'default IDE services must route authoritative project writes through the provider-backed project service so evidence repositories remain canonical.',
  );

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
  const { createBirdCoderCodingSessionRepositories } = await import(
    `${codingSessionRepositoryModulePath.href}?t=${Date.now()}`
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
  const { ApiBackedProjectService } = await import(
    `${apiBackedProjectServiceModulePath.href}?t=${Date.now()}`
  );
  const { ProviderBackedProjectService } = await import(
    `${providerBackedProjectServiceModulePath.href}?t=${Date.now()}`
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
  const codingSessionRepositories = createBirdCoderCodingSessionRepositories({
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
    repositories.projectContents.clear(),
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
      if (!request.engineId || !request.modelId) {
        throw new Error('expected explicit engineId and modelId');
      }

      return {
        id: 'coding-session-evidence-consumer-contract',
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        title: request.title ?? 'Evidence Consumer Session',
        status: 'active',
        hostMode: request.hostMode ?? 'server',
        engineId: request.engineId,
        modelId: request.modelId,
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
    async submitUserQuestionAnswer() {
      throw new Error('not implemented');
    },
    async syncModelConfig(request) {
      return buildTestCodeEngineModelConfigSyncResult(request.localConfig);
    },
    async editCodingSessionMessage() {
      throw new Error('not implemented');
    },
    async deleteCodingSessionMessage() {
      throw new Error('not implemented');
    },
  };

  const providerBackedProjectService = new ProviderBackedProjectService({
    codingSessionRepositories,
    evidenceRepositories,
    projectContentRepository: repositories.projectContents,
    repository: repositories.projects,
  });
  const projectService = new ApiBackedProjectService({
    client: appAdminClient,
    codingSessionMirror: providerBackedProjectService,
    coreWriteClient,
    identityProvider: {
      async getCurrentUser() {
        return {
          id: 'user-evidence-consumer-contract',
          email: 'evidence-consumer@example.com',
          name: 'Evidence Consumer Contract User',
        };
      },
    },
    projectMirror: providerBackedProjectService,
    writeService: providerBackedProjectService,
  });

  const createdProject = await projectService.createProject(
    'workspace-evidence-consumer-contract',
    'Evidence Consumer Contract Project',
    {
      path: 'D:/sdkwork/contracts/evidence-consumer-project',
    },
  );
  const resolvedCreatedProject = await projectService.getProjectById(createdProject.id);
  assert.equal(
    resolvedCreatedProject?.id,
    createdProject.id,
    'project creation must make the authoritative project immediately resolvable for the current user before session creation.',
  );
  assert.equal(
    resolvedCreatedProject?.path,
    'D:/sdkwork/contracts/evidence-consumer-project',
    'project creation must preserve the local rootPath through the SQL-backed app authority.',
  );
  const createdSession = await projectService.createCodingSession(
    createdProject.id,
    'Evidence Consumer Session',
    {
      engineId: 'codex',
      modelId: 'gpt-5-codex',
    },
  );
  const createdMessage = await projectService.addCodingSessionMessage(
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
  assert.equal(
    templateInstantiation?.outputRoot,
    'D:/sdkwork/contracts/evidence-consumer-project',
    'project creation evidence must use the canonical plus_project_content rootPath as outputRoot.',
  );
  assert.equal(templateInstantiation?.status, 'planned');
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('prompt skill template evidence consumer contract passed.');
