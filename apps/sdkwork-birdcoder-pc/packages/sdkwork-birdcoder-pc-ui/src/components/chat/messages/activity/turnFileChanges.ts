import {
  normalizeAgentSessionItemToolCalls,
  resolveAgentSessionActivityFileChangeViews,
  resolveTaskProgressDisplayState,
  resolveToolCallsTaskProgressDisplayState,
  type AgentSessionItemView,
  type FileChange,
} from "@sdkwork/birdcoder-pc-workbench/chat/types";

export interface TurnFileChangesCardPresentation {
  fileChanges: readonly FileChange[];
  messageId: string;
  scopeKey: string;
}

export interface TurnFileChangesMessagePresentation {
  card?: TurnFileChangesCardPresentation;
  suppressInlineFileChanges: boolean;
}

export interface ResolveTurnFileChangesMessagePresentationsOptions {
  deferLatestTurn?: boolean;
}

const TERMINAL_FILE_SUMMARY_LIFECYCLE_KINDS = new Set([
  "cancelled",
  "completed",
  "failed",
  "stopped",
]);

function resolveTurnScopeKeys(
  messages: readonly AgentSessionItemView[],
): string[] {
  const fallbackEpochBySessionId = new Map<string, number>();

  return messages.map((message) => {
    const turnId = message.turnId?.trim() ?? "";
    if (turnId) {
      return `turn:${turnId}`;
    }

    const sessionId = message.sessionId.trim() || "transcript";
    let epoch = fallbackEpochBySessionId.get(sessionId) ?? 0;
    if (message.role === "user") {
      epoch += 1;
      fallbackEpochBySessionId.set(sessionId, epoch);
    }
    return `session:${sessionId}:user-epoch:${epoch}`;
  });
}

function normalizeFileChangePathKey(path: string): string {
  return path
    .trim()
    .replace(/^['"`]+|['"`]+$/gu, "")
    .replace(/\\/gu, "/");
}

function isAuthoredTurnReply(message: AgentSessionItemView): boolean {
  return (
    message.role === "assistant" ||
    message.role === "planner" ||
    message.role === "reviewer"
  );
}

function hasTerminalLifecycleEvent(
  messages: readonly AgentSessionItemView[],
  messageIndexes: readonly number[],
): boolean {
  return messageIndexes.some((messageIndex) => messages[messageIndex]?.lifecycleEvents?.some(
    (event) => TERMINAL_FILE_SUMMARY_LIFECYCLE_KINDS.has(event.kind),
  ));
}

function hasUnfinishedTaskProgress(
  messages: readonly AgentSessionItemView[],
  messageIndexes: readonly number[],
): boolean {
  return messageIndexes.some((messageIndex) => {
    const message = messages[messageIndex];
    if (!message) {
      return false;
    }
    const explicitProgress = resolveTaskProgressDisplayState(message.taskProgress);
    const toolProgress = resolveToolCallsTaskProgressDisplayState(
      normalizeAgentSessionItemToolCalls(message.tool_calls),
    );
    const progress = explicitProgress?.items.length
      ? explicitProgress
      : toolProgress ?? explicitProgress;
    return Boolean(progress && progress.completed < progress.total);
  });
}

/**
 * Assigns one aggregate file card after the terminal visible item in each authored turn.
 * File activity remains inline while the latest turn is still running, unless
 * its provider lifecycle has already emitted an explicit terminal event.
 */
export function resolveTurnFileChangesMessagePresentations(
  messages: readonly AgentSessionItemView[],
  options: ResolveTurnFileChangesMessagePresentationsOptions = {},
): TurnFileChangesMessagePresentation[] {
  const presentations = messages.map<TurnFileChangesMessagePresentation>(
    () => ({
      suppressInlineFileChanges: false,
    }),
  );
  if (messages.length === 0) {
    return presentations;
  }

  const scopeKeys = resolveTurnScopeKeys(messages);
  const messageIndexesByScopeKey = new Map<string, number[]>();
  scopeKeys.forEach((scopeKey, messageIndex) => {
    const messageIndexes = messageIndexesByScopeKey.get(scopeKey) ?? [];
    messageIndexes.push(messageIndex);
    messageIndexesByScopeKey.set(scopeKey, messageIndexes);
  });

  const latestScopeKey = scopeKeys.at(-1) ?? "";
  for (const [scopeKey, messageIndexes] of messageIndexesByScopeKey) {
    if (
      options.deferLatestTurn
      && scopeKey === latestScopeKey
      && (
        !hasTerminalLifecycleEvent(messages, messageIndexes)
        || hasUnfinishedTaskProgress(messages, messageIndexes)
      )
    ) {
      continue;
    }

    let terminalAuthoredMessageIndex: number | undefined;
    for (let index = messageIndexes.length - 1; index >= 0; index -= 1) {
      const messageIndex = messageIndexes[index]!;
      const message = messages[messageIndex];
      if (message && isAuthoredTurnReply(message)) {
        terminalAuthoredMessageIndex = messageIndex;
        break;
      }
    }
    const terminalMessageIndex = messageIndexes.at(-1);
    if (terminalAuthoredMessageIndex === undefined || terminalMessageIndex === undefined) {
      continue;
    }

    const fileChangesByPath = new Map<string, FileChange>();
    for (const messageIndex of messageIndexes) {
      const message = messages[messageIndex];
      if (!message) {
        continue;
      }
      for (const fileChange of resolveAgentSessionActivityFileChangeViews(
        message,
      )) {
        fileChangesByPath.set(
          normalizeFileChangePathKey(fileChange.path),
          fileChange,
        );
      }
    }

    const fileChanges = [...fileChangesByPath.values()];
    if (fileChanges.length === 0) {
      continue;
    }

    for (const messageIndex of messageIndexes) {
      presentations[messageIndex] = {
        ...presentations[messageIndex],
        suppressInlineFileChanges: true,
      };
    }

    const terminalAuthoredMessage = messages[terminalAuthoredMessageIndex]!;
    presentations[terminalMessageIndex] = {
      suppressInlineFileChanges: true,
      card: {
        fileChanges,
        messageId: terminalAuthoredMessage.id,
        scopeKey,
      },
    };
  }

  return presentations;
}
