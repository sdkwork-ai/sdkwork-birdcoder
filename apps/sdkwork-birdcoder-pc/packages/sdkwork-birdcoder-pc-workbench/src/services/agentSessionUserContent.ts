import type { AgentSessionItemResourceView } from '@sdkwork/birdcoder-pc-contracts-commons';

const MAX_CODEX_USER_CONTENT_CHARACTERS = 4 * 1_024 * 1_024;

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
]);

export interface AgentSessionUserContentProjection {
  content: string;
  resources: AgentSessionItemResourceView[];
}

interface AgentSessionUserContentRecord {
  content?: string | null;
  contentType?: string;
  itemId: string;
  kind: string;
  providerId?: string | null;
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

function isCodexProviderId(value: unknown): boolean {
  const providerId = readNonEmptyString(value)?.toLowerCase();
  return providerId === 'codex' || providerId?.endsWith('.codex') === true;
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

function readCodexContentParts(value: unknown): unknown[] | undefined {
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
  if (!value || /^(?:data|blob):/iu.test(value)) {
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

function resolveMediaResource(
  input: Record<string, unknown>,
  id: string,
  kind: 'audio' | 'image',
  local: boolean,
): AgentSessionItemResourceView | undefined {
  const nestedSource = kind === 'image'
    ? input.image ?? input.source
    : input.audio ?? input.source;
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
  const mimeType = readNonEmptyString(input.mimeType, input.mime_type)
    ?? readNestedString(nestedSource, 'mimeType', 'mime_type')
    ?? resolveDataMediaMimeType(source)
    ?? inferMimeTypeFromPath(source);
  const name = readNonEmptyString(input.name, input.fileName, input.file_name)
    ?? resolveLocationName(source, kind === 'image' ? 'Image' : 'Audio');
  const isLocalPath = local || !/^(?:data|blob|https?):/iu.test(source);
  return {
    id,
    kind,
    name,
    ...(isLocalPath ? { path: source } : { mediaSource: source }),
    ...(!isLocalPath && /^https?:/iu.test(source) ? { uri: source } : {}),
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
  const isExternalUri = location ? /^(?:https?):/iu.test(location) : false;
  return {
    id,
    kind,
    name,
    ...(location && isExternalUri ? { uri: location } : {}),
    ...(location && !isExternalUri ? { path: location } : {}),
    ...(mimeType ? { mimeType } : {}),
  };
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
): AgentSessionUserContentProjection | null {
  if (
    !isCodexProviderId(item.providerId)
    || (item.kind !== 'user_input' && item.kind !== 'artifact_reference')
  ) {
    return null;
  }

  const rawContent = item.content?.trim() ?? '';
  const parsedContent = parseJsonContent(rawContent);
  const parts = readCodexContentParts(parsedContent);
  if (!parts) {
    if (item.kind === 'user_input') {
      return { content: rawContent, resources: [] };
    }
    const resource = resolveCodexArtifactFallback(item);
    return resource ? { content: '', resources: [resource] } : null;
  }

  const textSegments: string[] = [];
  const resources: AgentSessionItemResourceView[] = [];
  parts.forEach((part, index) => {
    if (!isRecord(part)) {
      return;
    }
    const type = normalizeInputType(part.type);
    if (type && CODEX_TEXT_INPUT_TYPES.has(type)) {
      const text = readNonEmptyString(part.text, part.content);
      if (text) {
        textSegments.push(text);
      }
      return;
    }
    const resource = resolveCodexInputResource(part, item.itemId, index);
    if (resource) {
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
    resources,
  };
}
