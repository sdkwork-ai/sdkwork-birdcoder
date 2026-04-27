import assert from 'node:assert/strict';

import { ProviderBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts';
import { buildBirdCoderProjectContentConfigData } from '../packages/sdkwork-birdcoder-infrastructure/src/services/projectContentConfigData.ts';
import { createBirdCoderRepresentativeAppAdminRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import { createBirdCoderCodingSessionRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionRepository.ts';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderPromptSkillTemplateEvidenceRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts';

const storageProvider = createBirdCoderStorageProvider('sqlite');
const appRepositories = createBirdCoderRepresentativeAppAdminRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});
const codingSessionRepositories = createBirdCoderCodingSessionRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});
const evidenceRepositories = createBirdCoderPromptSkillTemplateEvidenceRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});

const service = new ProviderBackedProjectService({
  codingSessionRepositories,
  evidenceRepositories,
  projectContentRepository: appRepositories.projectContents,
  repository: appRepositories.projects,
});

const project = await service.createProject('workspace-provider-contract', 'Provider Contract', {
  path: 'D:/workspace/provider-contract',
});
assert.equal(
  (await appRepositories.projects.findById(project.id))?.rootPath,
  undefined,
  'provider-backed project creation must keep plus_project free of rootPath shadows.',
);
assert.equal(
  (await evidenceRepositories.templateInstantiations.findById(
    `template-instantiation-${project.id}`,
  ))?.outputRoot,
  'D:/workspace/provider-contract',
  'provider-backed project creation evidence must keep the canonical content rootPath as outputRoot.',
);
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

await service.editCodingSessionMessage(project.id, codingSession.id, createdMessage.id, {
  id: 'message-from-another-session',
  codingSessionId: 'another-session',
  createdAt: '1999-01-01T00:00:00.000Z',
  role: 'assistant',
  content: 'Only editable message content should change.',
});

const projectAfterIdentityEdit = await service.getProjectById(project.id);
const messageAfterIdentityEdit = projectAfterIdentityEdit?.codingSessions[0]?.messages[0];
assert.equal(
  projectAfterIdentityEdit?.codingSessions[0]?.messages.length,
  1,
  'editing one provider-backed message must not duplicate or remove it from the selected session transcript.',
);
assert.equal(
  messageAfterIdentityEdit?.id,
  createdMessage.id,
  'editing provider-backed messages must not allow updates to rewrite persisted message ids.',
);
assert.equal(
  messageAfterIdentityEdit?.codingSessionId,
  codingSession.id,
  'editing provider-backed messages must not allow updates to move messages into another session.',
);
assert.equal(
  messageAfterIdentityEdit?.createdAt,
  createdMessage.createdAt,
  'editing provider-backed messages must not allow updates to rewrite message creation time.',
);
assert.equal(
  messageAfterIdentityEdit?.role,
  'user',
  'editing provider-backed messages must not allow updates to rewrite message roles.',
);
assert.equal(
  messageAfterIdentityEdit?.content,
  'Only editable message content should change.',
  'editing provider-backed messages must still persist allowed content changes.',
);

const otherCodingSession = await service.createCodingSession(project.id, 'Other Transcript', {
  engineId: 'codex',
  modelId: 'gpt-5.4',
});
const otherSessionMessage = await service.addCodingSessionMessage(project.id, otherCodingSession.id, {
  role: 'user',
  content: 'This message belongs to a different session.',
});

await assert.rejects(
  () => service.deleteCodingSessionMessage(project.id, codingSession.id, otherSessionMessage.id),
  /Message .+ not found/u,
  'provider-backed message deletion must reject message ids that do not belong to the selected session.',
);

const projectAfterCrossSessionDeleteAttempt = await service.getProjectById(project.id);
const otherSessionAfterDeleteAttempt =
  projectAfterCrossSessionDeleteAttempt?.codingSessions.find(
    (candidate) => candidate.id === otherCodingSession.id,
  );
assert.equal(
  otherSessionAfterDeleteAttempt?.messages[0]?.id,
  otherSessionMessage.id,
  'provider-backed message deletion must not remove messages from a different session.',
);

const duplicateIdSessionA = await service.createCodingSession(project.id, 'Duplicate Id A', {
  engineId: 'codex',
  modelId: 'gpt-5.4',
});
const duplicateIdSessionB = await service.createCodingSession(project.id, 'Duplicate Id B', {
  engineId: 'codex',
  modelId: 'gpt-5.4',
});
await service.addCodingSessionMessage(project.id, duplicateIdSessionA.id, {
  id: 'provider-duplicate-message-id',
  role: 'assistant',
  content: 'Duplicate id content for session A.',
});
await service.addCodingSessionMessage(project.id, duplicateIdSessionB.id, {
  id: 'provider-duplicate-message-id',
  role: 'assistant',
  content: 'Duplicate id content for session B.',
});

const projectAfterDuplicateIdMessages = await service.getProjectById(project.id);
const duplicateIdSessionAAfterReload =
  projectAfterDuplicateIdMessages?.codingSessions.find(
    (candidate) => candidate.id === duplicateIdSessionA.id,
  );
const duplicateIdSessionBAfterReload =
  projectAfterDuplicateIdMessages?.codingSessions.find(
    (candidate) => candidate.id === duplicateIdSessionB.id,
  );
assert.equal(
  duplicateIdSessionAAfterReload?.messages[0]?.content,
  'Duplicate id content for session A.',
  'provider-backed persistence must keep duplicate external message ids isolated for the first session.',
);
assert.equal(
  duplicateIdSessionBAfterReload?.messages[0]?.content,
  'Duplicate id content for session B.',
  'provider-backed persistence must keep duplicate external message ids isolated for the second session.',
);
assert.equal(
  duplicateIdSessionAAfterReload?.messages[0]?.id,
  'provider-duplicate-message-id',
  'provider-backed persistence must preserve the external message id visible to the transcript UI.',
);
assert.equal(
  duplicateIdSessionBAfterReload?.messages[0]?.id,
  'provider-duplicate-message-id',
  'provider-backed persistence must preserve duplicate external message ids without forcing UI ids to become globally unique.',
);

const duplicateProjectionSession = await service.createCodingSession(
  project.id,
  'Duplicate Projection Replay',
  {
    engineId: 'codex',
    modelId: 'gpt-5.4',
  },
);
await service.upsertCodingSession(project.id, {
  ...duplicateProjectionSession,
  messages: [
    {
      id: `${duplicateProjectionSession.id}:authoritative:turn-1:user`,
      codingSessionId: duplicateProjectionSession.id,
      turnId: 'turn-1',
      role: 'user',
      content: 'Run the test suite',
      createdAt: '2026-04-26T10:00:00.000Z',
      timestamp: Date.parse('2026-04-26T10:00:00.000Z'),
    },
    {
      id: `${duplicateProjectionSession.id}:authoritative:turn-1:assistant`,
      codingSessionId: duplicateProjectionSession.id,
      turnId: 'turn-1',
      role: 'assistant',
      content: 'Tests passed.',
      createdAt: '2026-04-26T10:00:02.000Z',
      timestamp: Date.parse('2026-04-26T10:00:02.000Z'),
    },
  ],
});
await service.upsertCodingSession(project.id, {
  ...duplicateProjectionSession,
  messages: [
    {
      id: `${duplicateProjectionSession.id}:refreshed:turn-1:user`,
      codingSessionId: duplicateProjectionSession.id,
      turnId: 'turn-1',
      role: 'user',
      content: 'Run the test suite',
      createdAt: '2026-04-26T10:00:00.000Z',
      timestamp: Date.parse('2026-04-26T10:00:00.000Z'),
    },
    {
      id: `${duplicateProjectionSession.id}:refreshed:turn-1:assistant`,
      codingSessionId: duplicateProjectionSession.id,
      turnId: 'turn-1',
      role: 'assistant',
      content: 'Tests passed.',
      createdAt: '2026-04-26T10:00:02.000Z',
      timestamp: Date.parse('2026-04-26T10:00:02.000Z'),
    },
  ],
});

const projectAfterDuplicateProjectionReplay = await service.getProjectById(project.id);
const duplicateProjectionSessionAfterReplay =
  projectAfterDuplicateProjectionReplay?.codingSessions.find(
    (candidate) => candidate.id === duplicateProjectionSession.id,
  );
assert.deepEqual(
  duplicateProjectionSessionAfterReplay?.messages.map((message) => ({
    content: message.content,
    role: message.role,
    turnId: message.turnId,
  })),
  [
    {
      content: 'Run the test suite',
      role: 'user',
      turnId: 'turn-1',
    },
    {
      content: 'Tests passed.',
      role: 'assistant',
      turnId: 'turn-1',
    },
  ],
  'provider-backed transcript upserts must replace equivalent projection messages instead of retaining old projection-id variants.',
);

await service.deleteCodingSession(project.id, duplicateIdSessionA.id);
assert.equal(
  (await codingSessionRepositories.messages.list()).some(
    (message) => message.codingSessionId === duplicateIdSessionA.id,
  ),
  false,
  'provider-backed session deletion must remove persisted transcript rows keyed by the session-scoped storage id.',
);

const projectForTranscriptDeletion = await service.createProject(
  'workspace-provider-contract',
  'Provider Transcript Deletion',
  {
    path: 'D:/workspace/provider-transcript-deletion',
  },
);
const projectDeleteSessionA = await service.createCodingSession(
  projectForTranscriptDeletion.id,
  'Project Delete A',
  {
    engineId: 'codex',
    modelId: 'gpt-5.4',
  },
);
const projectDeleteSessionB = await service.createCodingSession(
  projectForTranscriptDeletion.id,
  'Project Delete B',
  {
    engineId: 'codex',
    modelId: 'gpt-5.4',
  },
);
await service.addCodingSessionMessage(projectForTranscriptDeletion.id, projectDeleteSessionA.id, {
  role: 'user',
  content: 'Project delete session A message.',
});
await service.addCodingSessionMessage(projectForTranscriptDeletion.id, projectDeleteSessionB.id, {
  role: 'user',
  content: 'Project delete session B message.',
});

await service.deleteProject(projectForTranscriptDeletion.id);
const messagesAfterProjectDelete = await codingSessionRepositories.messages.list();
assert.equal(
  messagesAfterProjectDelete.some(
    (message) =>
      message.codingSessionId === projectDeleteSessionA.id ||
      message.codingSessionId === projectDeleteSessionB.id,
  ),
  false,
  'provider-backed project deletion must remove all persisted transcript rows without concurrent message-store write races.',
);

await service.deleteCodingSessionMessage(project.id, codingSession.id, createdMessage.id);

const projectAfterDelete = await service.getProjectById(project.id);
assert.equal(
  projectAfterDelete?.codingSessions.find((candidate) => candidate.id === codingSession.id)
    ?.messages.length,
  0,
  'provider-backed project reads must remove deleted transcript messages after reloading the session.',
);

const listedProjects = await service.getProjects('workspace-provider-contract');
assert.equal(
  listedProjects[0]?.codingSessions.find((candidate) => candidate.id === codingSession.id)
    ?.messages.length,
  0,
  'provider-backed workspace project listings must stay aligned with the latest persisted transcript snapshot.',
);

await appRepositories.projects.save({
  id: 'project-content-authority-existing',
  workspaceId: 'workspace-content-authority',
  name: 'Content Authority Existing Project',
  status: 'active',
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
});
await appRepositories.projectContents.save({
  id: 'project-content-authority-existing',
  projectId: 'project-content-authority-existing',
  configData: buildBirdCoderProjectContentConfigData('D:/workspace/content-authority'),
  contentVersion: '1.0',
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
});

const existingProjectFromContentAuthority = await service.createProject(
  'workspace-content-authority',
  'Duplicate Attempt',
  {
    path: 'D:/workspace/content-authority',
  },
);
assert.equal(
  existingProjectFromContentAuthority.id,
  'project-content-authority-existing',
  'provider-backed project creation must detect existing paths from plus_project_content configData, not plus_project.rootPath.',
);

const repeatedNameProjectA = await service.createProject(
  'workspace-content-authority',
  'Repeated Folder',
  {
    path: 'D:/workspace/very-long-common-prefix/that-used-to-truncate-the-project-code-before-the-unique-suffix/a',
  },
);
const repeatedNameProjectB = await service.createProject(
  'workspace-content-authority',
  'Repeated Folder',
  {
    path: 'D:/workspace/very-long-common-prefix/that-used-to-truncate-the-project-code-before-the-unique-suffix/b',
  },
);
const repeatedNameProjectRecordA = await appRepositories.projects.findById(repeatedNameProjectA.id);
const repeatedNameProjectRecordB = await appRepositories.projects.findById(repeatedNameProjectB.id);
assert.ok(repeatedNameProjectRecordA);
assert.ok(repeatedNameProjectRecordB);
assert.equal(
  repeatedNameProjectA.name,
  'Repeated Folder',
  'provider-backed project service must expose project title as the UI display name while plus_project.name remains a unique business key.',
);
assert.notEqual(
  repeatedNameProjectRecordA.name,
  repeatedNameProjectRecordB.name,
  'provider-backed project creation must persist Java-unique plus_project.name values for repeated display names.',
);
assert.notEqual(
  repeatedNameProjectRecordA.code,
  repeatedNameProjectRecordB.code,
  'provider-backed project creation must persist Java-unique plus_project.code values for long common path prefixes.',
);
assert.equal(
  repeatedNameProjectRecordA.title,
  'Repeated Folder',
  'provider-backed project title must preserve the requested display name when plus_project.name is made unique.',
);
assert.equal(
  repeatedNameProjectRecordB.title,
  'Repeated Folder',
  'provider-backed project title must preserve the requested display name for duplicate display-name imports.',
);
assert.ok(
  repeatedNameProjectRecordA.code && repeatedNameProjectRecordA.code.length <= 64,
  'provider-backed generated plus_project.code must respect the Java length=64 standard.',
);
assert.ok(
  repeatedNameProjectRecordB.code && repeatedNameProjectRecordB.code.length <= 64,
  'provider-backed generated plus_project.code must respect the Java length=64 standard for every project.',
);

const projectForPathUpdate = await service.createProject(
  'workspace-content-authority',
  'Project Path Update Contract',
  {
    path: 'D:/workspace/path-update-source',
  },
);

await assert.rejects(
  () => service.updateProject(projectForPathUpdate.id, { path: 'relative/path' }),
  /absolute path/u,
  'provider-backed project updates must reject relative project root paths.',
);
await assert.rejects(
  () => service.updateProject(projectForPathUpdate.id, { path: '   ' }),
  /required/u,
  'provider-backed project updates must reject blank project root paths.',
);

await service.updateProject(projectForPathUpdate.id, {
  path: ' D:/workspace/path-update-target ',
});

const updatedProjectRecord = await appRepositories.projects.findById(projectForPathUpdate.id);
const updatedProjectContent = await appRepositories.projectContents.findById(projectForPathUpdate.id);
assert.equal(
  updatedProjectRecord?.rootPath,
  undefined,
  'provider-backed project updates must keep plus_project free of rootPath shadows.',
);
assert.equal(
  updatedProjectContent &&
    JSON.parse(updatedProjectContent.configData ?? '{}').rootPath,
  'D:/workspace/path-update-target',
  'provider-backed project updates must write the canonical rootPath to plus_project_content configData.',
);

const syncedProject = await service.syncProjectSummary({
  id: 'project-summary-root-path-normalization',
  workspaceId: 'workspace-content-authority',
  name: 'Summary Root Path Normalization',
  rootPath: ' D:/workspace/summary-root-path ',
  status: 'active',
  createdAt: '2026-04-24T01:00:00.000Z',
  updatedAt: '2026-04-24T01:01:00.000Z',
});
const syncedProjectContent = await appRepositories.projectContents.findById(
  'project-summary-root-path-normalization',
);
const syncedProjectRecord = await appRepositories.projects.findById(
  'project-summary-root-path-normalization',
);
assert.equal(
  syncedProject.path,
  'D:/workspace/summary-root-path',
  'provider-backed summary sync must expose the normalized canonical project path.',
);
assert.equal(
  syncedProjectRecord?.rootPath,
  undefined,
  'provider-backed summary sync must keep plus_project free of rootPath shadows.',
);
assert.equal(
  syncedProjectContent &&
    JSON.parse(syncedProjectContent.configData ?? '{}').rootPath,
  'D:/workspace/summary-root-path',
  'provider-backed summary sync must persist the normalized canonical rootPath in plus_project_content.',
);

console.log('provider-backed project service transcript behavior contract passed.');
