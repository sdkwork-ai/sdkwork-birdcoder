interface GeminiDevelopmentAgentOptions {
  instructions?: string;
  model?: string;
  cwd?: string;
}

interface GeminiDevelopmentEvent {
  type: 'content' | 'tool_call_request';
  value: unknown;
}

function buildGeminiDevelopmentText(
  prompt: string,
  options?: GeminiDevelopmentAgentOptions,
): string {
  const normalizedPrompt = prompt.trim() || 'Inspect the workspace session.';
  const modelLabel = options?.model?.trim() || 'gemini';
  const workingDirectory = options?.cwd?.trim() || 'workspace';

  return [
    `Gemini development bridge is active for ${modelLabel}.`,
    `Working directory: ${workingDirectory}.`,
    `Next action: ${normalizedPrompt}`,
  ].join(' ');
}

export class GeminiCliAgent {
  private readonly options: GeminiDevelopmentAgentOptions;

  constructor(options: GeminiDevelopmentAgentOptions) {
    this.options = options;
  }

  session() {
    const agentOptions = this.options;

    return {
      sendStream: async function* sendStream(
        prompt: string,
      ): AsyncGenerator<GeminiDevelopmentEvent, void, unknown> {
        const text = buildGeminiDevelopmentText(prompt, agentOptions);

        yield {
          type: 'content',
          value: {
            text: `${text} `,
          },
        };

        yield {
          type: 'tool_call_request',
          value: {
            callId: 'gemini-development-tool-call',
            name: 'run_command',
            args: {
              command: 'pnpm lint',
            },
          },
        };

        yield {
          type: 'content',
          value: {
            text: 'Prepared the next coding action.',
          },
        };
      },
    };
  }
}
