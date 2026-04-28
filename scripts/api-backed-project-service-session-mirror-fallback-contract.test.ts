import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectSessionMirror } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectSessionMirror.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

const project: BirdCoderProject = {
  id: 'project-session-mirror-fallback',
  workspaceId: 'workspace-session-mirror-fallback',
  name: 'Session Mirror Fallback Project',
  path: 'D:/workspace/session-mirror-fallback',
  createdAt: '2026-04-27T09:00:00.000Z',
  updatedAt: '2026-04-27T09:00:00.000Z',
  codingSessions: [],
};

const codingSession: BirdCoderCodingSession = {
  id: 'coding-session-session-mirror-fallback',
  workspaceId: project.workspaceId,
  projectId: project.id,
  title: 'Session Mirror Fallback',
  status: 'active',
  hostMode: 'server',
  engineId: 'codex',
  modelId: 'gpt-5-codex',
  createdAt: '2026-04-27T09:01:00.000Z',
  updatedAt: '2026-04-27T09:01:00.000Z',
  lastTurnAt: '2026-04-27T09:01:00.000Z',
  transcriptUpdatedAt: null,
  displayTime: 'Just now',
  messages: [],
};

let writeServiceUpsertCount = 0;

const writeService = {
  async getProjects(): Promise<BirdCoderProject[]> {
    return [structuredClone(project)];
  },
  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    return projectId === project.id ? structuredClone(project) : null;
  },
  async upsertCodingSession(projectId: string, nextCodingSession: BirdCoderCodingSession) {
    assert.equal(projectId, project.id);
    assert.equal(nextCodingSession.id, codingSession.id);
    writeServiceUpsertCount += 1;
  },
} as unknown as IProjectService;

const staleCodingSessionMirror = {
  async upsertCodingSession(projectId: string) {
    throw new Error(`Project ${projectId} not found`);
  },
};

const service = new ApiBackedProjectService({
  client: {
    async getProject() {
      throw new Error('remote project detail should not be needed for an already mirrored project');
    },
  } as unknown as BirdCoderAppAdminApiClient,
  codingSessionMirror: staleCodingSessionMirror,
  writeService,
});

await service.upsertCodingSession(project.id, codingSession);

assert.equal(
  writeServiceUpsertCount,
  1,
  'session upsert must fall back to the canonical writeService mirror when the optional sidecar codingSessionMirror lacks the project record.',
);

let defaultMirrorProject: BirdCoderProject | null = null;
let defaultMirrorSessionUpsertCount = 0;
let defaultMirrorProjectSyncCount = 0;

const defaultProviderLikeMirror = {
  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    return defaultMirrorProject?.id === projectId ? structuredClone(defaultMirrorProject) : null;
  },
  async getProjects(): Promise<BirdCoderProject[]> {
    return defaultMirrorProject ? [structuredClone(defaultMirrorProject)] : [];
  },
  async syncProjectSummary(summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>) {
    defaultMirrorProjectSyncCount += 1;
    if (summary.rootPath && !/^[a-zA-Z]:[\\/]/u.test(summary.rootPath)) {
      throw new Error('Project root path must be an absolute path.');
    }

    defaultMirrorProject = {
      id: summary.id,
      workspaceId: summary.workspaceId,
      name: summary.name,
      path: summary.rootPath,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      archived: summary.status === 'archived',
      codingSessions: [],
    };
    return structuredClone(defaultMirrorProject);
  },
  async upsertCodingSession(projectId: string, nextCodingSession: BirdCoderCodingSession) {
    if (!defaultMirrorProject || defaultMirrorProject.id !== projectId) {
      throw new Error(`Project ${projectId} not found`);
    }

    defaultMirrorSessionUpsertCount += 1;
    defaultMirrorProject = {
      ...defaultMirrorProject,
      codingSessions: [structuredClone(nextCodingSession)],
    };
  },
} as unknown as IProjectService & {
  syncProjectSummary(summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>): Promise<BirdCoderProject>;
} & IProjectSessionMirror;

const defaultComposedService = new ApiBackedProjectService({
  client: {
    async getProject(): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>> {
      return {
        id: 'project-default-mirror-missing',
        workspaceId: 'workspace-session-mirror-fallback',
        name: 'Default Mirror Missing Project',
        rootPath: 'relative/path/from-authority',
        status: 'active',
        createdAt: '2026-04-27T09:10:00.000Z',
        updatedAt: '2026-04-27T09:10:00.000Z',
      };
    },
  } as unknown as BirdCoderAppAdminApiClient,
  codingSessionMirror: defaultProviderLikeMirror,
  projectMirror: defaultProviderLikeMirror,
  writeService: defaultProviderLikeMirror,
});

const observedConsoleErrors: unknown[][] = [];
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  observedConsoleErrors.push(args);
};
try {
  await defaultComposedService.upsertCodingSession(
    'project-default-mirror-missing',
    {
      ...codingSession,
      id: 'coding-session-default-mirror-missing',
      projectId: 'project-default-mirror-missing',
      workspaceId: '',
      title: 'Default Mirror Missing Session',
    },
  );
  await defaultComposedService.upsertCodingSession(
    'project-default-mirror-missing',
    {
      ...codingSession,
      id: 'coding-session-default-mirror-missing',
      projectId: 'project-default-mirror-missing',
      workspaceId: '',
      title: 'Default Mirror Missing Session',
    },
  );
} finally {
  console.error = originalConsoleError;
}

assert.equal(
  defaultMirrorSessionUpsertCount,
  2,
  'default ApiBackedProjectService composition must build a local project mirror once so repeated sends do not repeatedly hit Project not found.',
);
assert.equal(
  defaultMirrorProjectSyncCount,
  2,
  'default composition should try the authoritative project once and then bootstrap a stable local mirror from the coding session.',
);
assert.deepEqual(
  observedConsoleErrors,
  [],
  'recoverable send-time project mirror fallback must not emit console errors before sending every message.',
);

const requestedProjectId = 'project-session-linked-requested-id';
const authorityProjectId = 'project-session-linked-authority-id';
const idMismatchMirrorProjects = new Map<string, BirdCoderProject>();
let idMismatchSessionUpsertCount = 0;
let idMismatchProjectSyncCount = 0;

const idMismatchProviderLikeMirror = {
  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    const mirroredProject = idMismatchMirrorProjects.get(projectId);
    return mirroredProject ? structuredClone(mirroredProject) : null;
  },
  async getProjects(): Promise<BirdCoderProject[]> {
    return [...idMismatchMirrorProjects.values()].map((candidate) =>
      structuredClone(candidate),
    );
  },
  async syncProjectSummary(summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>) {
    idMismatchProjectSyncCount += 1;
    idMismatchMirrorProjects.set(summary.id, {
      id: summary.id,
      workspaceId: summary.workspaceId,
      name: summary.name,
      path: summary.rootPath,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      archived: summary.status === 'archived',
      codingSessions: [],
    });
    return structuredClone(idMismatchMirrorProjects.get(summary.id)!);
  },
  async upsertCodingSession(projectId: string, nextCodingSession: BirdCoderCodingSession) {
    const mirroredProject = idMismatchMirrorProjects.get(projectId);
    if (!mirroredProject) {
      throw new Error(`Project ${projectId} not found`);
    }

    idMismatchSessionUpsertCount += 1;
    idMismatchMirrorProjects.set(projectId, {
      ...mirroredProject,
      codingSessions: [structuredClone(nextCodingSession)],
    });
  },
} as unknown as IProjectService & {
  syncProjectSummary(summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>): Promise<BirdCoderProject>;
} & IProjectSessionMirror;

const idMismatchComposedService = new ApiBackedProjectService({
  client: {
    async getProject(): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>> {
      return {
        id: authorityProjectId,
        workspaceId: 'workspace-session-mirror-fallback',
        name: 'Authority Id Project',
        rootPath: 'D:/workspace/authority-id-project',
        status: 'active',
        createdAt: '2026-04-27T09:20:00.000Z',
        updatedAt: '2026-04-27T09:20:00.000Z',
      };
    },
  } as unknown as BirdCoderAppAdminApiClient,
  codingSessionMirror: idMismatchProviderLikeMirror,
  projectMirror: idMismatchProviderLikeMirror,
  writeService: idMismatchProviderLikeMirror,
});

await idMismatchComposedService.upsertCodingSession(
  requestedProjectId,
  {
    ...codingSession,
    id: 'coding-session-authority-id-mismatch',
    projectId: requestedProjectId,
    title: 'Authority Id Mismatch Session',
  },
);

assert.equal(
  idMismatchSessionUpsertCount,
  1,
  'session upsert must verify the local mirror contains the requested project id, not only that an authoritative summary was mirrored under a different id.',
);
assert.equal(
  idMismatchProjectSyncCount,
  2,
  'authority id mismatches must bootstrap a requested-id project mirror after the normal authority summary sync.',
);
assert.equal(
  idMismatchMirrorProjects.has(requestedProjectId),
  true,
  'fallback project mirror bootstrap must create the project id used by the coding session upsert.',
);

const isolatedProjectMirrorProjects = new Map<string, BirdCoderProject>();
const isolatedWriteServiceProjects = new Map<string, BirdCoderProject>();
let isolatedProjectMirrorSyncCount = 0;
let isolatedWriteServiceProjectSyncCount = 0;
let isolatedWriteServiceSessionUpsertCount = 0;

const isolatedProjectMirror = {
  async syncProjectSummary(summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>) {
    isolatedProjectMirrorSyncCount += 1;
    isolatedProjectMirrorProjects.set(summary.id, {
      id: summary.id,
      workspaceId: summary.workspaceId,
      name: summary.name,
      path: summary.rootPath,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      archived: summary.status === 'archived',
      codingSessions: [],
    });
    return structuredClone(isolatedProjectMirrorProjects.get(summary.id)!);
  },
};

const isolatedWriteService = {
  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    const mirroredProject = isolatedWriteServiceProjects.get(projectId);
    return mirroredProject ? structuredClone(mirroredProject) : null;
  },
  async getProjects(): Promise<BirdCoderProject[]> {
    return [...isolatedWriteServiceProjects.values()].map((candidate) =>
      structuredClone(candidate),
    );
  },
  async syncProjectSummary(summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>) {
    isolatedWriteServiceProjectSyncCount += 1;
    isolatedWriteServiceProjects.set(summary.id, {
      id: summary.id,
      workspaceId: summary.workspaceId,
      name: summary.name,
      path: summary.rootPath,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      archived: summary.status === 'archived',
      codingSessions: [],
    });
    return structuredClone(isolatedWriteServiceProjects.get(summary.id)!);
  },
  async upsertCodingSession(projectId: string, nextCodingSession: BirdCoderCodingSession) {
    const mirroredProject = isolatedWriteServiceProjects.get(projectId);
    if (!mirroredProject) {
      throw new Error(`Project ${projectId} not found`);
    }

    isolatedWriteServiceSessionUpsertCount += 1;
    isolatedWriteServiceProjects.set(projectId, {
      ...mirroredProject,
      codingSessions: [structuredClone(nextCodingSession)],
    });
  },
} as unknown as IProjectService & {
  syncProjectSummary(summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>): Promise<BirdCoderProject>;
} & IProjectSessionMirror;

const isolatedMirrorComposedService = new ApiBackedProjectService({
  client: {
    async getProject(): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['getProject']>>> {
      return {
        id: 'project-isolated-session-writer',
        workspaceId: 'workspace-session-mirror-fallback',
        name: 'Isolated Session Writer Project',
        rootPath: 'D:/workspace/isolated-session-writer',
        status: 'active',
        createdAt: '2026-04-27T09:30:00.000Z',
        updatedAt: '2026-04-27T09:30:00.000Z',
      };
    },
  } as unknown as BirdCoderAppAdminApiClient,
  codingSessionMirror: isolatedWriteService,
  projectMirror: isolatedProjectMirror,
  writeService: isolatedWriteService,
});

await isolatedMirrorComposedService.upsertCodingSession(
  'project-isolated-session-writer',
  {
    ...codingSession,
    id: 'coding-session-isolated-session-writer',
    projectId: 'project-isolated-session-writer',
    title: 'Isolated Session Writer Session',
  },
);

assert.equal(
  isolatedProjectMirrorSyncCount,
  1,
  'authority project sync should still update the configured project mirror.',
);
assert.equal(
  isolatedWriteServiceProjectSyncCount,
  1,
  'session upsert repair must also sync the project into the actual local writer when it is a different mirror-capable service.',
);
assert.equal(
  isolatedWriteServiceSessionUpsertCount,
  1,
  'session upsert must write successfully after bootstrapping the actual session writer project mirror.',
);

console.log('api-backed project service session mirror fallback contract passed.');
