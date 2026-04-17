import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { useIDEServices } from '../context/IDEContext.ts';
import type {
  CreateCodingSessionOptions,
  CreateProjectOptions,
} from '../services/interfaces/IProjectService.ts';

function fuzzyScore(pattern: string, value: string): number {
  if (!pattern) {
    return 1;
  }
  if (!value) {
    return 0;
  }

  let patternIndex = 0;
  let valueIndex = 0;
  let score = 0;

  while (patternIndex < pattern.length && valueIndex < value.length) {
    if (pattern[patternIndex].toLowerCase() === value[valueIndex].toLowerCase()) {
      score += 10;
      if (patternIndex === valueIndex) {
        score += 5;
      }
      patternIndex += 1;
    }
    valueIndex += 1;
  }

  return patternIndex === pattern.length ? score : 0;
}

type EditableCodingSessionMessage = Omit<
  BirdCoderChatMessage,
  'codingSessionId' | 'createdAt' | 'id'
>;

interface ProjectsStoreSnapshot {
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
  projects: BirdCoderProject[];
}

interface ProjectsStore {
  inflight: Promise<BirdCoderProject[]> | null;
  listeners: Set<(snapshot: ProjectsStoreSnapshot) => void>;
  snapshot: ProjectsStoreSnapshot;
}

const projectStoresByWorkspaceId = new Map<string, ProjectsStore>();

function createProjectsStoreSnapshot(): ProjectsStoreSnapshot {
  return {
    error: null,
    hasFetched: false,
    isLoading: false,
    projects: [],
  };
}

function cloneProjects(projects: readonly BirdCoderProject[]): BirdCoderProject[] {
  return structuredClone([...projects]);
}

function getProjectsStore(workspaceId: string): ProjectsStore {
  let store = projectStoresByWorkspaceId.get(workspaceId);
  if (!store) {
    store = {
      inflight: null,
      listeners: new Set(),
      snapshot: createProjectsStoreSnapshot(),
    };
    projectStoresByWorkspaceId.set(workspaceId, store);
  }

  return store;
}

function emitProjectsStoreSnapshot(store: ProjectsStore): void {
  const snapshot = store.snapshot;
  store.listeners.forEach((listener) => {
    listener(snapshot);
  });
}

function updateProjectsStoreSnapshot(
  store: ProjectsStore,
  updater: (previousSnapshot: ProjectsStoreSnapshot) => ProjectsStoreSnapshot,
): void {
  store.snapshot = updater(store.snapshot);
  emitProjectsStoreSnapshot(store);
}

function setProjectsStoreError(store: ProjectsStore, message: string): void {
  updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
    ...previousSnapshot,
    error: message,
    hasFetched: true,
    isLoading: false,
  }));
}

async function fetchProjectsForWorkspace(
  store: ProjectsStore,
  workspaceId: string,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
): Promise<BirdCoderProject[]> {
  if (store.inflight) {
    return store.inflight;
  }

  updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
    ...previousSnapshot,
    error: null,
    isLoading: true,
  }));

  const request = projectService
    .getProjects(workspaceId)
    .then((projects) => {
      const clonedProjects = cloneProjects(projects);
      updateProjectsStoreSnapshot(store, () => ({
        error: null,
        hasFetched: true,
        isLoading: false,
        projects: clonedProjects,
      }));
      return clonedProjects;
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to fetch projects';
      setProjectsStoreError(store, message);
      throw error;
    })
    .finally(() => {
      if (store.inflight === request) {
        store.inflight = null;
      }
    });

  store.inflight = request;
  return request;
}

export function useProjects(workspaceId?: string) {
  const { projectService } = useIDEServices();
  const normalizedWorkspaceId = workspaceId?.trim() ?? '';
  const [storeSnapshot, setStoreSnapshot] = useState<ProjectsStoreSnapshot>(() =>
    normalizedWorkspaceId
      ? getProjectsStore(normalizedWorkspaceId).snapshot
      : createProjectsStoreSnapshot(),
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!normalizedWorkspaceId) {
      setStoreSnapshot(createProjectsStoreSnapshot());
      return;
    }

    const store = getProjectsStore(normalizedWorkspaceId);
    setStoreSnapshot(store.snapshot);

    const handleStoreChange = (nextSnapshot: ProjectsStoreSnapshot) => {
      setStoreSnapshot(nextSnapshot);
    };

    const hadActiveListeners = store.listeners.size > 0;
    store.listeners.add(handleStoreChange);

    if ((!store.snapshot.hasFetched || !hadActiveListeners) && !store.inflight) {
      void fetchProjectsForWorkspace(store, normalizedWorkspaceId, projectService).catch(() => {
        // Error state is already propagated through the shared store snapshot.
      });
    }

    return () => {
      store.listeners.delete(handleStoreChange);
    };
  }, [normalizedWorkspaceId, projectService]);

  const refreshProjects = useCallback(async () => {
    if (!normalizedWorkspaceId) {
      const emptySnapshot = createProjectsStoreSnapshot();
      setStoreSnapshot(emptySnapshot);
      return emptySnapshot.projects;
    }

    const store = getProjectsStore(normalizedWorkspaceId);
    return fetchProjectsForWorkspace(store, normalizedWorkspaceId, projectService);
  }, [normalizedWorkspaceId, projectService]);

  const filteredProjects = useMemo(() => {
    const projects = storeSnapshot.projects;
    if (!searchQuery.trim()) {
      return projects;
    }

    const query = searchQuery.trim();

    return projects
      .map((project) => {
        const projectScore = fuzzyScore(query, project.name);
        const scoredCodingSessions = project.codingSessions
          .map((codingSession) => ({
            codingSession,
            score: fuzzyScore(query, codingSession.title),
          }))
          .filter((candidate) => candidate.score > 0)
          .sort((left, right) => right.score - left.score);
        const maxCodingSessionScore =
          scoredCodingSessions.length > 0 ? scoredCodingSessions[0].score : 0;
        const totalScore = Math.max(projectScore, maxCodingSessionScore);

        if (totalScore === 0) {
          return null;
        }

        return {
          project: {
            ...project,
            codingSessions: scoredCodingSessions.map((candidate) => candidate.codingSession),
          },
          score: totalScore,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right!.score - left!.score)
      .map((candidate) => candidate!.project);
  }, [searchQuery, storeSnapshot.projects]);

  const createProject = async (name: string, options?: CreateProjectOptions) => {
    if (!normalizedWorkspaceId) {
      const message = 'Workspace ID is required to create a project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw new Error(message);
    }

    try {
      const newProject = await projectService.createProject(normalizedWorkspaceId, name, options);
      await refreshProjects();
      return newProject;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to create project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const createCodingSession = async (
    projectId: string,
    title: string,
    options?: CreateCodingSessionOptions,
  ) => {
    try {
      const codingSession = await projectService.createCodingSession(projectId, title, options);
      await refreshProjects();
      return codingSession;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to create coding session';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const renameProject = async (projectId: string, name: string) => {
    try {
      await projectService.renameProject(projectId, name);
      await refreshProjects();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to rename project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const updateProject = async (projectId: string, updates: Partial<BirdCoderProject>) => {
    try {
      await projectService.updateProject(projectId, updates);
      await refreshProjects();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to update project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await projectService.deleteProject(projectId);
      await refreshProjects();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to delete project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const renameCodingSession = async (
    projectId: string,
    codingSessionId: string,
    title: string,
  ) => {
    try {
      await projectService.renameCodingSession(projectId, codingSessionId, title);
      await refreshProjects();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to rename coding session';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const updateCodingSession = async (
    projectId: string,
    codingSessionId: string,
    updates: Partial<BirdCoderCodingSession>,
  ) => {
    try {
      await projectService.updateCodingSession(projectId, codingSessionId, updates);
      await refreshProjects();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to update coding session';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const forkCodingSession = async (
    projectId: string,
    codingSessionId: string,
    newTitle?: string,
  ) => {
    try {
      const codingSession = await projectService.forkCodingSession(
        projectId,
        codingSessionId,
        newTitle,
      );
      await refreshProjects();
      return codingSession;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to fork coding session';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const deleteCodingSession = async (projectId: string, codingSessionId: string) => {
    try {
      await projectService.deleteCodingSession(projectId, codingSessionId);
      await refreshProjects();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to delete coding session';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const addCodingSessionMessage = async (
    projectId: string,
    codingSessionId: string,
    message: EditableCodingSessionMessage,
  ) => {
    try {
      const newMessage = await projectService.addCodingSessionMessage(
        projectId,
        codingSessionId,
        message,
      );
      await refreshProjects();
      return newMessage;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to add message';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const editCodingSessionMessage = async (
    projectId: string,
    codingSessionId: string,
    messageId: string,
    updates: Partial<BirdCoderChatMessage>,
  ) => {
    try {
      await projectService.editCodingSessionMessage(
        projectId,
        codingSessionId,
        messageId,
        updates,
      );
      await refreshProjects();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to edit message';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const deleteCodingSessionMessage = async (
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ) => {
    try {
      await projectService.deleteCodingSessionMessage(projectId, codingSessionId, messageId);
      await refreshProjects();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to delete message';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const sendMessage = async (
    projectId: string,
    codingSessionId: string,
    content: string,
    context?: any,
  ) => {
    void context;

    try {
      const newMessage = await projectService.addCodingSessionMessage(projectId, codingSessionId, {
        role: 'user',
        content,
      });
      await refreshProjects();

      return newMessage;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to send message';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  return {
    projects: filteredProjects,
    isLoading: storeSnapshot.isLoading,
    error: storeSnapshot.error,
    searchQuery,
    setSearchQuery,
    createProject,
    createCodingSession,
    renameProject,
    updateProject,
    deleteProject,
    renameCodingSession,
    updateCodingSession,
    forkCodingSession,
    deleteCodingSession,
    addCodingSessionMessage,
    editCodingSessionMessage,
    deleteCodingSessionMessage,
    sendMessage,
    refreshProjects,
  };
}
