import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { IProjectService } from '../interfaces/IProjectService';

function createIsoTimestamp(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function createCodingSessionMessage(
  codingSessionId: string,
  role: BirdCoderChatMessage['role'],
  content: string,
  overrides: Partial<BirdCoderChatMessage> = {},
): BirdCoderChatMessage {
  return {
    id: overrides.id ?? `msg-${Math.random().toString(36).slice(2, 10)}`,
    codingSessionId,
    role,
    content,
    createdAt: overrides.createdAt ?? createIsoTimestamp(),
    timestamp: overrides.timestamp ?? Date.now(),
    ...overrides,
  };
}

function createCodingSession(
  projectId: string,
  workspaceId: string,
  title: string,
  overrides: Partial<BirdCoderCodingSession> = {},
): BirdCoderCodingSession {
  const createdAt = overrides.createdAt ?? createIsoTimestamp();
  const updatedAt = overrides.updatedAt ?? createdAt;

  return {
    id: overrides.id ?? `cs-${Math.random().toString(36).slice(2, 10)}`,
    workspaceId,
    projectId,
    title,
    status: overrides.status ?? 'active',
    hostMode: overrides.hostMode ?? 'desktop',
    engineId: overrides.engineId ?? 'codex',
    modelId: overrides.modelId ?? 'codex',
    createdAt,
    updatedAt,
    lastTurnAt: overrides.lastTurnAt ?? updatedAt,
    displayTime: overrides.displayTime ?? 'Just now',
    pinned: overrides.pinned ?? false,
    archived: overrides.archived ?? false,
    unread: overrides.unread ?? false,
    messages: overrides.messages ?? [],
  };
}

const MOCK_PROJECTS: BirdCoderProject[] = (() => {
  const workspaceOne = 'ws-1';
  const workspaceTwo = 'ws-2';

  const codingSessionOne = createCodingSession('p1', workspaceOne, 'Fix npm install errors', {
    id: 'cs-1',
    displayTime: '2 mins ago',
    createdAt: createIsoTimestamp(-12 * 60 * 1000),
    updatedAt: createIsoTimestamp(-2 * 60 * 1000),
  });
  codingSessionOne.messages = [
    createCodingSessionMessage(
      codingSessionOne.id,
      'user',
      'Can you fix the npm install errors in package.json?',
      { id: 'msg-1', createdAt: createIsoTimestamp(-11 * 60 * 1000) },
    ),
    createCodingSessionMessage(
      codingSessionOne.id,
      'assistant',
      'I updated `package.json` to fix the dependency conflicts. Please review the changes.',
      {
        id: 'msg-2',
        createdAt: createIsoTimestamp(-10 * 60 * 1000),
        fileChanges: [
          {
            path: '/package.json',
            additions: 5,
            deletions: 2,
            originalContent:
              '{\n  "name": "my-app",\n  "dependencies": {\n    "react": "^17.0.2"\n  }\n}',
            content:
              '{\n  "name": "my-app",\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  }\n}',
          },
        ],
      },
    ),
  ];

  return [
    {
      id: 'p1',
      workspaceId: workspaceOne,
      name: 'BirdCoder V1',
      createdAt: createIsoTimestamp(-72 * 60 * 60 * 1000),
      updatedAt: createIsoTimestamp(-2 * 60 * 1000),
      codingSessions: [
        codingSessionOne,
        createCodingSession('p1', workspaceOne, 'Add authentication', {
          id: 'cs-2',
          displayTime: '1 hour ago',
          createdAt: createIsoTimestamp(-2 * 60 * 60 * 1000),
          updatedAt: createIsoTimestamp(-60 * 60 * 1000),
        }),
        createCodingSession('p1', workspaceOne, 'Initial setup', {
          id: 'cs-3',
          displayTime: '2 days ago',
          createdAt: createIsoTimestamp(-2 * 24 * 60 * 60 * 1000),
          updatedAt: createIsoTimestamp(-2 * 24 * 60 * 60 * 1000),
        }),
      ],
    },
    {
      id: 'p2',
      workspaceId: workspaceOne,
      name: 'E-commerce Dashboard',
      createdAt: createIsoTimestamp(-7 * 24 * 60 * 60 * 1000),
      updatedAt: createIsoTimestamp(-3 * 60 * 60 * 1000),
      codingSessions: [
        createCodingSession('p2', workspaceOne, 'Update chart colors', {
          id: 'cs-4',
          displayTime: '3 hours ago',
          createdAt: createIsoTimestamp(-3 * 60 * 60 * 1000),
          updatedAt: createIsoTimestamp(-3 * 60 * 60 * 1000),
        }),
        createCodingSession('p2', workspaceOne, 'Fix layout bug', {
          id: 'cs-5',
          displayTime: '1 day ago',
          createdAt: createIsoTimestamp(-24 * 60 * 60 * 1000),
          updatedAt: createIsoTimestamp(-24 * 60 * 60 * 1000),
        }),
      ],
    },
    {
      id: 'p3',
      workspaceId: workspaceTwo,
      name: 'Personal Portfolio',
      createdAt: createIsoTimestamp(-10 * 24 * 60 * 60 * 1000),
      updatedAt: createIsoTimestamp(-5 * 24 * 60 * 60 * 1000),
      codingSessions: [
        createCodingSession('p3', workspaceTwo, 'Add dark mode', {
          id: 'cs-6',
          displayTime: '5 days ago',
          createdAt: createIsoTimestamp(-5 * 24 * 60 * 60 * 1000),
          updatedAt: createIsoTimestamp(-5 * 24 * 60 * 60 * 1000),
        }),
      ],
    },
  ];
})();

export class MockProjectService implements IProjectService {
  private projects: BirdCoderProject[] = structuredClone(MOCK_PROJECTS);

  async getProjects(workspaceId?: string): Promise<BirdCoderProject[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          structuredClone(
            workspaceId
              ? this.projects.filter((project) => project.workspaceId === workspaceId)
              : this.projects,
          ),
        );
      }, 100);
    });
  }

  async createProject(workspaceId: string, name: string): Promise<BirdCoderProject> {
    const now = createIsoTimestamp();
    const newProject: BirdCoderProject = {
      id: `p-${Date.now()}`,
      workspaceId,
      name,
      createdAt: now,
      updatedAt: now,
      codingSessions: [],
    };
    this.projects.push(newProject);
    return structuredClone(newProject);
  }

  async renameProject(projectId: string, name: string): Promise<void> {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (project) {
      project.name = name;
      project.updatedAt = createIsoTimestamp();
    }
  }

  async updateProject(projectId: string, updates: Partial<BirdCoderProject>): Promise<void> {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (project) {
      Object.assign(project, updates, { updatedAt: createIsoTimestamp() });
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    this.projects = this.projects.filter((project) => project.id !== projectId);
  }

  async createCodingSession(
    projectId: string,
    title: string,
  ): Promise<BirdCoderCodingSession> {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    const codingSession = createCodingSession(projectId, project.workspaceId, title, {
      displayTime: 'Just now',
    });
    project.codingSessions.push(codingSession);
    project.updatedAt = createIsoTimestamp();
    return structuredClone(codingSession);
  }

  async renameCodingSession(
    projectId: string,
    codingSessionId: string,
    title: string,
  ): Promise<void> {
    const codingSession = this.findCodingSession(projectId, codingSessionId);
    if (codingSession) {
      codingSession.title = title;
      codingSession.updatedAt = createIsoTimestamp();
      codingSession.displayTime = 'Just now';
    }
  }

  async updateCodingSession(
    projectId: string,
    codingSessionId: string,
    updates: Partial<BirdCoderCodingSession>,
  ): Promise<void> {
    const codingSession = this.findCodingSession(projectId, codingSessionId);
    if (codingSession) {
      Object.assign(codingSession, updates, {
        updatedAt: createIsoTimestamp(),
        displayTime: 'Just now',
      });
    }
  }

  async forkCodingSession(
    projectId: string,
    codingSessionId: string,
    newTitle?: string,
  ): Promise<BirdCoderCodingSession> {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const codingSession = project.codingSessions.find(
      (candidate) => candidate.id === codingSessionId,
    );
    if (!codingSession) {
      throw new Error(`Coding session ${codingSessionId} not found`);
    }

    const forkedCodingSession = createCodingSession(projectId, project.workspaceId, newTitle ?? `${codingSession.title} (Fork)`, {
      messages: codingSession.messages.map((message) => ({
        ...structuredClone(message),
        id: `msg-${Math.random().toString(36).slice(2, 10)}`,
        codingSessionId: '',
      })),
      pinned: codingSession.pinned,
      archived: false,
      unread: false,
    });
    forkedCodingSession.messages = forkedCodingSession.messages.map((message) => ({
      ...message,
      codingSessionId: forkedCodingSession.id,
    }));

    project.codingSessions.push(forkedCodingSession);
    project.updatedAt = createIsoTimestamp();
    return structuredClone(forkedCodingSession);
  }

  async deleteCodingSession(projectId: string, codingSessionId: string): Promise<void> {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (project) {
      project.codingSessions = project.codingSessions.filter(
        (codingSession) => codingSession.id !== codingSessionId,
      );
      project.updatedAt = createIsoTimestamp();
    }
  }

  async addCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    message: Omit<BirdCoderChatMessage, 'codingSessionId' | 'createdAt' | 'id'>,
  ): Promise<BirdCoderChatMessage> {
    const codingSession = this.findCodingSession(projectId, codingSessionId);
    if (!codingSession) {
      throw new Error(`Coding session ${codingSessionId} not found`);
    }

    const newMessage = createCodingSessionMessage(codingSessionId, message.role, message.content, {
      ...message,
    });
    codingSession.messages.push(newMessage);
    codingSession.updatedAt = createIsoTimestamp();
    codingSession.lastTurnAt = codingSession.updatedAt;
    codingSession.displayTime = 'Just now';
    return structuredClone(newMessage);
  }

  async editCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
    updates: Partial<BirdCoderChatMessage>,
  ): Promise<void> {
    const codingSession = this.findCodingSession(projectId, codingSessionId);
    const message = codingSession?.messages.find((candidate) => candidate.id === messageId);
    if (message) {
      Object.assign(message, updates);
      codingSession!.updatedAt = createIsoTimestamp();
      codingSession!.lastTurnAt = codingSession!.updatedAt;
      codingSession!.displayTime = 'Just now';
    }
  }

  async deleteCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ): Promise<void> {
    const codingSession = this.findCodingSession(projectId, codingSessionId);
    if (codingSession) {
      codingSession.messages = codingSession.messages.filter(
        (message) => message.id !== messageId,
      );
      codingSession.updatedAt = createIsoTimestamp();
      codingSession.lastTurnAt = codingSession.updatedAt;
      codingSession.displayTime = 'Just now';
    }
  }

  private findCodingSession(
    projectId: string,
    codingSessionId: string,
  ): BirdCoderCodingSession | undefined {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    return project?.codingSessions.find((candidate) => candidate.id === codingSessionId);
  }
}
