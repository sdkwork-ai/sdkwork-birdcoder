interface OpenCodeDevelopmentClientOptions {
  baseUrl?: string;
  directory?: string;
}

interface OpenCodeDevelopmentSessionRecord {
  id: string;
}

interface OpenCodeDevelopmentEvent {
  type: string;
  properties: Record<string, unknown>;
}

function buildOpenCodeDevelopmentText(
  directory?: string,
): string {
  const workingDirectory = directory?.trim() || 'workspace';
  return `OpenCode development bridge is active. Working directory: ${workingDirectory}.`;
}

export function createOpencodeClient(
  options?: OpenCodeDevelopmentClientOptions,
) {
  let currentSessionId = 'opencode-development-session';

  return {
    session: {
      create: async (): Promise<OpenCodeDevelopmentSessionRecord> => {
        return {
          id: currentSessionId,
        };
      },
      prompt: async (): Promise<Record<string, unknown>> => {
        return {
          text: `${buildOpenCodeDevelopmentText(options?.directory)} Prepared the next coding action.`,
        };
      },
      promptAsync: async (): Promise<void> => undefined,
    },
    event: {
      subscribe: async () => {
        return {
          stream: (async function* stream(): AsyncGenerator<OpenCodeDevelopmentEvent, void, unknown> {
            yield {
              type: 'message.part.updated',
              properties: {
                sessionID: currentSessionId,
                delta: `${buildOpenCodeDevelopmentText(options?.directory)} `,
                part: {
                  type: 'text',
                  text: `${buildOpenCodeDevelopmentText(options?.directory)} `,
                },
              },
            };

            yield {
              type: 'message.part.updated',
              properties: {
                sessionID: currentSessionId,
                part: {
                  type: 'tool',
                  callID: 'opencode-development-tool-call',
                  tool: 'run_command',
                  state: 'completed',
                  metadata: {
                    command: 'pnpm lint',
                  },
                },
              },
            };

            yield {
              type: 'session.idle',
              properties: {
                sessionID: currentSessionId,
              },
            };
          })(),
        };
      },
    },
  };
}
