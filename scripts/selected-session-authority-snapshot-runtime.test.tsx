// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import type {
  UseSelectedCodingSessionMessagesOptions,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useSelectedCodingSessionMessages.ts';

const runtimeMocks = vi.hoisted(() => ({
  refreshCodingSessionMessages: vi.fn(),
  upsertCodingSessionIntoProjectsStore: vi.fn(),
  upsertProjectIntoProjectsStore: vi.fn(),
}));

vi.mock('@sdkwork/birdcoder-pc-infrastructure-runtime', () => ({
  canSubscribeBirdCoderWorkspaceRealtime: () => true,
}));

vi.mock(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/context/AuthContext.ts',
  () => ({
    useAuth: () => ({
      sessionRevision: 7,
      user: { id: 'selected-session-runtime-user' },
    }),
  }),
);

vi.mock(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/stores/projectsStore.ts',
  () => ({
    upsertCodingSessionIntoProjectsStore:
      runtimeMocks.upsertCodingSessionIntoProjectsStore,
    upsertProjectIntoProjectsStore: runtimeMocks.upsertProjectIntoProjectsStore,
  }),
);

vi.mock(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionRefresh.ts',
  () => ({
    refreshCodingSessionMessages: runtimeMocks.refreshCodingSessionMessages,
  }),
);

const { useSelectedCodingSessionMessages } = await import(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useSelectedCodingSessionMessages.ts'
);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const workspaceId = 'workspace-selected-session-runtime';
const projectId = 'project-selected-session-runtime';
const codingSessionId = 'session-selected-session-runtime';
const timestamp = '2026-07-16T00:00:00.000Z';

function buildCodingSession(
  messages: BirdCoderChatMessage[],
  identity: {
    codingSessionId?: string;
    projectId?: string;
    workspaceId?: string;
  } = {},
): BirdCoderCodingSession {
  const resolvedCodingSessionId = identity.codingSessionId ?? codingSessionId;
  const resolvedProjectId = identity.projectId ?? projectId;
  const resolvedWorkspaceId = identity.workspaceId ?? workspaceId;
  return {
    archived: false,
    createdAt: timestamp,
    displayTime: 'just now',
    engineId: 'codex',
    hostMode: 'desktop',
    id: resolvedCodingSessionId,
    lastTurnAt: timestamp,
    messages,
    modelId: 'gpt-5.4',
    pinned: false,
    projectId: resolvedProjectId,
    sortTimestamp: String(Date.parse(timestamp)),
    status: 'active',
    title: 'Selected session runtime',
    transcriptUpdatedAt: timestamp,
    unread: false,
    updatedAt: timestamp,
    workspaceId: resolvedWorkspaceId,
  };
}

const emptyCodingSession = buildCodingSession([]);
const project: BirdCoderProject = {
  archived: false,
  codingSessions: [emptyCodingSession],
  createdAt: timestamp,
  id: projectId,
  name: 'Selected session runtime project',
  updatedAt: timestamp,
  workspaceId,
};

const authorityMessage: BirdCoderChatMessage = {
  codingSessionId,
  content: 'Authority history loaded after selection',
  createdAt: timestamp,
  id: 'message-selected-session-runtime',
  role: 'assistant',
  timestamp: Date.parse(timestamp),
};
const authorityCodingSession = buildCodingSession([authorityMessage]);
const appRuntimeReadService = {} as NonNullable<
  UseSelectedCodingSessionMessagesOptions['appRuntimeReadService']
>;

function SelectedSessionHarness({
  codingSession = emptyCodingSession,
  selectedProject = project,
  projectService,
}: {
  codingSession?: BirdCoderCodingSession;
  selectedProject?: BirdCoderProject;
  projectService: UseSelectedCodingSessionMessagesOptions['projectService'];
}) {
  const isLoading = useSelectedCodingSessionMessages({
    appRuntimeReadService,
    projectService,
    selectionRefreshToken: 0,
    selectedCodingSession: codingSession,
    selectedCodingSessionId: codingSession.id,
    selectedProject,
    workspaceId: selectedProject.workspaceId,
  });

  return createElement('output', {
    'data-loading': String(isLoading),
    'data-testid': 'selected-session-loading',
  });
}

describe('selected-session authority snapshot hydration', () => {
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    root = null;
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it('loads authority history when realtime is available and the local transcript is empty', async () => {
    let resolveAuthorityRefresh!: (value: unknown) => void;
    runtimeMocks.refreshCodingSessionMessages.mockReturnValue(
      new Promise((resolve) => {
        resolveAuthorityRefresh = resolve;
      }),
    );
    const getCodingSessionTranscript = vi.fn().mockResolvedValue(emptyCodingSession);
    const projectService = {
      getCodingSessionTranscript,
      getProjectById: vi.fn().mockResolvedValue(project),
    } as unknown as UseSelectedCodingSessionMessagesOptions['projectService'];

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SelectedSessionHarness, { projectService }));
      for (let index = 0; index < 5; index += 1) {
        await Promise.resolve();
      }
    });

    expect(getCodingSessionTranscript).toHaveBeenCalledOnce();
    expect(runtimeMocks.refreshCodingSessionMessages).toHaveBeenCalledOnce();
    expect(
      container.querySelector('[data-testid="selected-session-loading"]')
        ?.getAttribute('data-loading'),
    ).toBe('true');

    await act(async () => {
      resolveAuthorityRefresh({
        codingSession: authorityCodingSession,
        codingSessionId,
        messageCount: 1,
        projectId,
        source: 'app-runtime',
        status: 'refreshed',
        workspaceId,
      });
      for (let index = 0; index < 10; index += 1) {
        await Promise.resolve();
      }
    });

    expect(runtimeMocks.upsertCodingSessionIntoProjectsStore).toHaveBeenCalledWith(
      workspaceId,
      projectId,
      authorityCodingSession,
      'selected-session-runtime-user::session:7',
    );
    expect(
      container.querySelector('[data-testid="selected-session-loading"]')
        ?.getAttribute('data-loading'),
    ).toBe('false');

    await act(async () => {
      root?.render(createElement(SelectedSessionHarness, {
        codingSession: authorityCodingSession,
        projectService,
        selectedProject: {
          ...project,
          codingSessions: [authorityCodingSession],
        },
      }));
      for (let index = 0; index < 5; index += 1) {
        await Promise.resolve();
      }
    });

    expect(runtimeMocks.refreshCodingSessionMessages).toHaveBeenCalledOnce();
    expect(getCodingSessionTranscript).toHaveBeenCalledOnce();
  });

  it('loads a fresh authority snapshot when the user switches A to B and back to A', async () => {
    const sessionAId = 'session-selected-runtime-a';
    const sessionBId = 'session-selected-runtime-b';
    const projectAId = 'project-selected-runtime-a';
    const projectBId = 'project-selected-runtime-b';
    const sessionA = buildCodingSession([], {
      codingSessionId: sessionAId,
      projectId: projectAId,
    });
    const sessionB = buildCodingSession([], {
      codingSessionId: sessionBId,
      projectId: projectBId,
    });
    const projectA: BirdCoderProject = {
      ...project,
      codingSessions: [sessionA],
      id: projectAId,
    };
    const projectB: BirdCoderProject = {
      ...project,
      codingSessions: [sessionB],
      id: projectBId,
    };
    const getCodingSessionTranscript = vi.fn(
      async (_projectId: string, selectedCodingSessionId: string) =>
        selectedCodingSessionId === sessionAId ? sessionA : sessionB,
    );
    const projectService = {
      getCodingSessionTranscript,
      getProjectById: vi.fn(async (selectedProjectId: string) =>
        selectedProjectId === projectAId ? projectA : projectB,
      ),
    } as unknown as UseSelectedCodingSessionMessagesOptions['projectService'];
    runtimeMocks.refreshCodingSessionMessages.mockImplementation(
      async (options: { codingSessionId: string }) => {
        const selectedSession = options.codingSessionId === sessionAId ? sessionA : sessionB;
        return {
          codingSession: selectedSession,
          codingSessionId: selectedSession.id,
          messageCount: selectedSession.messages.length,
          projectId: selectedSession.projectId,
          source: 'app-runtime',
          status: 'refreshed',
          workspaceId: selectedSession.workspaceId,
        };
      },
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    async function renderSelection(
      selectedCodingSession: BirdCoderCodingSession,
      selectedProject: BirdCoderProject,
    ): Promise<void> {
      await act(async () => {
        root?.render(createElement(SelectedSessionHarness, {
          codingSession: selectedCodingSession,
          projectService,
          selectedProject,
        }));
        for (let index = 0; index < 10; index += 1) {
          await Promise.resolve();
        }
      });
    }

    await renderSelection(sessionA, projectA);
    await renderSelection(sessionB, projectB);
    await renderSelection(sessionA, projectA);

    expect(getCodingSessionTranscript).toHaveBeenCalledTimes(3);
    expect(runtimeMocks.refreshCodingSessionMessages).toHaveBeenCalledTimes(3);
    expect(
      runtimeMocks.refreshCodingSessionMessages.mock.calls.map(
        ([options]) => (options as { codingSessionId: string }).codingSessionId,
      ),
    ).toEqual([sessionAId, sessionBId, sessionAId]);
  });
});
