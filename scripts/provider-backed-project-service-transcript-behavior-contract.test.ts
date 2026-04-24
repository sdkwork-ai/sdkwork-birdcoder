import assert from 'node:assert/strict';

import { ProviderBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts';
import { createBirdCoderRepresentativeAppAdminRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import { createBirdCoderCodingSessionRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionRepository.ts';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';

const storageProvider = createBirdCoderStorageProvider('sqlite');
const appRepositories = createBirdCoderRepresentativeAppAdminRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});
const codingSessionRepositories = createBirdCoderCodingSessionRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});

const service = new ProviderBackedProjectService({
  codingSessionRepositories,
  repository: appRepositories.projects,
});

const project = await service.createProject('workspace-provider-contract', 'Provider Contract', {
  path: 'D:/workspace/provider-contract',
});
const codingSession = await service.createCodingSession(project.id, 'Transcript Contract', {
  engineId: 'codex',
  modelId: 'gpt-5.4',
});

const initialProjectSnapshot = await service.getProjectById(project.id);
assert.equal(
  initialProjectSnapshot?.codingSessions[0]?.messages.length,
  0,
  'new provider-backed coding sessions must start without transcript messages.',
);

const createdMessage = await service.addCodingSessionMessage(project.id, codingSession.id, {
  role: 'user',
  content: 'Explain why transcript visibility matters.',
});
assert.equal(createdMessage.content, 'Explain why transcript visibility matters.');

const projectAfterCreate = await service.getProjectById(project.id);
assert.equal(
  projectAfterCreate?.codingSessions[0]?.messages.length,
  1,
  'provider-backed project reads must expose newly added transcript messages after reloading the session.',
);
assert.equal(
  projectAfterCreate?.codingSessions[0]?.messages[0]?.content,
  'Explain why transcript visibility matters.',
);

await service.editCodingSessionMessage(project.id, codingSession.id, createdMessage.id, {
  content: 'Explain why transcript visibility matters in the chat surface.',
});

const projectAfterEdit = await service.getProjectById(project.id);
assert.equal(
  projectAfterEdit?.codingSessions[0]?.messages[0]?.content,
  'Explain why transcript visibility matters in the chat surface.',
  'provider-backed project reads must expose edited transcript content after reloading the session.',
);

await service.deleteCodingSessionMessage(project.id, codingSession.id, createdMessage.id);

const projectAfterDelete = await service.getProjectById(project.id);
assert.equal(
  projectAfterDelete?.codingSessions[0]?.messages.length,
  0,
  'provider-backed project reads must remove deleted transcript messages after reloading the session.',
);

const listedProjects = await service.getProjects('workspace-provider-contract');
assert.equal(
  listedProjects[0]?.codingSessions[0]?.messages.length,
  0,
  'provider-backed workspace project listings must stay aligned with the latest persisted transcript snapshot.',
);

console.log('provider-backed project service transcript behavior contract passed.');
