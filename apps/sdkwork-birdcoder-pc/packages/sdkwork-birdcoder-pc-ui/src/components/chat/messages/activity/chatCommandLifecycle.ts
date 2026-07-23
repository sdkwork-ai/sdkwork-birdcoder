import {
  normalizeAgentSessionCommand,
  normalizeAgentSessionItemToolCalls,
  resolveBirdCoderCodeEngineCommandInteractionState,
  type AgentSessionItemView,
  type AgentSessionCommandView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';

export type ChatCommandLifecycleTone =
  | 'approval'
  | 'cancelled'
  | 'error'
  | 'reply'
  | 'running'
  | 'success';

export type ChatCommandLiveAnnouncementKind =
  | 'approval'
  | 'reply'
  | 'running'
  | 'waiting';

export interface ChatCommandLiveAnnouncement {
  count: number;
  kind: ChatCommandLiveAnnouncementKind;
}

export type ChatCommandLifecycleSnapshot = ReadonlyMap<string, ChatCommandLifecycleTone>;

export function resolveChatCommandLifecycleTone(
  command: AgentSessionCommandView,
): ChatCommandLifecycleTone {
  if (command.runtimeStatus === 'terminated') {
    return 'cancelled';
  }

  const interactionState = resolveBirdCoderCodeEngineCommandInteractionState(command);
  if (interactionState.requiresReply) {
    return 'reply';
  }
  if (interactionState.requiresApproval) {
    return 'approval';
  }
  if (command.status === 'success') {
    return 'success';
  }
  if (command.status === 'error') {
    return 'error';
  }

  return 'running';
}

function resolveChatCommandLifecycleKey(
  message: AgentSessionItemView,
  messageIndex: number,
  command: AgentSessionCommandView,
  commandIndex: number,
): string {
  const turnId = message.turnId?.trim() ?? '';
  const toolCallId = command.toolCallId?.trim() ?? '';
  if (toolCallId) {
    return JSON.stringify([turnId || 'session', 'tool-call', toolCallId]);
  }

  return JSON.stringify([
    turnId || message.id?.trim() || `message-${messageIndex}`,
    'command',
    commandIndex,
    command.kind ?? '',
    command.command.trim(),
  ]);
}

export function buildChatCommandLifecycleSnapshot(
  messages: readonly AgentSessionItemView[],
  engineId?: string,
): ChatCommandLifecycleSnapshot {
  const snapshot = new Map<string, ChatCommandLifecycleTone>();
  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex]!;
    const normalizedCommands = normalizeAgentSessionItemToolCalls(message.tool_calls, { engineId })
      .flatMap((call) => {
        const command = normalizeAgentSessionCommand(call);
        return command ? [command] : [];
      });
    const commands = [...(message.commands ?? []), ...normalizedCommands];
    for (let commandIndex = 0; commandIndex < commands.length; commandIndex += 1) {
      const command = commands[commandIndex];
      if (!command) {
        continue;
      }

      snapshot.set(
        resolveChatCommandLifecycleKey(message, messageIndex, command, commandIndex),
        resolveChatCommandLifecycleTone(command),
      );
    }
  }

  return snapshot;
}

export function resolveChatCommandLiveAnnouncement(
  previousSnapshot: ChatCommandLifecycleSnapshot,
  nextSnapshot: ChatCommandLifecycleSnapshot,
): ChatCommandLiveAnnouncement | null {
  let approvalCount = 0;
  let replyCount = 0;
  let runningCount = 0;

  for (const [commandKey, nextTone] of nextSnapshot.entries()) {
    if (previousSnapshot.get(commandKey) === nextTone) {
      continue;
    }

    if (nextTone === 'approval') {
      approvalCount += 1;
    } else if (nextTone === 'reply') {
      replyCount += 1;
    } else if (nextTone === 'running') {
      runningCount += 1;
    }
  }

  const waitingCount = approvalCount + replyCount;
  if (waitingCount > 0) {
    return {
      count: waitingCount,
      kind: approvalCount > 0 && replyCount > 0
        ? 'waiting'
        : replyCount > 0
          ? 'reply'
          : 'approval',
    };
  }
  if (runningCount > 0) {
    return {
      count: runningCount,
      kind: 'running',
    };
  }

  return null;
}
