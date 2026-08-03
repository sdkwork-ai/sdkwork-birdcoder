import type {
  AgentSessionItemToolCallView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';

type ToolCallActionPhase = 'completed' | 'failed' | 'inProgress';
type AgentToolOperation = 'close' | 'inspect' | 'message' | 'resume' | 'spawn' | 'wait';

export interface ToolCallActionPresentation {
  displayName: string;
  label: string;
}

const AGENT_OPERATION_PATTERNS: readonly [RegExp, AgentToolOperation][] = [
  [/(?:spawn|create|start)(?:_|\s|-)*(?:agent|subagent|session|task)/u, 'spawn'],
  [/(?:send|message|followup|follow_up|input)/u, 'message'],
  [/(?:resume|continue)/u, 'resume'],
  [/(?:interrupt|close|stop|cancel|archive)/u, 'close'],
  [/(?:wait|join)/u, 'wait'],
  [/(?:list|inspect|status|get)/u, 'inspect'],
];

function translate(
  t: ChatMessageTranslate | undefined,
  key: string,
  fallback: string,
): string {
  return t?.(key) ?? fallback;
}

function resolveActionPhase(call: AgentSessionItemToolCallView): ToolCallActionPhase {
  if (call.status === 'error' || call.status === 'cancelled') {
    return 'failed';
  }
  if (
    call.status === 'pending'
    || call.status === 'running'
    || call.status === 'waiting'
  ) {
    return 'inProgress';
  }
  return 'completed';
}

function normalizeToolName(name: string): string {
  return name
    .trim()
    .replace(/([a-z\d])([A-Z])/gu, '$1_$2')
    .replace(/[.\s/-]+/gu, '_')
    .toLowerCase();
}

function resolveAgentOperation(name: string): AgentToolOperation {
  const normalizedName = normalizeToolName(name);
  return AGENT_OPERATION_PATTERNS.find(([pattern]) => pattern.test(normalizedName))?.[1]
    ?? 'inspect';
}

export function humanizeToolCallName(name: string): string {
  const canonicalName = name
    .trim()
    .replace(/^mcp__(?:[^_]+__)?/iu, '')
    .replace(/([a-z\d])([A-Z])/gu, '$1 $2')
    .replace(/[_./-]+/gu, ' ')
    .replace(/\bthreads\b/giu, 'sessions')
    .replace(/\bthread\b/giu, 'session')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!canonicalName) {
    return 'Tool';
  }
  return canonicalName.charAt(0).toUpperCase() + canonicalName.slice(1);
}

function humanizeAgentPath(value: string): string | null {
  const segment = value
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== 'root')
    .at(-1);
  if (!segment) {
    return null;
  }
  const normalized = segment
    .replace(/[_-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/** Codex desktop sub-agent activity phrase per `subAgentActivity.kind`. */
function resolveSubagentActivityPhrase(
  call: AgentSessionItemToolCallView,
  t?: ChatMessageTranslate,
): string | null {
  const kind = call.name.trim().toLowerCase();
  if (!kind.startsWith('subagent_')) {
    return null;
  }
  const activityKind = kind.slice('subagent_'.length);
  if (activityKind === 'interrupted') {
    return translate(t, 'chat.toolActionSubagentInterrupted', 'interrupted');
  }
  if (activityKind === 'updated' || activityKind === 'interacted') {
    return translate(t, 'chat.toolActionSubagentUpdated', 'updated');
  }
  return translate(t, 'chat.toolActionSubagentStartedWorking', 'started working');
}

function resolveSubagentActivityDisplayName(
  call: AgentSessionItemToolCallView,
  t?: ChatMessageTranslate,
): string | null {
  const phrase = resolveSubagentActivityPhrase(call, t);
  if (phrase === null) {
    return null;
  }
  const displayName = call.target?.trim()
    ? humanizeAgentPath(call.target)
    : null;
  return `${displayName ?? translate(t, 'chat.toolActionSubagentDefaultName', 'Agent')} ${phrase}`;
}

function resolveDisplayName(call: AgentSessionItemToolCallView): string {
  const title = call.title?.trim();
  const target = call.target?.trim();
  const command = call.command?.trim();
  const toolName = humanizeToolCallName(call.name);

  switch (call.kind) {
    case 'mcp':
      return call.serverName?.trim()
        ? `${call.serverName.trim()} / ${toolName}`
        : toolName;
    case 'agent': {
      const subagentDisplayName = resolveSubagentActivityDisplayName(call);
      return subagentDisplayName ?? (title || target || toolName);
    }
    case 'approval':
    case 'question':
    case 'skill':
    case 'task':
      return title || target || toolName;
    case 'command':
      return command || target || '';
    case 'file':
    case 'media':
    case 'search':
    case 'web':
      return title || target || command || '';
    default:
      return title || target || toolName;
  }
}

function resolveAgentActionLabel(
  call: AgentSessionItemToolCallView,
  phase: ToolCallActionPhase,
  t?: ChatMessageTranslate,
): string {
  if (resolveSubagentActivityPhrase(call, t) !== null) {
    // Codex desktop renders the full "{displayName} started working /
    // updated / interrupted" line without a leading verb.
    return '';
  }
  const operation = resolveAgentOperation(call.name);
  const labels: Record<AgentToolOperation, Record<ToolCallActionPhase, [string, string]>> = {
    close: {
      completed: ['chat.toolActionAgentClosed', 'Closed'],
      failed: ['chat.toolActionAgentCloseFailed', 'Failed to close'],
      inProgress: ['chat.toolActionAgentClosing', 'Closing'],
    },
    inspect: {
      completed: ['chat.toolActionAgentsChecked', 'Checked subagents'],
      failed: ['chat.toolActionAgentsCheckFailed', 'Failed to check subagents'],
      inProgress: ['chat.toolActionAgentsChecking', 'Checking subagents'],
    },
    message: {
      completed: ['chat.toolActionAgentMessaged', 'Messaged'],
      failed: ['chat.toolActionAgentMessageFailed', 'Failed to message'],
      inProgress: ['chat.toolActionAgentMessaging', 'Messaging'],
    },
    resume: {
      completed: ['chat.toolActionAgentResumed', 'Resumed'],
      failed: ['chat.toolActionAgentResumeFailed', 'Failed to resume'],
      inProgress: ['chat.toolActionAgentResuming', 'Resuming'],
    },
    spawn: {
      completed: ['chat.toolActionAgentCreated', 'Created'],
      failed: ['chat.toolActionAgentCreateFailed', 'Failed to create'],
      inProgress: ['chat.toolActionAgentCreating', 'Creating'],
    },
    wait: {
      completed: ['chat.toolActionAgentsWaited', 'Waited for subagents'],
      failed: ['chat.toolActionAgentsWaitFailed', 'Failed waiting for subagents'],
      inProgress: ['chat.toolActionAgentsWaiting', 'Waiting for subagents'],
    },
  };
  const [key, fallback] = labels[operation][phase];
  return translate(t, key, fallback);
}

function resolveKindActionLabel(
  call: AgentSessionItemToolCallView,
  phase: ToolCallActionPhase,
  t?: ChatMessageTranslate,
): string {
  if (call.kind === 'agent') {
    return resolveAgentActionLabel(call, phase, t);
  }

  if (call.kind === 'mcp') {
    // Codex desktop shows the collapsed MCP row as a bare `{tool}` label
    // (server identity is carried by the leading icon); only failed calls
    // add an explicit verb before the tool name.
    return phase === 'failed'
      ? translate(t, 'chat.toolActionMcpFailed', 'Failed to call')
      : '';
  }

  if (call.kind === 'media' && /image_generation|generate_image/iu.test(call.name)) {
    // Codex desktop labels assistant-generated images
    // (`codex.localConversation.generatedImage`) distinctly from inspected
    // media (`imageView`).
    const labels = {
      completed: ['chat.toolActionImageGenerated', 'Generated image'],
      failed: ['chat.toolActionImageGenerationFailed', 'Failed to generate image'],
      inProgress: ['chat.toolActionImageGenerating', 'Generating image'],
    } as const;
    const [key, fallback] = labels[phase];
    return translate(t, key, fallback);
  }

  const labels: Record<string, Record<ToolCallActionPhase, [string, string]>> = {
    approval: {
      completed: ['chat.toolActionApprovalRequested', 'Requested approval'],
      failed: ['chat.toolActionApprovalFailed', 'Failed to request approval'],
      inProgress: ['chat.toolActionApprovalRequesting', 'Requesting approval'],
    },
    command: {
      completed: ['chat.toolActionCommandRan', 'Ran command'],
      failed: ['chat.toolActionCommandFailed', 'Command failed'],
      inProgress: ['chat.toolActionCommandRunning', 'Running command'],
    },
    file: {
      completed: ['chat.toolActionFileEdited', 'Edited'],
      failed: ['chat.toolActionFileFailed', 'Failed to edit'],
      inProgress: ['chat.toolActionFileEditing', 'Editing'],
    },
    media: {
      completed: ['chat.toolActionMediaInspected', 'Inspected image'],
      failed: ['chat.toolActionMediaFailed', 'Failed to inspect image'],
      inProgress: ['chat.toolActionMediaInspecting', 'Inspecting image'],
    },
    question: {
      completed: ['chat.toolActionQuestionAsked', 'Asked a question'],
      failed: ['chat.toolActionQuestionFailed', 'Failed to ask a question'],
      inProgress: ['chat.toolActionQuestionAsking', 'Asking a question'],
    },
    search: {
      completed: ['chat.toolActionSearchCompleted', 'Searched code'],
      failed: ['chat.toolActionSearchFailed', 'Search failed'],
      inProgress: ['chat.toolActionSearchRunning', 'Searching code'],
    },
    skill: {
      completed: ['chat.toolActionSkillLoaded', 'Loaded skill'],
      failed: ['chat.toolActionSkillFailed', 'Failed to load skill'],
      inProgress: ['chat.toolActionSkillLoading', 'Loading skill'],
    },
    task: {
      completed: ['chat.toolActionTaskUpdated', 'Updated task'],
      failed: ['chat.toolActionTaskFailed', 'Failed to update task'],
      inProgress: ['chat.toolActionTaskUpdating', 'Updating task'],
    },
    web: {
      completed: ['chat.toolActionWebSearched', 'Searched the web'],
      failed: ['chat.toolActionWebFailed', 'Web search failed'],
      inProgress: ['chat.toolActionWebSearching', 'Searching the web'],
    },
  };
  const [key, fallback] = labels[call.kind ?? '']?.[phase]
    ?? {
      completed: ['chat.toolActionOtherRan', 'Ran'],
      failed: ['chat.toolActionOtherFailed', 'Failed to run'],
      inProgress: ['chat.toolActionOtherRunning', 'Running'],
    }[phase];
  return translate(t, key, fallback);
}

export function resolveToolCallActionPresentation(
  call: AgentSessionItemToolCallView,
  t?: ChatMessageTranslate,
): ToolCallActionPresentation {
  const phase = resolveActionPhase(call);
  return {
    displayName: resolveDisplayName(call),
    label: resolveKindActionLabel(call, phase, t),
  };
}
