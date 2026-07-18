import type {
  BirdCoderAppRuntimeSdkApiClient,
  BirdCoderAppSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTestCodeEngineModelConfigSyncResult } from './test-code-engine-model-config-fixture.ts';

const dataKernelModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/dataKernel.ts',
  import.meta.url,
);
const sqlExecutorModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlExecutor.ts',
  import.meta.url,
);
const providersModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/providers.ts',
  import.meta.url,
);
const consoleRepositoryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/appConsoleRepository.ts',
  import.meta.url,
);
const codingSessionRepositoryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/codingSessionRepository.ts',
  import.meta.url,
);
const evidenceRepositoryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts',
  import.meta.url,
);
const consoleQueriesModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/consoleQueries.ts',
  import.meta.url,
);
const appSdkTransportModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSdkTransport.ts',
  import.meta.url,
);
const sdkClientsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);
const typesEntryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts',
  import.meta.url,
);
const defaultServicesModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
  import.meta.url,
);
const apiBackedProjectServiceModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts',
  import.meta.url,
);
const providerBackedProjectServiceModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
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
  const { createBirdCoderConsoleQueries } = await import(
    `${consoleQueriesModulePath.href}?t=${Date.now()}`
  );
  const {
    createBirdCoderInProcessAppSdkTransport,
  } = await import(`${appSdkTransportModulePath.href}?t=${Date.now()}`);
  const { createBirdCoderAppSdkApiClient } = await import(
    `${sdkClientsModulePath.href}?t=${Date.now()}`
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
  const queries = createBirdCoderConsoleQueries({ repositories });

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

  const appClient = createBirdCoderAppSdkApiClient({
    transport: createBirdCoderInProcessAppSdkTransport({
      queries,
    }),
  });

  const runtimeCodingSessions: Array<
    Awaited<ReturnType<BirdCoderAppRuntimeSdkApiClient['createCodingSession']>>
  > = [];

  const codingRuntimeClient = {
    ...appClient,
    async createCodingSession(request) {
      if (!request.engineId || !request.modelId) {
        throw new Error('expected explicit engineId and modelId');
      }

      const codingSession = {
        id: 'coding-session-evidence-consumer-contract',
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        title: request.title ?? 'Evidence Consumer Session',
        status: 'active' as const,
        hostMode: request.hostMode ?? 'server',
        engineId: request.engineId,
        modelId: request.modelId,
        createdAt: '2026-04-12T11:00:05.000Z',
        updatedAt: '2026-04-12T11:00:05.000Z',
        lastTurnAt: '2026-04-12T11:00:05.000Z',
      };
      runtimeCodingSessions.push(codingSession);
      return codingSession;
    },
    async getCodingSession(codingSessionId) {
      const codingSession = runtimeCodingSessions.find(
        (candidate) => candidate.id === codingSessionId,
      );
      if (!codingSession) {
        throw new Error(`coding session ${codingSessionId} not found`);
      }
      return codingSession;
    },
    async listCodingSessions(request = {}) {
      return runtimeCodingSessions.filter(
        (candidate) =>
          (!request.workspaceId || candidate.workspaceId === request.workspaceId) &&
          (!request.projectId || candidate.projectId === request.projectId) &&
          (!request.engineId || candidate.engineId === request.engineId),
      );
    },
    async listCodingSessionEvents() {
      return [];
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
  } satisfies BirdCoderAppRuntimeSdkApiClient;

  const providerBackedProjectService = new ProviderBackedProjectService({
    codingSessionRepositories,
    evidenceRepositories,
    repository: repositories.projects,
  });
  const projectService = new ApiBackedProjectService({
    appClient: appClient,
    codingSessionMirror: providerBackedProjectService,
    codingRuntimeClient,
    currentUserProvider: {
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
  );
  const resolvedCreatedProject = await projectService.getProjectById(createdProject.id);
  assert.equal(
    resolvedCreatedProject?.id,
    createdProject.id,
    'project creation must make the authoritative project immediately resolvable for the current user before session creation.',
  );
  assert.equal(Object.hasOwn(resolvedCreatedProject ?? {}, 'path'), false);
  const createdSession = await projectService.createCodingSession(
    createdProject.id,
    'Evidence Consumer Session',
    {
      engineId: 'codex',
      modelId: 'gpt-5.4',
      runtimeLocationId: 'runtime-location-evidence-consumer-contract',
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
    `project:${createdProject.id}`,
    'project creation evidence must use an opaque project reference instead of a device path.',
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
