import assert from 'node:assert/strict';

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
const evidenceRepositoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts',
  import.meta.url,
);

const dataKernelModule = await import(`${dataKernelModulePath.href}?t=${Date.now()}`);
const sqlExecutorModule = await import(`${sqlExecutorModulePath.href}?t=${Date.now()}`);
const providersModule = await import(`${providersModulePath.href}?t=${Date.now()}`);
const evidenceRepositoryModule = await import(`${evidenceRepositoryModulePath.href}?t=${Date.now()}`);

assert.equal(
  typeof evidenceRepositoryModule.createBirdCoderPromptSkillTemplateEvidenceRepositories,
  'function',
);

const sqlExecutor = sqlExecutorModule.createBirdCoderInMemorySqlExecutor('sqlite');
const provider = dataKernelModule.createBirdCoderStorageProvider('sqlite', {
  sqlExecutor,
});

await provider.open();
await provider.runMigrations([
  providersModule.getBirdCoderSchemaMigrationDefinition('runtime-data-kernel-v1'),
]);

const repositories = evidenceRepositoryModule.createBirdCoderPromptSkillTemplateEvidenceRepositories({
  providerId: 'sqlite',
  storage: provider,
});

await Promise.all([
  repositories.promptRuns.clear(),
  repositories.promptEvaluations.clear(),
  repositories.templateInstantiations.clear(),
]);

const promptRun = {
  id: 'prompt-run-contract-1',
  projectId: 'project-contract-1',
  codingSessionId: 'coding-session-contract-1',
  promptBundleId: 'prompt-bundle-contract-1',
  promptAssetVersionId: 'prompt-asset-version-contract-1',
  status: 'succeeded',
  inputSnapshotRef: 'artifacts/prompts/input-1.json',
  outputSnapshotRef: 'artifacts/prompts/output-1.json',
  createdAt: '2026-04-12T10:00:00.000Z',
  updatedAt: '2026-04-12T10:00:05.000Z',
};

const promptEvaluation = {
  id: 'prompt-evaluation-contract-1',
  promptRunId: 'prompt-run-contract-1',
  evaluator: 'engine-evaluator',
  score: 93,
  status: 'completed',
  summary: {
    engineKey: 'codex',
    modelId: 'gpt-5.4',
    comparisonLabel: 'codex-vs-gemini',
  },
  createdAt: '2026-04-12T10:00:06.000Z',
  updatedAt: '2026-04-12T10:00:07.000Z',
};

const templateInstantiation = {
  id: 'template-instantiation-contract-1',
  projectId: 'project-contract-1',
  appTemplateVersionId: 'template-version-contract-1',
  presetKey: 'agent-tooling-governed',
  status: 'completed',
  outputRoot: 'D:/workspace/project-contract-1/generated',
  createdAt: '2026-04-12T10:00:08.000Z',
  updatedAt: '2026-04-12T10:00:09.000Z',
};

const stagedUnitOfWork = await provider.beginUnitOfWork();
const stagedRepositories =
  evidenceRepositoryModule.createBirdCoderPromptSkillTemplateEvidenceRepositories({
    providerId: 'sqlite',
    storage: stagedUnitOfWork,
  });

await stagedRepositories.promptRuns.save(promptRun);
await stagedRepositories.promptEvaluations.save(promptEvaluation);
await stagedRepositories.templateInstantiations.save(templateInstantiation);

assert.equal(
  (await stagedRepositories.promptRuns.findById(promptRun.id))?.id,
  promptRun.id,
);
assert.equal(
  (await stagedRepositories.promptEvaluations.findById(promptEvaluation.id))?.id,
  promptEvaluation.id,
);
assert.equal(
  (await stagedRepositories.templateInstantiations.findById(templateInstantiation.id))?.id,
  templateInstantiation.id,
);
assert.equal(await repositories.promptRuns.findById(promptRun.id), null);
assert.equal(await repositories.promptEvaluations.findById(promptEvaluation.id), null);
assert.equal(await repositories.templateInstantiations.findById(templateInstantiation.id), null);

await stagedUnitOfWork.commit();

assert.equal((await repositories.promptRuns.findById(promptRun.id))?.id, promptRun.id);
assert.equal(
  (await repositories.promptEvaluations.findById(promptEvaluation.id))?.id,
  promptEvaluation.id,
);
assert.equal(
  (await repositories.templateInstantiations.findById(templateInstantiation.id))?.id,
  templateInstantiation.id,
);
assert.equal((await repositories.promptRuns.list())[0]?.id, promptRun.id);
assert.equal((await repositories.promptEvaluations.list())[0]?.id, promptEvaluation.id);
assert.equal(
  (await repositories.templateInstantiations.list())[0]?.id,
  templateInstantiation.id,
);

const rollbackUnitOfWork = await provider.beginUnitOfWork();
const rollbackRepositories =
  evidenceRepositoryModule.createBirdCoderPromptSkillTemplateEvidenceRepositories({
    providerId: 'sqlite',
    storage: rollbackUnitOfWork,
  });

await rollbackRepositories.promptRuns.save({
  ...promptRun,
  id: 'prompt-run-contract-rollback',
  updatedAt: '2026-04-12T10:10:00.000Z',
});
await rollbackUnitOfWork.rollback();

assert.equal(await repositories.promptRuns.findById('prompt-run-contract-rollback'), null);

console.log('prompt, skill, and template evidence repository contract passed.');
