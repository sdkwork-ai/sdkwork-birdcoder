import {
  MAX_AGENT_SESSION_ITEM_RESOURCES,
  type AgentSessionItemResourceView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const MAX_CODEX_USER_CONTENT_CHARACTERS = 4 * 1_024 * 1_024;
const MAX_CODEX_USER_CONTENT_PARTS = 256;
const MAX_CODEX_RESOURCE_LOCATION_CHARACTERS = 32 * 1_024;
const CODEX_FILES_MENTIONED_HEADER = '# Files mentioned by the user:';
const CODEX_USER_REQUEST_MARKER = '## My request for Codex:';
const CODEX_MEDIA_PLACEHOLDER_ID_SEGMENT = '-codex-media-placeholder-';

const CODEX_TEXT_INPUT_TYPES = new Set([
  'text',
  'inputtext',
]);

const CODEX_IMAGE_INPUT_TYPES = new Set([
  'image',
  'inputimage',
]);

const CODEX_LOCAL_IMAGE_INPUT_TYPES = new Set([
  'localimage',
]);

const CODEX_AUDIO_INPUT_TYPES = new Set([
  'audio',
  'inputaudio',
]);

const CODEX_LOCAL_AUDIO_INPUT_TYPES = new Set([
  'localaudio',
]);

const CODEX_FILE_INPUT_TYPES = new Set([
  'attachment',
  'document',
  'file',
  'inputfile',
]);

export interface AgentSessionUserContentProjection {
  content: string;
  resources: AgentSessionItemResourceView[];
}

export interface AgentSessionUserContentProviderIdentity {
  engineId?: string | null;
  providerBindingId?: string | null;
  providerId?: string | null;
}

interface AgentSessionUserContentRecord {
  content?: string | null;
  contentType?: string;
  itemId: string;
  kind: string;
  providerId?: string | null;
}

interface CodexTextProjection extends AgentSessionUserContentProjection {
  handled: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function readNestedString(value: unknown, ...keys: string[]): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return readNonEmptyString(...keys.map((key) => value[key]));
}

function normalizeInputType(value: unknown): string | undefined {
  const type = readNonEmptyString(value);
  return type?.toLowerCase().replace(/[\s_-]+/gu, '');
}

function isCodexIdentityValue(value: unknown): boolean {
  const identity = readNonEmptyString(value)?.toLowerCase();
  return identity?.split(/[^a-z0-9]+/gu).includes('codex') === true;
}

function hasCodexProviderIdentity(
  item: AgentSessionUserContentRecord,
  providerIdentity: AgentSessionUserContentProviderIdentity | undefined,
): boolean {
  return [
    item.providerId,
    providerIdentity?.engineId,
    providerIdentity?.providerBindingId,
    providerIdentity?.providerId,
  ].some(isCodexIdentityValue);
}

function parseJsonContent(value: string): unknown {
  if (value.length > MAX_CODEX_USER_CONTENT_CHARACTERS) {
    return undefined;
  }
  const candidate = value.trim();
  if (!candidate || (!candidate.startsWith('{') && !candidate.startsWith('['))) {
    return undefined;
  }
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return undefined;
  }
}

function readArrayProperty(
  value: Record<string, unknown>,
  ...keys: string[]
): unknown[] | undefined {
  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }
  return undefined;
}

function appendLegacyMediaParts(
  parts: unknown[],
  values: readonly unknown[] | undefined,
  type: 'audio' | 'image' | 'localAudio' | 'localImage',
  locationKey: 'path' | 'url',
): void {
  values?.slice(0, MAX_CODEX_USER_CONTENT_PARTS - parts.length).forEach((value) => {
    if (typeof value === 'string') {
      parts.push({ type, [locationKey]: value });
      return;
    }
    if (isRecord(value)) {
      parts.push(normalizeInputType(value.type) ? value : { ...value, type });
    }
  });
}

function readLegacyCodexUserMessageParts(
  value: Record<string, unknown>,
): unknown[] | undefined {
  const parts: unknown[] = [];
  const message = readNonEmptyString(value.message);
  if (message) {
    parts.push({ type: 'text', text: message });
  }
  appendLegacyMediaParts(parts, readArrayProperty(value, 'images'), 'image', 'url');
  appendLegacyMediaParts(
    parts,
    readArrayProperty(value, 'localImages', 'local_images'),
    'localImage',
    'path',
  );
  appendLegacyMediaParts(parts, readArrayProperty(value, 'audio'), 'audio', 'url');
  appendLegacyMediaParts(
    parts,
    readArrayProperty(value, 'localAudio', 'local_audio'),
    'localAudio',
    'path',
  );
  return parts.length > 0 ? parts.slice(0, MAX_CODEX_USER_CONTENT_PARTS) : undefined;
}

function readCodexContentParts(value: unknown, depth = 0): unknown[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const content = value.content ?? value.items ?? value.inputs;
  if (Array.isArray(content)) {
    return content;
  }
  const legacyParts = readLegacyCodexUserMessageParts(value);
  if (legacyParts) {
    return legacyParts;
  }
  if (depth < 4) {
    for (const key of ['item', 'message', 'msg', 'params', 'payload', 'data']) {
      const nestedValue = value[key];
      if (!isRecord(nestedValue) && !Array.isArray(nestedValue)) {
        continue;
      }
      const nestedParts = readCodexContentParts(nestedValue, depth + 1);
      if (nestedParts) {
        return nestedParts;
      }
    }
  }
  return normalizeInputType(value.type) ? [value] : undefined;
}

function resolveDataMediaMimeType(value: string | undefined): string | undefined {
  return value?.match(/^data:([^;,]+);base64,/iu)?.[1]?.trim().toLowerCase();
}

function inferMimeTypeFromPath(value: string | undefined): string | undefined {
  const extension = value?.match(/\.([a-z0-9]+)(?:[?#].*)?$/iu)?.[1]?.toLowerCase();
  switch (extension) {
    case 'gif':
      return 'image/gif';
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'm4a':
      return 'audio/mp4';
    case 'mp3':
      return 'audio/mpeg';
    case 'oga':
    case 'ogg':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case 'pdf':
      return 'application/pdf';
    case 'json':
      return 'application/json';
    case 'md':
      return 'text/markdown';
    case 'txt':
      return 'text/plain';
    default:
      return undefined;
  }
}

function resolveLocationName(value: string | undefined, fallback: string): string {
  if (
    !value
    || value.length > MAX_CODEX_RESOURCE_LOCATION_CHARACTERS
    || /^(?:data|blob):/iu.test(value)
  ) {
    return fallback;
  }
  const withoutQuery = value.split(/[?#]/u, 1)[0] ?? value;
  const name = withoutQuery.split(/[\\/]/u).at(-1)?.trim();
  if (!name) {
    return fallback;
  }
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function isSafeLocalResourcePath(value: string): boolean {
  if (!value || value.length > MAX_CODEX_RESOURCE_LOCATION_CHARACTERS) {
    return false;
  }
  if (/^[a-z]:[\\/]/iu.test(value)) {
    return true;
  }
  return !/^[a-z][a-z0-9+.-]*:/iu.test(value);
}

function resolveMediaResource(
  input: Record<string, unknown>,
  id: string,
  kind: 'audio' | 'image',
  local: boolean,
): AgentSessionItemResourceView | undefined {
  const nestedSource = kind === 'image'
    ? input.image ?? input.imageUrl ?? input.image_url ?? input.source
    : input.audio ?? input.audioUrl ?? input.audio_url ?? input.source;
  const source = readNonEmptyString(
    input.url,
    kind === 'image' ? input.imageUrl : input.audioUrl,
    kind === 'image' ? input.image_url : input.audio_url,
    input.path,
    readNestedString(nestedSource, 'url', 'path', 'data'),
  );
  if (!source) {
    return undefined;
  }
  const isInlineMedia = /^(?:data|blob):/iu.test(source);
  const isExternalMedia = /^https?:/iu.test(source);
  const isDriveMedia = /^drive:\/\//iu.test(source);
  const isLocalPath = local || (!isInlineMedia && !isExternalMedia && !isDriveMedia);
  if (
    (isInlineMedia && source.length > MAX_CODEX_USER_CONTENT_CHARACTERS)
    || (!isInlineMedia && source.length > MAX_CODEX_RESOURCE_LOCATION_CHARACTERS)
    || (isLocalPath && !isSafeLocalResourcePath(source))
    || (!isLocalPath && !isInlineMedia && !isExternalMedia && !isDriveMedia)
  ) {
    return undefined;
  }
  const mimeType = readNonEmptyString(input.mimeType, input.mime_type)
    ?? readNestedString(nestedSource, 'mimeType', 'mime_type')
    ?? resolveDataMediaMimeType(source)
    ?? inferMimeTypeFromPath(source);
  const name = readNonEmptyString(input.name, input.fileName, input.file_name)
    ?? resolveLocationName(source, kind === 'image' ? 'Image' : 'Audio');
  return {
    id,
    kind,
    name,
    ...(isLocalPath
      ? { path: source }
      : isDriveMedia
        ? { uri: source }
        : { mediaSource: source }),
    ...(isExternalMedia ? { uri: source } : {}),
    ...(mimeType ? { mimeType } : {}),
  };
}

function resolveFileResource(
  input: Record<string, unknown>,
  id: string,
  kind: AgentSessionItemResourceView['kind'],
): AgentSessionItemResourceView | undefined {
  const location = readNonEmptyString(
    input.path,
    input.url,
    input.uri,
    input.filePath,
    input.file_path,
  );
  const name = readNonEmptyString(input.name, input.fileName, input.file_name)
    ?? resolveLocationName(location, kind === 'skill' ? 'Skill' : kind === 'mention' ? 'Mention' : 'Attachment');
  const mimeType = readNonEmptyString(input.mimeType, input.mime_type)
    ?? inferMimeTypeFromPath(location);
  if (!location && !name) {
    return undefined;
  }
  if (location && location.length > MAX_CODEX_RESOURCE_LOCATION_CHARACTERS) {
    return undefined;
  }
  const isExternalUri = location ? /^(?:https?):/iu.test(location) : false;
  const isDriveUri = location ? /^drive:\/\//iu.test(location) : false;
  const isLocalPath = location ? isSafeLocalResourcePath(location) : false;
  if (location && !isExternalUri && !isDriveUri && !isLocalPath) {
    return undefined;
  }
  return {
    id,
    kind,
    name,
    ...(location && (isExternalUri || isDriveUri) ? { uri: location } : {}),
    ...(location && isLocalPath ? { path: location } : {}),
    ...(mimeType ? { mimeType } : {}),
  };
}

function resolveCodexMentionedFileResource(
  name: string,
  path: string,
  id: string,
): AgentSessionItemResourceView | undefined {
  const mimeType = inferMimeTypeFromPath(path);
  if (mimeType?.startsWith('image/')) {
    return resolveMediaResource({ name, path, mimeType }, id, 'image', true);
  }
  if (mimeType?.startsWith('audio/')) {
    return resolveMediaResource({ name, path, mimeType }, id, 'audio', true);
  }
  return resolveFileResource({ name, path, mimeType }, id, 'file');
}

function resolveCodexMentionedFiles(
  context: string,
  itemId: string,
  textIndex: number,
): AgentSessionItemResourceView[] {
  const resources: AgentSessionItemResourceView[] = [];
  let foundHeader = false;
  let lineStart = 0;
  while (
    lineStart <= context.length
    && resources.length < MAX_AGENT_SESSION_ITEM_RESOURCES
  ) {
    const lineFeedIndex = context.indexOf('\n', lineStart);
    const lineEnd = lineFeedIndex < 0 ? context.length : lineFeedIndex;
    const contentEnd = lineEnd > lineStart && context.charCodeAt(lineEnd - 1) === 13
      ? lineEnd - 1
      : lineEnd;
    const lineLength = contentEnd - lineStart;
    if (lineLength <= MAX_CODEX_RESOURCE_LOCATION_CHARACTERS * 2) {
      const line = context.slice(lineStart, contentEnd).trim();
      if (!foundHeader) {
        foundHeader = line === CODEX_FILES_MENTIONED_HEADER;
      } else {
        const match = /^##[ \t]+(.+?):[ \t]+(.+?)[ \t]*$/u.exec(line);
        const name = match?.[1]?.trim();
        const path = match?.[2]?.trim();
        if (name && path) {
          const resource = resolveCodexMentionedFileResource(
            name,
            path,
            `${itemId}-input-${textIndex}-mentioned-${resources.length}`,
          );
          if (resource) {
            resources.push(resource);
          }
        }
      }
    }
    if (lineFeedIndex < 0) {
      break;
    }
    lineStart = lineFeedIndex + 1;
  }
  return resources;
}

function readCodexMediaTagAttribute(
  attributes: string,
  name: 'name' | 'path',
): string | undefined {
  const bracketMatch = name === 'name'
    ? /(?:^|\s)name=\[([^\]]+)\]/iu.exec(attributes)
    : null;
  return readNonEmptyString(
    bracketMatch?.[1],
    new RegExp(`(?:^|\\s)${name}="([^"]+)"`, 'iu').exec(attributes)?.[1],
    new RegExp(`(?:^|\\s)${name}='([^']+)'`, 'iu').exec(attributes)?.[1],
    new RegExp(`(?:^|\\s)${name}=([^\\s>]+)`, 'iu').exec(attributes)?.[1],
  );
}

function resolveCodexMediaPlaceholder(
  text: string,
  itemId: string,
  textIndex: number,
): CodexTextProjection | undefined {
  if (/^<\/(?:audio|image)>$/iu.test(text)) {
    return { content: '', handled: true, resources: [] };
  }
  const match = /^<(audio|image)\b([^>]*)>$/iu.exec(text);
  if (!match) {
    return undefined;
  }
  const kind = match[1]?.toLowerCase() as 'audio' | 'image';
  const attributes = match[2] ?? '';
  const path = readCodexMediaTagAttribute(attributes, 'path');
  if (!path) {
    return { content: '', handled: true, resources: [] };
  }
  const name = readCodexMediaTagAttribute(attributes, 'name')
    ?? resolveLocationName(path, kind === 'image' ? 'Image' : 'Audio');
  const resource = resolveMediaResource(
    { name, path },
    `${itemId}-input-${textIndex}${CODEX_MEDIA_PLACEHOLDER_ID_SEGMENT}0`,
    kind,
    true,
  );
  return {
    content: '',
    handled: true,
    resources: resource ? [resource] : [],
  };
}

function resolveCodexTextProjection(
  value: string,
  itemId: string,
  textIndex: number,
): CodexTextProjection {
  const text = value.trim();
  const mediaPlaceholder = resolveCodexMediaPlaceholder(text, itemId, textIndex);
  if (mediaPlaceholder) {
    return mediaPlaceholder;
  }

  const requestMarkerIndex = text.lastIndexOf(CODEX_USER_REQUEST_MARKER);
  if (requestMarkerIndex < 0) {
    return { content: text, handled: false, resources: [] };
  }
  const context = text.slice(0, requestMarkerIndex);
  return {
    content: text.slice(requestMarkerIndex + CODEX_USER_REQUEST_MARKER.length).trim(),
    handled: true,
    resources: resolveCodexMentionedFiles(context, itemId, textIndex),
  };
}

function isCodexMediaPlaceholderResource(
  resource: AgentSessionItemResourceView,
): boolean {
  return resource.id.includes(CODEX_MEDIA_PLACEHOLDER_ID_SEGMENT);
}

function hasSameCodexResourceLocation(
  left: AgentSessionItemResourceView,
  right: AgentSessionItemResourceView,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.path && right.path && left.path.toLowerCase() === right.path.toLowerCase()) {
    return true;
  }
  if (left.uri && right.uri && left.uri === right.uri) {
    return true;
  }
  return Boolean(
    left.mediaSource
    && right.mediaSource
    && left.mediaSource === right.mediaSource,
  );
}

function mergeCodexResources(
  left: AgentSessionItemResourceView,
  right: AgentSessionItemResourceView,
): AgentSessionItemResourceView {
  const path = left.path ?? right.path;
  const fallbackName = left.name ?? right.name;
  const pathName = path ? resolveLocationName(path, fallbackName ?? '') : undefined;
  return {
    id: isCodexMediaPlaceholderResource(left)
      ? left.id
      : isCodexMediaPlaceholderResource(right)
        ? right.id
        : left.id,
    kind: left.kind,
    ...(pathName || fallbackName ? { name: pathName || fallbackName } : {}),
    ...(path ? { path } : {}),
    ...(left.uri ?? right.uri ? { uri: left.uri ?? right.uri } : {}),
    ...(left.mediaSource ?? right.mediaSource
      ? { mediaSource: left.mediaSource ?? right.mediaSource }
      : {}),
    ...(left.mimeType ?? right.mimeType ? { mimeType: left.mimeType ?? right.mimeType } : {}),
    ...(left.description ?? right.description
      ? { description: left.description ?? right.description }
      : {}),
    ...(left.origin ?? right.origin ? { origin: left.origin ?? right.origin } : {}),
    ...(left.citation ?? right.citation ? { citation: left.citation ?? right.citation } : {}),
  };
}

export function coalesceCodexUserContentResources(
  values: readonly AgentSessionItemResourceView[],
): AgentSessionItemResourceView[] {
  const resources: AgentSessionItemResourceView[] = [];
  values.slice(0, MAX_AGENT_SESSION_ITEM_RESOURCES).forEach((resource) => {
    const matchingIndex = resources.findIndex((candidate) => (
      hasSameCodexResourceLocation(candidate, resource)
    ));
    if (matchingIndex < 0) {
      resources.push(resource);
      return;
    }
    resources[matchingIndex] = mergeCodexResources(resources[matchingIndex]!, resource);
  });

  const consumedIndexes = new Set<number>();
  resources.forEach((resource, resourceIndex) => {
    if (
      !isCodexMediaPlaceholderResource(resource)
      || (resource.kind !== 'audio' && resource.kind !== 'image')
      || !resource.path
      || resource.mediaSource
    ) {
      return;
    }
    const encodedIndex = resources.findIndex((candidate, candidateIndex) => (
      candidateIndex !== resourceIndex
      && !consumedIndexes.has(candidateIndex)
      && candidate.kind === resource.kind
      && Boolean(candidate.mediaSource)
      && !candidate.path
    ));
    if (encodedIndex < 0) {
      return;
    }
    resources[resourceIndex] = mergeCodexResources(resource, resources[encodedIndex]!);
    consumedIndexes.add(encodedIndex);
  });
  return resources.filter((_, index) => !consumedIndexes.has(index));
}

function resolveCodexInputResource(
  value: unknown,
  itemId: string,
  index: number,
): AgentSessionItemResourceView | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const type = normalizeInputType(value.type);
  const id = `${itemId}-input-${index}`;
  if (type && CODEX_IMAGE_INPUT_TYPES.has(type)) {
    return resolveMediaResource(value, id, 'image', false);
  }
  if (type && CODEX_LOCAL_IMAGE_INPUT_TYPES.has(type)) {
    return resolveMediaResource(value, id, 'image', true);
  }
  if (type && CODEX_AUDIO_INPUT_TYPES.has(type)) {
    return resolveMediaResource(value, id, 'audio', false);
  }
  if (type && CODEX_LOCAL_AUDIO_INPUT_TYPES.has(type)) {
    return resolveMediaResource(value, id, 'audio', true);
  }
  if (type && CODEX_FILE_INPUT_TYPES.has(type)) {
    return resolveFileResource(value, id, 'file');
  }
  if (type === 'skill' || type === 'mention') {
    return resolveFileResource(value, id, type);
  }
  return undefined;
}

function resolveCodexArtifactFallback(
  item: AgentSessionUserContentRecord,
): AgentSessionItemResourceView | undefined {
  const content = item.content?.trim();
  if (!content) {
    return undefined;
  }
  const mimeType = item.contentType?.trim().toLowerCase();
  const id = `${item.itemId}-input-0`;
  if (mimeType?.startsWith('image/')) {
    return resolveMediaResource({ url: content, mimeType }, id, 'image', false);
  }
  if (mimeType?.startsWith('audio/')) {
    return resolveMediaResource({ url: content, mimeType }, id, 'audio', false);
  }
  if (mimeType && mimeType !== 'application/json') {
    return resolveFileResource({ path: content, mimeType }, id, 'file');
  }
  return undefined;
}

export function resolveAgentSessionUserContent(
  item: AgentSessionUserContentRecord,
  providerIdentity?: AgentSessionUserContentProviderIdentity,
): AgentSessionUserContentProjection | null {
  if (
    !hasCodexProviderIdentity(item, providerIdentity)
    || (item.kind !== 'user_input' && item.kind !== 'artifact_reference')
  ) {
    return null;
  }

  const untrimmedContent = item.content ?? '';
  const rawContent = untrimmedContent.length > MAX_CODEX_USER_CONTENT_CHARACTERS
    ? untrimmedContent.slice(0, MAX_CODEX_USER_CONTENT_CHARACTERS)
    : untrimmedContent.trim();
  const parsedContent = parseJsonContent(rawContent);
  const parts = readCodexContentParts(parsedContent);
  if (!parts) {
    if (item.kind === 'user_input') {
      const projection = resolveCodexTextProjection(rawContent, item.itemId, 0);
      return { content: projection.content, resources: projection.resources };
    }
    const projection = resolveCodexTextProjection(rawContent, item.itemId, 0);
    if (projection.handled) {
      return { content: projection.content, resources: projection.resources };
    }
    const resource = resolveCodexArtifactFallback(item);
    return resource ? { content: '', resources: [resource] } : null;
  }

  const textSegments: string[] = [];
  const resources: AgentSessionItemResourceView[] = [];
  parts.slice(0, MAX_CODEX_USER_CONTENT_PARTS).forEach((part, index) => {
    if (!isRecord(part)) {
      return;
    }
    const type = normalizeInputType(part.type);
    if (type && CODEX_TEXT_INPUT_TYPES.has(type)) {
      const text = readNonEmptyString(part.text, part.content);
      if (text) {
        const projection = resolveCodexTextProjection(text, item.itemId, index);
        if (projection.content) {
          textSegments.push(projection.content);
        }
        resources.push(...projection.resources.slice(
          0,
          Math.max(0, MAX_AGENT_SESSION_ITEM_RESOURCES - resources.length),
        ));
      }
      return;
    }
    const resource = resolveCodexInputResource(part, item.itemId, index);
    if (resource && resources.length < MAX_AGENT_SESSION_ITEM_RESOURCES) {
      resources.push(resource);
    }
  });

  if (textSegments.length === 0 && resources.length === 0) {
    return item.kind === 'user_input'
      ? { content: rawContent, resources: [] }
      : null;
  }
  return {
    content: textSegments.join('\n'),
    resources: coalesceCodexUserContentResources(resources),
  };
}
