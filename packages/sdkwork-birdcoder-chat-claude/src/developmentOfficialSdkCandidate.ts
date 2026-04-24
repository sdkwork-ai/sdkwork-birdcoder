interface ClaudeDevelopmentPromptOptions {
  model?: string;
  cwd?: string;
  signal?: AbortSignal;
}

interface ClaudeDevelopmentQueryInput {
  prompt: string;
  options?: ClaudeDevelopmentPromptOptions;
}

interface ClaudeDevelopmentQueryEvent {
  type: 'partial_assistant' | 'tool_progress' | 'result';
  event?: string;
  result?: string;
  tool_use_id?: string;
  tool_name?: string;
  elapsed_time_seconds?: number;
}

function buildDevelopmentClaudeText(
  prompt: string,
  options?: ClaudeDevelopmentPromptOptions,
): string {
  const normalizedPrompt = prompt.trim() || 'Review the current workspace.';
  const modelLabel = options?.model?.trim() || 'claude-code';
  const workingDirectory = options?.cwd?.trim() || 'workspace';

  return [
    `Claude development bridge is active for ${modelLabel}.`,
    `Working directory: ${workingDirectory}.`,
    `Next action: ${normalizedPrompt}`,
  ].join(' ');
}

export async function unstable_v2_prompt(
  prompt: string,
  options?: ClaudeDevelopmentPromptOptions,
): Promise<{ result: string }> {
  return {
    result: buildDevelopmentClaudeText(prompt, options),
  };
}

export async function* query(
  input: ClaudeDevelopmentQueryInput,
): AsyncGenerator<ClaudeDevelopmentQueryEvent, void, unknown> {
  const text = buildDevelopmentClaudeText(input.prompt, input.options);

  yield {
    type: 'partial_assistant',
    event: `${text} `,
  };

  yield {
    type: 'tool_progress',
    tool_use_id: 'claude-development-tool-call',
    tool_name: 'apply_patch',
    elapsed_time_seconds: 1,
  };

  yield {
    type: 'result',
    result: `${text} Prepared the next coding action.`,
  };
}
