import {
  extractBirdCoderTextContent,
  type BirdCoderChatMessage,
  type BirdCoderCodingSessionEvent,
} from '@sdkwork/birdcoder-types';

interface BirdCoderProjectionDeltaMessage {
  commands?: BirdCoderChatMessage['commands'];
  content: string;
  createdAt: string;
  role: BirdCoderChatMessage['role'];
  turnId?: string;
}

export interface MergeBirdCoderProjectionMessagesOptions {
  codingSessionId: string;
  existingMessages: readonly BirdCoderChatMessage[];
  idPrefix: string;
  events: readonly BirdCoderCodingSessionEvent[];
}

interface BuiltProjectionMessages {
  deletedMessageIds: Set<string>;
  deletedMessageKeys: Set<string>;
  messages: BirdCoderChatMessage[];
}

function readProjectionPayloadString(
  payload: Record<string, unknown> | undefined,
  fieldName: string,
): string | undefined {
  const value = payload?.[fieldName];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function parseProjectionCommands(
  payload: Record<string, unknown> | undefined,
): BirdCoderChatMessage['commands'] | undefined {
  const rawCommands = readProjectionPayloadString(payload, 'commandsJson');
  if (!rawCommands) {
    return undefined;
  }

  try {
    const parsedCommands = JSON.parse(rawCommands);
    return Array.isArray(parsedCommands)
      ? (parsedCommands as BirdCoderChatMessage['commands'])
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeMessageIdentity(
  role: BirdCoderChatMessage['role'],
  content: string,
  turnId?: string,
  createdAt?: string,
): string {
  const normalizedContent = content.replace(/\r\n?/gu, '\n').trim();
  return `${turnId ?? ''}:${role}:${normalizedContent || createdAt || ''}`;
}

function normalizeMessageMatchKey(
  role: BirdCoderChatMessage['role'],
  content: string,
  turnId?: string,
  createdAt?: string,
): string {
  const normalizedContent = content.replace(/\r\n?/gu, '\n').trim();
  if (turnId) {
    return `${turnId}:${role}:${normalizedContent}`;
  }

  return `${role}:${normalizedContent || createdAt || ''}`;
}

function isProjectionRole(
  role: string | undefined,
): role is BirdCoderChatMessage['role'] {
  return (
    role === 'assistant' ||
    role === 'planner' ||
    role === 'reviewer' ||
    role === 'tool' ||
    role === 'user'
  );
}

function compareProjectionMessages(
  left: BirdCoderChatMessage,
  right: BirdCoderChatMessage,
): number {
  return (
    Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
    left.role.localeCompare(right.role)
  );
}

export function buildBirdCoderAuthoritativeProjectionMessageId(
  codingSessionId: string,
  turnIdOrEventId: string,
  role: BirdCoderChatMessage['role'],
): string {
  return `${codingSessionId}:authoritative:${turnIdOrEventId}:${role}`;
}

function buildAuthoritativeMessages(
  codingSessionId: string,
  idPrefix: string,
  events: readonly BirdCoderCodingSessionEvent[],
): BuiltProjectionMessages {
  const sortedEvents = [...events].sort(
    (left, right) =>
      left.sequence - right.sequence ||
      Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
  const authoritativeMessages: BirdCoderChatMessage[] = [];
  const deltaMessagesByKey = new Map<string, BirdCoderProjectionDeltaMessage>();
  const deletedMessageIds = new Set<string>();
  const deletedMessageKeys = new Set<string>();

  for (const event of sortedEvents) {
    if (event.kind !== 'message.deleted') {
      continue;
    }

    const deletedMessageId = readProjectionPayloadString(event.payload, 'deletedMessageId');
    if (deletedMessageId) {
      deletedMessageIds.add(deletedMessageId);
    }

    const role = readProjectionPayloadString(event.payload, 'role');
    if (isProjectionRole(role) && event.turnId) {
      deletedMessageKeys.add(`${event.turnId}:${role}`);
    }
  }

  for (const event of sortedEvents) {
    if (event.kind === 'message.completed') {
      const role = readProjectionPayloadString(event.payload, 'role');
      const content = extractBirdCoderTextContent(event.payload?.content);
      if (!isProjectionRole(role) || !content) {
        continue;
      }

      const messageId =
        idPrefix === 'authoritative'
          ? buildBirdCoderAuthoritativeProjectionMessageId(
              codingSessionId,
              event.turnId ?? event.id,
              role,
            )
          : `${codingSessionId}:${idPrefix}:${event.turnId ?? event.id}:${role}`;
      if (
        deletedMessageIds.has(messageId) ||
        deletedMessageKeys.has(`${event.turnId ?? event.id}:${role}`)
      ) {
        continue;
      }

      authoritativeMessages.push({
        id: messageId,
        codingSessionId,
        turnId: event.turnId,
        role,
        content,
        commands: parseProjectionCommands(event.payload),
        createdAt: event.createdAt,
        timestamp: Date.parse(event.createdAt),
      });
      continue;
    }

    if (event.kind !== 'message.delta') {
      continue;
    }

    const contentDelta =
      extractBirdCoderTextContent(event.payload?.contentDelta) ??
      extractBirdCoderTextContent(event.payload?.content);
    if (!contentDelta) {
      continue;
    }

    const roleCandidate = readProjectionPayloadString(event.payload, 'role') ?? 'assistant';
    if (!isProjectionRole(roleCandidate)) {
      continue;
    }

    const deltaKey = `${event.turnId ?? event.id}:${roleCandidate}`;
    if (
      deletedMessageIds.has(`${codingSessionId}:${idPrefix}:${deltaKey}`) ||
      deletedMessageKeys.has(deltaKey)
    ) {
      continue;
    }
    const existingDeltaMessage = deltaMessagesByKey.get(deltaKey);
    deltaMessagesByKey.set(deltaKey, {
      commands: parseProjectionCommands(event.payload) ?? existingDeltaMessage?.commands,
      content: `${existingDeltaMessage?.content ?? ''}${contentDelta}`,
      createdAt: existingDeltaMessage?.createdAt ?? event.createdAt,
      role: roleCandidate,
      turnId: event.turnId,
    });
  }

  const authoritativeMessageKeys = new Set(
    authoritativeMessages.map((message) =>
      normalizeMessageIdentity(message.role, message.content, message.turnId, message.createdAt),
    ),
  );

  for (const [deltaKey, deltaMessage] of deltaMessagesByKey.entries()) {
    const messageIdentity = normalizeMessageIdentity(
      deltaMessage.role,
      deltaMessage.content,
      deltaMessage.turnId,
      deltaMessage.createdAt,
    );
    if (authoritativeMessageKeys.has(messageIdentity) || !deltaMessage.content.trim()) {
      continue;
    }

    authoritativeMessages.push({
      id: `${codingSessionId}:${idPrefix}:${deltaKey}`,
      codingSessionId,
      turnId: deltaMessage.turnId,
      role: deltaMessage.role,
      content: deltaMessage.content,
      commands: deltaMessage.commands,
      createdAt: deltaMessage.createdAt,
      timestamp: Date.parse(deltaMessage.createdAt),
    });
    authoritativeMessageKeys.add(messageIdentity);
  }

  return {
    deletedMessageIds,
    deletedMessageKeys,
    messages: authoritativeMessages,
  };
}

export function mergeBirdCoderProjectionMessages({
  codingSessionId,
  events,
  existingMessages,
  idPrefix,
}: MergeBirdCoderProjectionMessagesOptions): BirdCoderChatMessage[] {
  const {
    deletedMessageIds,
    deletedMessageKeys,
    messages: authoritativeMessages,
  } = buildAuthoritativeMessages(codingSessionId, idPrefix, events);
  if (authoritativeMessages.length === 0) {
    return existingMessages
      .filter((existingMessage) => {
        const deletionKey =
          existingMessage.turnId && existingMessage.role
            ? `${existingMessage.turnId}:${existingMessage.role}`
            : undefined;
        return (
          !deletedMessageIds.has(existingMessage.id) &&
          (!deletionKey || !deletedMessageKeys.has(deletionKey))
        );
      })
      .sort(compareProjectionMessages);
  }

  const existingMessagesById = new Map<string, BirdCoderChatMessage>();
  const existingMessagesByMatchKey = new Map<string, BirdCoderChatMessage>();
  for (const existingMessage of existingMessages) {
    existingMessagesById.set(existingMessage.id, existingMessage);
    existingMessagesByMatchKey.set(
      normalizeMessageMatchKey(
        existingMessage.role,
        existingMessage.content,
        existingMessage.turnId,
        existingMessage.createdAt,
      ),
      existingMessage,
    );
  }

  const authoritativeMatchKeys = new Set<string>();
  const mergedMessages = authoritativeMessages.map((authoritativeMessage) => {
    const messageMatchKey = normalizeMessageMatchKey(
      authoritativeMessage.role,
      authoritativeMessage.content,
      authoritativeMessage.turnId,
      authoritativeMessage.createdAt,
    );
    authoritativeMatchKeys.add(messageMatchKey);
    const existingMessage =
      existingMessagesById.get(authoritativeMessage.id) ??
      existingMessagesByMatchKey.get(messageMatchKey);
    return existingMessage
      ? {
          ...existingMessage,
          ...authoritativeMessage,
        }
      : authoritativeMessage;
  });

  const authoritativeMessageIds = new Set(mergedMessages.map((message) => message.id));
  for (const existingMessage of existingMessages) {
    const messageMatchKey = normalizeMessageMatchKey(
      existingMessage.role,
      existingMessage.content,
      existingMessage.turnId,
      existingMessage.createdAt,
    );
    const deletionKey =
      existingMessage.turnId && existingMessage.role
        ? `${existingMessage.turnId}:${existingMessage.role}`
        : undefined;
    if (
      authoritativeMessageIds.has(existingMessage.id) ||
      authoritativeMatchKeys.has(messageMatchKey) ||
      deletedMessageIds.has(existingMessage.id) ||
      (deletionKey && deletedMessageKeys.has(deletionKey))
    ) {
      continue;
    }

    mergedMessages.push(existingMessage);
  }

  return mergedMessages.sort(compareProjectionMessages);
}
