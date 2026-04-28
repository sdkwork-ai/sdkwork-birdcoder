import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreReadApiClient,
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-types';
import { isBirdCoderCodingSessionExecuting } from '@sdkwork/birdcoder-types';
import { refreshCodingSessionMessages } from '../packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type {
  BirdCoderProjectMirrorSnapshot,
  IProjectService,
} from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

const workspaceId = 'workspace-stale-runtime-status-startup';
const projectId = 'project-stale-runtime-status-startup';
const codingSessionId = 'coding-session-stale-runtime-status-startup';

const localStreamingTimestamp = '2026-04-27T10:05:00.000Z';
const authoritativeTerminalTimestamp = '2026-04-27T10:04:00.000Z';

const localStreamingSession: BirdCoderCodingSession = {
  id: codingSessionId,
  workspaceId,
  projectId,
  title: 'Stale local streaming session',
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5.4',
  nativeSessionId: 'native-stale-runtime-status-startup',
  runtimeStatus: 'streaming',
  createdAt: '2026-04-27T10:00:00.000Z',
  updatedAt: localStreamingTimestamp,
  lastTurnAt: localStreamingTimestamp,
  sortTimestamp: String(Date.parse(localStreamingTimestamp)),
  transcriptUpdatedAt: localStreamingTimestamp,
  displayTime: 'Just now',
  pinned: false,
  archived: false,
  unread: false,
  messages: [],
};

const localProject: BirdCoderProjectMirrorSnapshot = {
  id: projectId,
  workspaceId,
  name: 'Stale Runtime Status Startup Project',
  path: 'D:/workspace/stale-runtime-status-startup',
  createdAt: '2026-04-27T09:59:00.000Z',
  updatedAt: localStreamingTimestamp,
  archived: false,
  codingSessions: [
    {
      ...localStreamingSession,
      messageCount: 0,
      nativeTranscriptUpdatedAt: null,
    },
  ],
};

const projectSummary: BirdCoderProjectSummary = {
  id: projectId,
  workspaceId,
  name: localProject.name,
  rootPath: localProject.path,
  status: 'active',
  createdAt: localProject.createdAt,
  updatedAt: localProject.updatedAt,
};

const authoritativeCompletedSession: BirdCoderCodingSessionSummary = {
  id: codingSessionId,
  workspaceId,
  projectId,
  title: localStreamingSession.title,
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5.4',
  nativeSessionId: localStreamingSession.nativeSessionId,
  runtimeStatus: 'completed',
  createdAt: localStreamingSession.createdAt,
  updatedAt: authoritativeTerminalTimestamp,
  lastTurnAt: authoritativeTerminalTimestamp,
  sortTimestamp: String(Date.parse(authoritativeTerminalTimestamp)),
  transcriptUpdatedAt: authoritativeTerminalTimestamp,
};

const client = {
  async listProjects(
    options?: Parameters<BirdCoderAppAdminApiClient['listProjects']>[0],
  ): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>> {
    assert.equal(options?.workspaceId, workspaceId);
    return [projectSummary];
  },
} as unknown as BirdCoderAppAdminApiClient;

const coreReadClient = {
  async listCodingSessions(
    request?: Parameters<BirdCoderCoreReadApiClient['listCodingSessions']>[0],
  ): Promise<BirdCoderCodingSessionSummary[]> {
    assert.equal(request?.workspaceId, workspaceId);
    return [authoritativeCompletedSession];
  },
} as unknown as BirdCoderCoreReadApiClient;

const writeService = {
  async getProjectMirrorSnapshots() {
    return [structuredClone(localProject)];
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  client,
  coreReadClient,
  writeService,
});

const startupSnapshots = await service.getProjectMirrorSnapshots(workspaceId);
const startupSession = startupSnapshots[0]?.codingSessions[0];

assert.equal(
  startupSession?.runtimeStatus,
  'completed',
  'startup project inventory must trust authoritative terminal runtime status instead of preserving stale local streaming state.',
);
assert.equal(
  isBirdCoderCodingSessionExecuting(startupSession),
  false,
  'startup project inventory must not expose stale local streaming sessions as executing.',
);

async function readRuntimeUnknownStartupSession(options: {
  codingSessionId: string;
  projectId: string;
  timestamp: string;
  workspaceId: string;
}): Promise<BirdCoderProjectMirrorSnapshot['codingSessions'][number] | undefined> {
  const runtimeUnknownLocalSession: BirdCoderCodingSession = {
    ...localStreamingSession,
    id: options.codingSessionId,
    projectId: options.projectId,
    workspaceId: options.workspaceId,
    runtimeStatus: 'streaming',
    updatedAt: options.timestamp,
    lastTurnAt: options.timestamp,
    sortTimestamp: String(Date.parse(options.timestamp)),
    transcriptUpdatedAt: options.timestamp,
  };
  const runtimeUnknownProject: BirdCoderProjectMirrorSnapshot = {
    ...localProject,
    id: options.projectId,
    workspaceId: options.workspaceId,
    updatedAt: options.timestamp,
    codingSessions: [
      {
        ...runtimeUnknownLocalSession,
        messageCount: 0,
        nativeTranscriptUpdatedAt: null,
      },
    ],
  };
  const runtimeUnknownProjectSummary: BirdCoderProjectSummary = {
    ...projectSummary,
    id: options.projectId,
    workspaceId: options.workspaceId,
    updatedAt: options.timestamp,
  };
  const runtimeUnknownSummary = {
    id: options.codingSessionId,
    workspaceId: options.workspaceId,
    projectId: options.projectId,
    title: runtimeUnknownLocalSession.title,
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5.4',
    nativeSessionId: runtimeUnknownLocalSession.nativeSessionId,
    createdAt: runtimeUnknownLocalSession.createdAt,
    updatedAt: options.timestamp,
    lastTurnAt: options.timestamp,
    sortTimestamp: String(Date.parse(options.timestamp)),
    transcriptUpdatedAt: options.timestamp,
  } satisfies BirdCoderCodingSessionSummary;

  const runtimeUnknownService = new ApiBackedProjectService({
    client: {
      async listProjects(
        request?: Parameters<BirdCoderAppAdminApiClient['listProjects']>[0],
      ) {
        assert.equal(request?.workspaceId, options.workspaceId);
        return [runtimeUnknownProjectSummary];
      },
    } as unknown as BirdCoderAppAdminApiClient,
    coreReadClient: {
      async listCodingSessions(
        request?: Parameters<BirdCoderCoreReadApiClient['listCodingSessions']>[0],
      ) {
        assert.equal(request?.workspaceId, options.workspaceId);
        return [runtimeUnknownSummary];
      },
    } as unknown as BirdCoderCoreReadApiClient,
    writeService: {
      async getProjectMirrorSnapshots() {
        return [structuredClone(runtimeUnknownProject)];
      },
    } as unknown as IProjectService,
  });

  return (await runtimeUnknownService.getProjectMirrorSnapshots(options.workspaceId))[0]
    ?.codingSessions[0];
}

const staleRuntimeUnknownTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const staleRuntimeUnknownSession = await readRuntimeUnknownStartupSession({
  codingSessionId: 'coding-session-stale-runtime-unknown',
  projectId: 'project-stale-runtime-unknown',
  timestamp: staleRuntimeUnknownTimestamp,
  workspaceId: 'workspace-stale-runtime-unknown',
});
assert.equal(
  isBirdCoderCodingSessionExecuting(staleRuntimeUnknownSession),
  false,
  'startup project inventory must not keep an old local streaming spinner forever when the authoritative summary no longer confirms an active runtime status.',
);

async function readLocalOnlyStartupSession(options: {
  codingSessionId: string;
  projectId: string;
  runtimeStatus: BirdCoderCodingSession['runtimeStatus'];
  timestamp: string;
  workspaceId: string;
}): Promise<BirdCoderProjectMirrorSnapshot['codingSessions'][number] | undefined> {
  const localOnlySession: BirdCoderCodingSession = {
    ...localStreamingSession,
    id: options.codingSessionId,
    projectId: options.projectId,
    workspaceId: options.workspaceId,
    runtimeStatus: options.runtimeStatus,
    updatedAt: options.timestamp,
    lastTurnAt: options.timestamp,
    sortTimestamp: String(Date.parse(options.timestamp)),
    transcriptUpdatedAt: options.timestamp,
  };
  const localOnlyProject: BirdCoderProjectMirrorSnapshot = {
    ...localProject,
    id: options.projectId,
    workspaceId: options.workspaceId,
    updatedAt: options.timestamp,
    codingSessions: [
      {
        ...localOnlySession,
        messageCount: 0,
        nativeTranscriptUpdatedAt: null,
      },
    ],
  };
  const localOnlyProjectSummary: BirdCoderProjectSummary = {
    ...projectSummary,
    id: options.projectId,
    workspaceId: options.workspaceId,
    updatedAt: options.timestamp,
  };

  const localOnlyService = new ApiBackedProjectService({
    client: {
      async listProjects(
        request?: Parameters<BirdCoderAppAdminApiClient['listProjects']>[0],
      ) {
        assert.equal(request?.workspaceId, options.workspaceId);
        return [localOnlyProjectSummary];
      },
    } as unknown as BirdCoderAppAdminApiClient,
    writeService: {
      async getProjectMirrorSnapshots() {
        return [structuredClone(localOnlyProject)];
      },
    } as unknown as IProjectService,
  });

  return (await localOnlyService.getProjectMirrorSnapshots(options.workspaceId))[0]
    ?.codingSessions[0];
}

const localOnlyStaleStreamingSession = await readLocalOnlyStartupSession({
  codingSessionId: 'coding-session-local-only-stale-streaming',
  projectId: 'project-local-only-stale-streaming',
  runtimeStatus: 'streaming',
  timestamp: staleRuntimeUnknownTimestamp,
  workspaceId: 'workspace-local-only-stale-streaming',
});
assert.equal(
  localOnlyStaleStreamingSession?.runtimeStatus,
  undefined,
  'startup mirror snapshots must clear stale local-only streaming state when core runtime summaries are unavailable.',
);
assert.equal(
  isBirdCoderCodingSessionExecuting(localOnlyStaleStreamingSession),
  false,
  'startup mirror snapshots must not expose stale local-only streaming sessions as executing.',
);

const localOnlyAwaitingUserSession = await readLocalOnlyStartupSession({
  codingSessionId: 'coding-session-local-only-awaiting-user',
  projectId: 'project-local-only-awaiting-user',
  runtimeStatus: 'awaiting_user',
  timestamp: staleRuntimeUnknownTimestamp,
  workspaceId: 'workspace-local-only-awaiting-user',
});
assert.equal(
  localOnlyAwaitingUserSession?.runtimeStatus,
  'awaiting_user',
  'startup mirror snapshots must preserve old pending user-interaction sessions because they require explicit user input, not stale spinner cleanup.',
);

async function readTransientFallbackProjectSession(options: {
  codingSessionId: string;
  projectId: string;
  runtimeStatus: BirdCoderCodingSession['runtimeStatus'];
  timestamp: string;
  workspaceId: string;
}): Promise<BirdCoderCodingSession | undefined> {
  const fallbackSession: BirdCoderCodingSession = {
    ...localStreamingSession,
    id: options.codingSessionId,
    projectId: options.projectId,
    workspaceId: options.workspaceId,
    runtimeStatus: options.runtimeStatus,
    updatedAt: options.timestamp,
    lastTurnAt: options.timestamp,
    sortTimestamp: String(Date.parse(options.timestamp)),
    transcriptUpdatedAt: options.timestamp,
  };
  const fallbackProject: BirdCoderProject = {
    ...localProject,
    id: options.projectId,
    workspaceId: options.workspaceId,
    updatedAt: options.timestamp,
    codingSessions: [fallbackSession],
  };

  const fallbackService = new ApiBackedProjectService({
    client: {
      async listProjects() {
        throw new Error('Failed to fetch');
      },
    } as unknown as BirdCoderAppAdminApiClient,
    writeService: {
      async getProjects(requestedWorkspaceId?: string) {
        assert.equal(requestedWorkspaceId, options.workspaceId);
        return [structuredClone(fallbackProject)];
      },
    } as unknown as IProjectService,
  });

  const originalConsoleWarn = console.warn;
  console.warn = () => undefined;
  try {
    return (await fallbackService.getProjects(options.workspaceId))[0]?.codingSessions[0];
  } finally {
    console.warn = originalConsoleWarn;
  }
}

const transientFallbackStreamingSession = await readTransientFallbackProjectSession({
  codingSessionId: 'coding-session-transient-fallback-stale-streaming',
  projectId: 'project-transient-fallback-stale-streaming',
  runtimeStatus: 'streaming',
  timestamp: staleRuntimeUnknownTimestamp,
  workspaceId: 'workspace-transient-fallback-stale-streaming',
});
assert.equal(
  transientFallbackStreamingSession?.runtimeStatus,
  undefined,
  'project-list transient fallback must clear stale local streaming state instead of rendering old spinners while the remote catalog is unavailable.',
);
assert.equal(
  isBirdCoderCodingSessionExecuting(transientFallbackStreamingSession),
  false,
  'project-list transient fallback must not expose stale local streaming sessions as executing.',
);

const transientFallbackAwaitingApprovalSession = await readTransientFallbackProjectSession({
  codingSessionId: 'coding-session-transient-fallback-awaiting-approval',
  projectId: 'project-transient-fallback-awaiting-approval',
  runtimeStatus: 'awaiting_approval',
  timestamp: staleRuntimeUnknownTimestamp,
  workspaceId: 'workspace-transient-fallback-awaiting-approval',
});
assert.equal(
  transientFallbackAwaitingApprovalSession?.runtimeStatus,
  'awaiting_approval',
  'project-list transient fallback must preserve pending approval state because it is a user decision, not an orphaned spinner.',
);

async function readTransientProjectDetailFallbackSession(options: {
  codingSessionId: string;
  lookup: 'id' | 'path';
  projectId: string;
  runtimeStatus: BirdCoderCodingSession['runtimeStatus'];
  timestamp: string;
  workspaceId: string;
}): Promise<BirdCoderCodingSession | undefined> {
  const fallbackSession: BirdCoderCodingSession = {
    ...localStreamingSession,
    id: options.codingSessionId,
    projectId: options.projectId,
    workspaceId: options.workspaceId,
    runtimeStatus: options.runtimeStatus,
    updatedAt: options.timestamp,
    lastTurnAt: options.timestamp,
    sortTimestamp: String(Date.parse(options.timestamp)),
    transcriptUpdatedAt: options.timestamp,
  };
  const fallbackProject: BirdCoderProject = {
    ...localProject,
    id: options.projectId,
    workspaceId: options.workspaceId,
    updatedAt: options.timestamp,
    codingSessions: [fallbackSession],
  };

  const fallbackService = new ApiBackedProjectService({
    client: {
      async getProject() {
        throw new Error('Failed to fetch');
      },
      async listProjects() {
        throw new Error('Failed to fetch');
      },
    } as unknown as BirdCoderAppAdminApiClient,
    writeService: {
      async getProjectById(projectId: string) {
        assert.equal(projectId, options.projectId);
        return structuredClone(fallbackProject);
      },
      async getProjectByPath(workspaceId: string, path: string) {
        assert.equal(workspaceId, options.workspaceId);
        assert.equal(path, fallbackProject.path);
        return structuredClone(fallbackProject);
      },
    } as unknown as IProjectService,
  });

  const originalConsoleWarn = console.warn;
  console.warn = () => undefined;
  try {
    const project = options.lookup === 'id'
      ? await fallbackService.getProjectById(options.projectId)
      : await fallbackService.getProjectByPath(options.workspaceId, fallbackProject.path);
    return project?.codingSessions[0];
  } finally {
    console.warn = originalConsoleWarn;
  }
}

const transientProjectIdFallbackStreamingSession =
  await readTransientProjectDetailFallbackSession({
    codingSessionId: 'coding-session-project-id-fallback-stale-streaming',
    lookup: 'id',
    projectId: 'project-id-fallback-stale-streaming',
    runtimeStatus: 'streaming',
    timestamp: staleRuntimeUnknownTimestamp,
    workspaceId: 'workspace-project-id-fallback-stale-streaming',
  });
assert.equal(
  transientProjectIdFallbackStreamingSession?.runtimeStatus,
  undefined,
  'project detail transient fallback must clear stale local streaming state before returning a selected project.',
);

const transientProjectPathFallbackStreamingSession =
  await readTransientProjectDetailFallbackSession({
    codingSessionId: 'coding-session-project-path-fallback-stale-streaming',
    lookup: 'path',
    projectId: 'project-path-fallback-stale-streaming',
    runtimeStatus: 'streaming',
    timestamp: staleRuntimeUnknownTimestamp,
    workspaceId: 'workspace-project-path-fallback-stale-streaming',
  });
assert.equal(
  transientProjectPathFallbackStreamingSession?.runtimeStatus,
  undefined,
  'project path transient fallback must clear stale local streaming state before returning an import/selection project.',
);

const startupRecoveryRuntimeUnknownTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const startupRecoveryRuntimeUnknownSession = await readRuntimeUnknownStartupSession({
  codingSessionId: 'coding-session-startup-recovery-runtime-unknown',
  projectId: 'project-startup-recovery-runtime-unknown',
  timestamp: startupRecoveryRuntimeUnknownTimestamp,
  workspaceId: 'workspace-startup-recovery-runtime-unknown',
});
assert.equal(
  isBirdCoderCodingSessionExecuting(startupRecoveryRuntimeUnknownSession),
  false,
  'startup project inventory must clear local streaming state after the short optimistic send window when the authoritative summary still does not confirm an executing runtime.',
);

const freshRuntimeUnknownTimestamp = new Date(Date.now() - 60 * 1000).toISOString();
const freshRuntimeUnknownSession = await readRuntimeUnknownStartupSession({
  codingSessionId: 'coding-session-fresh-runtime-unknown',
  projectId: 'project-fresh-runtime-unknown',
  timestamp: freshRuntimeUnknownTimestamp,
  workspaceId: 'workspace-fresh-runtime-unknown',
});
assert.equal(
  freshRuntimeUnknownSession?.runtimeStatus,
  'streaming',
  'startup project inventory should keep a fresh local streaming state while a just-created authoritative summary has not caught up yet.',
);

let refreshedSessionUpsert: BirdCoderCodingSession | null = null;
const refreshResult = await refreshCodingSessionMessages({
  codingSessionId,
  coreReadService: {
    async getCodingSession() {
      return authoritativeCompletedSession;
    },
    async getNativeSession() {
      throw new Error('native session detail should not be requested');
    },
    async listCodingSessionEvents() {
      return [];
    },
    async listCodingSessions() {
      return [authoritativeCompletedSession];
    },
    async listNativeSessions() {
      return [];
    },
  },
  projectService: {
    async upsertCodingSession(candidateProjectId: string, nextSession: BirdCoderCodingSession) {
      assert.equal(candidateProjectId, projectId);
      refreshedSessionUpsert = nextSession;
    },
  } as unknown as IProjectService,
  resolvedLocation: {
    codingSession: localStreamingSession,
    project: {
      ...localProject,
      codingSessions: [localStreamingSession],
    },
    summary: authoritativeCompletedSession,
  },
  workspaceId,
});

assert.equal(refreshResult.status, 'refreshed');
assert.equal(
  refreshResult.codingSession?.runtimeStatus,
  'completed',
  'selected-session startup refresh must settle stale local streaming state when the authoritative summary is terminal.',
);
assert.equal(
  refreshedSessionUpsert?.runtimeStatus,
  'completed',
  'selected-session startup refresh must persist the settled terminal runtime status back to the local mirror.',
);
assert.equal(
  isBirdCoderCodingSessionExecuting(refreshResult.codingSession),
  false,
  'selected-session startup refresh must not keep a spinner when core reports a terminal runtime status.',
);

let orphanedRefreshUpsert: BirdCoderCodingSession | null = null;
const orphanedLocalStreamingSession: BirdCoderCodingSession = {
  ...localStreamingSession,
  id: 'coding-session-orphaned-stale-runtime-status',
  projectId: 'project-orphaned-stale-runtime-status',
  workspaceId: 'workspace-orphaned-stale-runtime-status',
  updatedAt: staleRuntimeUnknownTimestamp,
  lastTurnAt: staleRuntimeUnknownTimestamp,
  sortTimestamp: String(Date.parse(staleRuntimeUnknownTimestamp)),
  transcriptUpdatedAt: staleRuntimeUnknownTimestamp,
};
const orphanedRefreshResult = await refreshCodingSessionMessages({
  codingSessionId: orphanedLocalStreamingSession.id,
  coreReadService: {
    async getCodingSession() {
      throw new Error('authoritative session is unavailable');
    },
    async getNativeSession() {
      throw new Error('native session detail should not be requested');
    },
    async listCodingSessionEvents() {
      throw new Error('events should not be requested after summary lookup fails');
    },
    async listCodingSessions() {
      return [];
    },
    async listNativeSessions() {
      return [];
    },
  },
  projectService: {
    async upsertCodingSession(candidateProjectId: string, nextSession: BirdCoderCodingSession) {
      assert.equal(candidateProjectId, orphanedLocalStreamingSession.projectId);
      orphanedRefreshUpsert = nextSession;
    },
  } as unknown as IProjectService,
  resolvedLocation: {
    codingSession: orphanedLocalStreamingSession,
    project: {
      ...localProject,
      id: orphanedLocalStreamingSession.projectId,
      workspaceId: orphanedLocalStreamingSession.workspaceId,
      codingSessions: [orphanedLocalStreamingSession],
    },
  },
  workspaceId: orphanedLocalStreamingSession.workspaceId,
});

assert.equal(orphanedRefreshResult.status, 'refreshed');
assert.equal(
  orphanedRefreshResult.codingSession?.runtimeStatus,
  undefined,
  'selected-session refresh must clear stale local streaming state when authority lookup fails instead of leaving the row spinner alive forever.',
);
assert.equal(
  orphanedRefreshUpsert?.runtimeStatus,
  undefined,
  'selected-session refresh must persist locally settled stale runtime state after authority lookup failure.',
);
assert.equal(
  isBirdCoderCodingSessionExecuting(orphanedRefreshResult.codingSession),
  false,
  'selected-session refresh must not expose stale local streaming as executing after authority lookup failure.',
);

console.log('coding session stale runtime status startup contract passed.');
