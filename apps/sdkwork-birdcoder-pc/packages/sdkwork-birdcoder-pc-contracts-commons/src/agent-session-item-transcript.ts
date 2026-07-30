import type {
  AgentSessionItemViewSource,
  AgentSessionProtocolNoticeKind,
} from './agent-session-view.ts';

const AGENT_SESSION_PROTOCOL_NOTICE_KINDS = new Set<AgentSessionProtocolNoticeKind>([
  'blocked',
  'cancelled',
  'compression',
  'failed',
  'info',
  'retry',
  'stopped',
  'warning',
]);

const TRANSCRIPT_AGENT_SESSION_ITEM_KINDS = new Set([
  'user_input',
  'assistant_output',
  'reasoning',
  'tool_call',
  'tool_result',
  'artifact_reference',
  'status_notice',
  'error_notice',
]);

const INTERNAL_AGENT_SESSION_ITEM_KINDS = new Set([
  'system_instruction',
]);

const CODEX_AGENTS_MD_INSTRUCTIONS_PREFIX = '# agents.md instructions for ';

function readMetadataString(
  item: AgentSessionItemViewSource,
  key: string,
): string | undefined {
  if (typeof item.metadata !== 'object' || !item.metadata) {
    return undefined;
  }

  const value = (item.metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function isAgentSessionItemKindIncludedInTranscript(kind: string): boolean {
  return TRANSCRIPT_AGENT_SESSION_ITEM_KINDS.has(kind);
}

export function isAgentSessionItemSourceKindRecognized(kind: string): boolean {
  return TRANSCRIPT_AGENT_SESSION_ITEM_KINDS.has(kind)
    || INTERNAL_AGENT_SESSION_ITEM_KINDS.has(kind);
}

export function resolveAgentSessionItemSourceKind(
  item: AgentSessionItemViewSource,
): string | undefined {
  return readMetadataString(item, 'agentItemKind');
}

export function resolveAgentSessionItemProtocolNoticeKind(
  item: AgentSessionItemViewSource,
): AgentSessionProtocolNoticeKind | undefined {
  if (item.role !== 'system') {
    return undefined;
  }

  const noticeKind = readMetadataString(item, 'noticeKind') as
    | AgentSessionProtocolNoticeKind
    | undefined;
  return noticeKind && AGENT_SESSION_PROTOCOL_NOTICE_KINDS.has(noticeKind)
    ? noticeKind
    : undefined;
}

export function isAgentSessionItemVisibleInTranscript(
  item: AgentSessionItemViewSource,
): boolean {
  const sourceKind = resolveAgentSessionItemSourceKind(item);
  if (sourceKind && INTERNAL_AGENT_SESSION_ITEM_KINDS.has(sourceKind)) {
    return false;
  }
  if (
    item.role === 'user'
    && item.content.trimStart().slice(0, CODEX_AGENTS_MD_INSTRUCTIONS_PREFIX.length).toLowerCase()
      === CODEX_AGENTS_MD_INSTRUCTIONS_PREFIX
  ) {
    return false;
  }
  if (item.role !== 'system') {
    return true;
  }

  const isCanonicalNotice = sourceKind === 'status_notice' || sourceKind === 'error_notice';
  const isExplicitProtocolNotice = resolveAgentSessionItemProtocolNoticeKind(item) !== undefined;
  return item.content.trim().length > 0 && (isCanonicalNotice || isExplicitProtocolNotice);
}
