import { useEffect, useMemo, useState } from 'react';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { useIDEServices } from '../context/IDEContext';

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

export function useProjects(workspaceId?: string) {
  const { projectService, chatEngine } = useIDEServices();
  const [projects, setProjects] = useState<BirdCoderProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await projectService.getProjects(workspaceId);
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setProjects([]);
    void fetchProjects();
  }, [workspaceId]);

  const filteredProjects = useMemo(() => {
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
  }, [projects, searchQuery]);

  const createProject = async (name: string) => {
    if (!workspaceId) {
      const message = 'Workspace ID is required to create a project';
      setError(message);
      throw new Error(message);
    }

    try {
      const newProject = await projectService.createProject(workspaceId, name);
      await fetchProjects();
      return newProject;
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      throw err;
    }
  };

  const createCodingSession = async (projectId: string, title: string) => {
    try {
      const codingSession = await projectService.createCodingSession(projectId, title);
      await fetchProjects();
      return codingSession;
    } catch (err: any) {
      setError(err.message || 'Failed to create coding session');
      throw err;
    }
  };

  const renameProject = async (projectId: string, name: string) => {
    try {
      await projectService.renameProject(projectId, name);
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to rename project');
    }
  };

  const updateProject = async (projectId: string, updates: Partial<BirdCoderProject>) => {
    try {
      await projectService.updateProject(projectId, updates);
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to update project');
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await projectService.deleteProject(projectId);
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
    }
  };

  const renameCodingSession = async (
    projectId: string,
    codingSessionId: string,
    title: string,
  ) => {
    try {
      await projectService.renameCodingSession(projectId, codingSessionId, title);
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to rename coding session');
    }
  };

  const updateCodingSession = async (
    projectId: string,
    codingSessionId: string,
    updates: Partial<BirdCoderCodingSession>,
  ) => {
    try {
      await projectService.updateCodingSession(projectId, codingSessionId, updates);
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to update coding session');
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
      await fetchProjects();
      return codingSession;
    } catch (err: any) {
      setError(err.message || 'Failed to fork coding session');
      throw err;
    }
  };

  const deleteCodingSession = async (projectId: string, codingSessionId: string) => {
    try {
      await projectService.deleteCodingSession(projectId, codingSessionId);
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to delete coding session');
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
      await fetchProjects();
      return newMessage;
    } catch (err: any) {
      setError(err.message || 'Failed to add message');
      throw err;
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
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to edit message');
    }
  };

  const deleteCodingSessionMessage = async (
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ) => {
    try {
      await projectService.deleteCodingSessionMessage(projectId, codingSessionId, messageId);
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to delete message');
    }
  };

  const sendMessage = async (
    projectId: string,
    codingSessionId: string,
    content: string,
    context?: any,
  ) => {
    try {
      const newMessage = await projectService.addCodingSessionMessage(projectId, codingSessionId, {
        role: 'user',
        content,
      });
      await fetchProjects();

      const project = projects.find((candidate) => candidate.id === projectId);
      const codingSession = project?.codingSessions.find(
        (candidate) => candidate.id === codingSessionId,
      );

      if (codingSession) {
        const messages = codingSession.messages.map((message) => ({
          id: message.id,
          role: message.role as 'user' | 'assistant' | 'system' | 'tool',
          content: message.content,
          timestamp: Date.now(),
        }));

        messages.push({
          id: newMessage.id,
          role: 'user',
          content,
          timestamp: Date.now(),
        });

        const assistantMessage = await projectService.addCodingSessionMessage(
          projectId,
          codingSessionId,
          {
            role: 'assistant',
            content: '',
          },
        );
        await fetchProjects();

        try {
          const stream = chatEngine.sendMessageStream(messages, { context });
          let fullContent = '';
          let fileChanges: any[] = [];
          let commands: any[] = [];
          let toolCalls: any[] = [];

          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta;
            if (!delta) {
              continue;
            }

            let updated = false;

            if (delta.content) {
              fullContent += delta.content;
              updated = true;
            }

            if (delta.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                toolCalls.push(toolCall);

                if (toolCall.function.name === 'edit_file') {
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    fileChanges.push({
                      path: args.path,
                      content: args.content,
                      additions: args.content.split('\n').length,
                      deletions: 0,
                    });
                    updated = true;
                  } catch {}
                } else if (toolCall.function.name === 'run_command') {
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    commands.push({
                      command: args.command,
                      status: 'success',
                      output: 'Command executed successfully.',
                    });
                    updated = true;
                  } catch {}
                }
              }
            }

            if (updated) {
              await projectService.editCodingSessionMessage(
                projectId,
                codingSessionId,
                assistantMessage.id,
                {
                  content: fullContent,
                  tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
                  fileChanges: fileChanges.length > 0 ? fileChanges : undefined,
                  commands: commands.length > 0 ? commands : undefined,
                },
              );
              await fetchProjects();
            }
          }
        } catch (streamError) {
          console.error('Streaming error:', streamError);
          await projectService.editCodingSessionMessage(
            projectId,
            codingSessionId,
            assistantMessage.id,
            {
              content: 'Error generating response.',
            },
          );
          await fetchProjects();
        }
      }

      return newMessage;
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      throw err;
    }
  };

  return {
    projects: filteredProjects,
    isLoading,
    error,
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
    refreshProjects: fetchProjects,
  };
}
