import {
  BIRDCODER_CHAT_MESSAGE_RESOURCE_KINDS,
  type BirdCoderChatMessageResource,
  type BirdCoderChatMessageResourceCitation,
  type BirdCoderChatMessageResourceKind,
  type BirdCoderChatMessageResourceOrigin,
} from '@sdkwork/birdcoder-chat-contracts';
import {
  resolveBirdCoderChatMessageMediaSource,
  type BirdCoderChatMessageMediaKind,
} from './chat-message-media.ts';

export {
  BIRDCODER_CHAT_MESSAGE_RESOURCE_KINDS,
  type BirdCoderChatMessageResource,
  type BirdCoderChatMessageResourceCitation,
  type BirdCoderChatMessageResourceKind,
  type BirdCoderChatMessageResourceOrigin,
};

const MAX_MESSAGE_RESOURCES = 32;
const MAX_RESOURCE_NAME_CHARACTERS = 256;
const MAX_RESOURCE_LOCATION_CHARACTERS = 4_096;
const MAX_RESOURCE_DESCRIPTION_CHARACTERS = 4_000;
const MAX_RESOURCE_EXCERPT_CHARACTERS = 4_000;
const MAX_RESOURCE_MIME_TYPE_CHARACTERS = 128;
const MAX_RESOURCE_THREAD_IDS = 16;
const MAX_RESOURCE_THREAD_ID_CHARACTERS = 256;

const RESOURCE_KIND_SET = new Set<string>(BIRDCODER_CHAT_MESSAGE_RESOURCE_KINDS);
const RESOURCE_ORIGIN_KIND_SET = new Set<string>(['file', 'symbol', 'resource']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoundedString(value: unknown, maxCharacters: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.length > maxCharacters
    ? normalized.slice(0, maxCharacters)
    : normalized;
}

function isOpaqueMediaSource(value: string | undefined): boolean {
  return Boolean(value && /^(?:data|blob):/iu.test(value));
}

function readNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.floor(value));
}

function projectResourceOrigin(value: unknown): BirdCoderChatMessageResourceOrigin | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const kind = readBoundedString(value.kind, 32);
  if (!kind || !RESOURCE_ORIGIN_KIND_SET.has(kind)) {
    return undefined;
  }
  const name = readBoundedString(value.name, MAX_RESOURCE_NAME_CHARACTERS);
  const path = readBoundedString(value.path, MAX_RESOURCE_LOCATION_CHARACTERS);
  const rawUri = readBoundedString(value.uri, MAX_RESOURCE_LOCATION_CHARACTERS);
  const uri = isOpaqueMediaSource(rawUri) ? undefined : rawUri;
  const clientName = readBoundedString(value.clientName, MAX_RESOURCE_NAME_CHARACTERS);
  const excerpt = readBoundedString(value.excerpt, MAX_RESOURCE_EXCERPT_CHARACTERS);
  const lineStart = readNonNegativeInteger(value.lineStart);
  const lineEnd = readNonNegativeInteger(value.lineEnd);
  const columnStart = readNonNegativeInteger(value.columnStart);
  const columnEnd = readNonNegativeInteger(value.columnEnd);
  return {
    kind: kind as BirdCoderChatMessageResourceOrigin['kind'],
    ...(name ? { name } : {}),
    ...(path ? { path } : {}),
    ...(uri ? { uri } : {}),
    ...(clientName ? { clientName } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(lineStart !== undefined ? { lineStart } : {}),
    ...(lineEnd !== undefined ? { lineEnd } : {}),
    ...(columnStart !== undefined ? { columnStart } : {}),
    ...(columnEnd !== undefined ? { columnEnd } : {}),
  };
}

function projectResourceCitation(
  value: unknown,
): BirdCoderChatMessageResourceCitation | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const lineStart = readNonNegativeInteger(value.lineStart);
  const lineEnd = readNonNegativeInteger(value.lineEnd);
  const note = readBoundedString(value.note, MAX_RESOURCE_DESCRIPTION_CHARACTERS);
  const threadIds = Array.isArray(value.threadIds)
    ? value.threadIds
        .slice(0, MAX_RESOURCE_THREAD_IDS)
        .flatMap((threadId) => {
          const normalized = readBoundedString(threadId, MAX_RESOURCE_THREAD_ID_CHARACTERS);
          return normalized ? [normalized] : [];
        })
    : [];
  if (lineStart === undefined && lineEnd === undefined && !note && threadIds.length === 0) {
    return undefined;
  }
  return {
    ...(lineStart !== undefined ? { lineStart } : {}),
    ...(lineEnd !== undefined ? { lineEnd } : {}),
    ...(note ? { note } : {}),
    ...(threadIds.length > 0 ? { threadIds } : {}),
  };
}

function projectMessageResource(
  value: unknown,
  index: number,
): BirdCoderChatMessageResource | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = readBoundedString(value.kind, 32);
  if (!kind || !RESOURCE_KIND_SET.has(kind)) {
    return null;
  }
  const id = readBoundedString(value.id, MAX_RESOURCE_NAME_CHARACTERS)
    ?? `message-resource-${index + 1}`;
  const name = readBoundedString(value.name, MAX_RESOURCE_NAME_CHARACTERS);
  const path = readBoundedString(value.path, MAX_RESOURCE_LOCATION_CHARACTERS);
  const rawUri = readBoundedString(value.uri, MAX_RESOURCE_LOCATION_CHARACTERS);
  const uri = isOpaqueMediaSource(rawUri) ? undefined : rawUri;
  const mimeType = readBoundedString(value.mimeType, MAX_RESOURCE_MIME_TYPE_CHARACTERS);
  const mediaKind: BirdCoderChatMessageMediaKind | undefined =
    kind === 'image' || kind === 'audio' ? kind : undefined;
  const mediaSource = mediaKind
    ? resolveBirdCoderChatMessageMediaSource(value.mediaSource, mediaKind, mimeType)
    : undefined;
  const description = readBoundedString(
    value.description,
    MAX_RESOURCE_DESCRIPTION_CHARACTERS,
  );
  const origin = projectResourceOrigin(value.origin);
  const citation = projectResourceCitation(value.citation);
  if (!name && !path && !uri && !mediaSource && !mimeType && !description && !origin && !citation) {
    return null;
  }
  return {
    id,
    kind: kind as BirdCoderChatMessageResourceKind,
    ...(name ? { name } : {}),
    ...(path ? { path } : {}),
    ...(uri ? { uri } : {}),
    ...(mediaSource ? { mediaSource } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(description ? { description } : {}),
    ...(origin ? { origin } : {}),
    ...(citation ? { citation } : {}),
  };
}

export function projectChatMessageResources(
  values: readonly unknown[] | undefined,
): BirdCoderChatMessageResource[] {
  if (!values || values.length === 0) {
    return [];
  }
  const order: string[] = [];
  const resourcesById = new Map<string, BirdCoderChatMessageResource>();
  values.slice(0, MAX_MESSAGE_RESOURCES).forEach((value, index) => {
    const resource = projectMessageResource(value, index);
    if (!resource) {
      return;
    }
    if (!resourcesById.has(resource.id)) {
      order.push(resource.id);
    }
    resourcesById.set(resource.id, resource);
  });
  return order.flatMap((id) => {
    const resource = resourcesById.get(id);
    return resource ? [resource] : [];
  });
}
