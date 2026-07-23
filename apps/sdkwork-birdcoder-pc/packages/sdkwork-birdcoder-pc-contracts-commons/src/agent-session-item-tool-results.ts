import type {
  AgentSessionItemToolCallStatus as AgentSessionItemToolCallStatus,
  AgentSessionItemToolResultBlockView as AgentSessionItemToolResultBlockView,
} from './agent-session-view.ts';
import {
  BIRDCODER_AGENT_SESSION_ITEM_MAX_EXTERNAL_MEDIA_SOURCE_CHARACTERS,
  BIRDCODER_AGENT_SESSION_ITEM_MAX_MEDIA_SOURCE_CHARACTERS,
  buildAgentSessionItemDataMediaSource,
  parseAgentSessionItemDataMediaSource,
  type AgentSessionItemMediaKind,
} from './agent-session-item-media.ts';

const MAX_TOOL_RESULT_BLOCKS = 200;
const MAX_TOOL_RESULT_DEPTH = 16;
const MAX_TOOL_RESULT_LIST_ITEMS = 200;
const MAX_TOOL_RESULT_LIST_ITEM_LENGTH = 2_000;
const STRUCTURED_RESULT_PROTOCOL_KEYS = new Set([
  '_meta',
  'callId',
  'call_id',
  'id',
  'isError',
  'is_error',
  'status',
  'toolCallId',
  'toolUseId',
  'tool_call_id',
  'tool_use_id',
  'type',
]);

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readBoundedMediaSource(
  value: unknown,
  expectedKind?: AgentSessionItemMediaKind,
  expectedMimeType?: string,
): string {
  if (typeof value !== 'string') {
    return '';
  }
  const source = value.trim();
  if (
    value.length === 0
    || value.length > BIRDCODER_AGENT_SESSION_ITEM_MAX_MEDIA_SOURCE_CHARACTERS
    || source.length === 0
    || source.length > BIRDCODER_AGENT_SESSION_ITEM_MAX_MEDIA_SOURCE_CHARACTERS
  ) {
    return '';
  }
  if (/^data:/iu.test(source)) {
    return parseAgentSessionItemDataMediaSource(
      source,
      expectedKind,
      expectedMimeType,
    )?.source ?? '';
  }
  if (!/^https?:\/\//iu.test(source) && !/^blob:/iu.test(source)) {
    return '';
  }
  return source.length <= BIRDCODER_AGENT_SESSION_ITEM_MAX_EXTERNAL_MEDIA_SOURCE_CHARACTERS
    ? source
    : '';
}

function buildBoundedDataMediaSource(
  data: string,
  mimeType: string,
): string {
  return buildAgentSessionItemDataMediaSource(data, mimeType) ?? '';
}

function readFirstString(
  record: Record<string, unknown> | null,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = readString(record?.[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeType(value: unknown): string {
  return readString(value)
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .toLowerCase()
    .replace(/[.\s-]+/gu, '_');
}

function isTrueProtocolFlag(value: unknown): boolean {
  return value === true
    || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

export function hasAgentSessionItemToolErrorValue(value: unknown): boolean {
  if (value === undefined || value === null || value === false) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0;
  }
  if (Array.isArray(value)) {
    return value.some(hasAgentSessionItemToolErrorValue);
  }
  if (value instanceof Error) {
    return Boolean(value.message.trim() || value.name.trim());
  }
  const record = readRecord(value);
  return record ? Object.keys(record).length > 0 : true;
}

function formatToolResultValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) {
    return '';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function readAnsiOutputText(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    return '';
  }

  const lines: string[] = [];
  for (const line of value) {
    if (!Array.isArray(line)) {
      return '';
    }
    const tokens: string[] = [];
    for (const token of line) {
      const tokenRecord = readRecord(token);
      if (
        !tokenRecord
        || typeof tokenRecord.text !== 'string'
        || !(
          'bold' in tokenRecord
          || 'fg' in tokenRecord
          || 'bg' in tokenRecord
          || 'isUninitialized' in tokenRecord
        )
      ) {
        return '';
      }
      tokens.push(tokenRecord.text);
    }
    lines.push(tokens.join(''));
  }
  return lines.join('\n').trimEnd();
}

function appendStructuredResultList(
  blocks: AgentSessionItemToolResultBlockView[],
  items: string[],
  totalItems: number,
): void {
  const visibleItems = items
    .map((item) => item.trimEnd())
    .filter((item) => item.trim())
    .map(truncateStructuredResultItem)
    .slice(0, MAX_TOOL_RESULT_LIST_ITEMS);
  if (visibleItems.length === 0) {
    return;
  }
  blocks.push({
    type: 'list',
    items: visibleItems,
    ...(totalItems > visibleItems.length ? { totalItems } : {}),
  });
}

function truncateStructuredResultItem(value: string): string {
  return value.length > MAX_TOOL_RESULT_LIST_ITEM_LENGTH
    ? `${value.slice(0, MAX_TOOL_RESULT_LIST_ITEM_LENGTH)}...`
    : value;
}

function collectStructuredResultItems(
  value: unknown,
  path: string,
  items: string[],
  visited: WeakSet<object>,
  depth = 0,
): void {
  if (
    value === undefined
    || value === null
    || items.length >= MAX_TOOL_RESULT_LIST_ITEMS
    || depth >= 4
  ) {
    return;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    if (text && path) {
      items.push(truncateStructuredResultItem(`${path}: ${text}`));
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length && items.length < MAX_TOOL_RESULT_LIST_ITEMS; index += 1) {
      collectStructuredResultItems(value[index], `${path}[${index}]`, items, visited, depth + 1);
    }
    return;
  }
  const record = readRecord(value);
  if (!record || visited.has(record)) {
    return;
  }
  visited.add(record);
  for (const [key, entry] of Object.entries(record)) {
    if (depth === 0 && STRUCTURED_RESULT_PROTOCOL_KEYS.has(key)) {
      continue;
    }
    collectStructuredResultItems(
      entry,
      path ? `${path}.${key}` : key,
      items,
      visited,
      depth + 1,
    );
    if (items.length >= MAX_TOOL_RESULT_LIST_ITEMS) {
      break;
    }
  }
}

function appendFlattenedStructuredResult(
  record: Record<string, unknown>,
  blocks: AgentSessionItemToolResultBlockView[],
): boolean {
  const items: string[] = [];
  collectStructuredResultItems(record, '', items, new WeakSet<object>());
  if (items.length === 0) {
    return false;
  }
  appendStructuredResultList(blocks, items, items.length);
  return true;
}

function projectStructuredToolResultDisplay(
  record: Record<string, unknown>,
  blocks: AgentSessionItemToolResultBlockView[],
): boolean {
  const fileDiff = typeof record.fileDiff === 'string' ? record.fileDiff : '';
  if (fileDiff.trim()) {
    const path = readFirstString(record, ['filePath', 'fileName']);
    blocks.push({
      type: 'diff',
      content: fileDiff,
      ...(path ? { path } : {}),
    });
    return true;
  }

  if (Array.isArray(record.todos)) {
    const items = record.todos.flatMap((todo) => {
      const todoRecord = readRecord(todo);
      const description = readString(todoRecord?.description);
      if (!description) {
        return [];
      }
      const status = normalizeType(todoRecord?.status);
      const marker = status === 'completed'
        ? 'x'
        : status === 'in_progress'
          ? '~'
          : status === 'cancelled'
            ? '-'
            : status === 'blocked'
              ? '!'
              : ' ';
      return [`[${marker}] ${description}`];
    });
    appendStructuredResultList(blocks, items, record.todos.length);
    return true;
  }

  if (Array.isArray(record.matches)) {
    const summary = readString(record.summary);
    if (summary) {
      blocks.push({ type: 'text', text: summary });
    }
    const items = record.matches.flatMap((match) => {
      const matchRecord = readRecord(match);
      const path = readFirstString(matchRecord, ['filePath', 'path']);
      const line = typeof matchRecord?.line === 'string' ? matchRecord.line.trimEnd() : '';
      const lineNumber = readFiniteNumber(matchRecord?.lineNumber);
      if (!path && !line) {
        return [];
      }
      const location = path
        ? `${path}${lineNumber !== undefined ? `:${Math.max(0, Math.floor(lineNumber))}` : ''}`
        : '';
      return [`${location}${location && line ? ': ' : ''}${line}`];
    });
    appendStructuredResultList(blocks, items, record.matches.length);
    return true;
  }

  if (Array.isArray(record.files)) {
    const summary = readString(record.summary);
    if (summary) {
      blocks.push({ type: 'text', text: summary });
    }
    const items = record.files.filter((item): item is string => typeof item === 'string');
    if (Array.isArray(record.skipped)) {
      for (const skipped of record.skipped) {
        const skippedRecord = readRecord(skipped);
        const path = readFirstString(skippedRecord, ['path', 'filePath']);
        const reason = readString(skippedRecord?.reason);
        if (path) {
          items.push(`${path}${reason ? ` (${reason})` : ''}`);
        }
      }
    }
    const skippedCount = Array.isArray(record.skipped) ? record.skipped.length : 0;
    appendStructuredResultList(blocks, items, record.files.length + skippedCount);
    return true;
  }

  if (record.isSubagentProgress === true) {
    const result = readString(record.result);
    if (result) {
      blocks.push({ type: 'text', text: result });
    }
    const recentActivity = Array.isArray(record.recentActivity) ? record.recentActivity : [];
    const items = recentActivity.flatMap((activity) => {
      const activityRecord = readRecord(activity);
      const label = readFirstString(activityRecord, ['displayName', 'description', 'content']);
      if (!label) {
        return [];
      }
      const status = readString(activityRecord?.status);
      return [`${status ? `[${status}] ` : ''}${label}`];
    });
    appendStructuredResultList(blocks, items, recentActivity.length);
    if (!result && items.length === 0) {
      const agentName = readString(record.agentName);
      const state = readString(record.state);
      const summary = [agentName, state].filter(Boolean).join(': ');
      if (summary) {
        blocks.push({ type: 'text', text: summary });
      }
    }
    return true;
  }

  return false;
}

export function hasStructuredAgentSessionItemToolError(
  value: unknown,
  visited = new WeakSet<object>(),
  depth = 0,
): boolean {
  if (depth >= MAX_TOOL_RESULT_DEPTH) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((entry) =>
      hasStructuredAgentSessionItemToolError(entry, visited, depth + 1),
    );
  }
  const record = readRecord(value);
  if (!record || visited.has(record)) {
    return false;
  }
  visited.add(record);
  const type = normalizeType(record.type);
  if (
    isTrueProtocolFlag(record.is_error)
    || isTrueProtocolFlag(record.isError)
    || hasAgentSessionItemToolErrorValue(record.error)
    || type === 'error'
    || type.endsWith('_error')
  ) {
    return true;
  }
  return [
    'content',
    'data',
    'functionResponse',
    'liveOutput',
    'output',
    'parts',
    'response',
    'responseParts',
    'result',
    'resultDisplay',
    'structuredContent',
    'structured_content',
  ].some((key) =>
    hasStructuredAgentSessionItemToolError(record[key], visited, depth + 1),
  );
}

function normalizeCanonicalResultBlock(
  value: unknown,
): AgentSessionItemToolResultBlockView | null {
  const record = readRecord(value);
  const type = normalizeType(record?.type);
  if (!record || !type) {
    return null;
  }

  if (type === 'text') {
    return typeof record.text === 'string' && record.text.trim()
      ? { type: 'text', text: record.text }
      : null;
  }
  if (type === 'error') {
    return typeof record.message === 'string' && record.message.trim()
      ? { type: 'error', message: record.message }
      : null;
  }
  if (type === 'image' || type === 'audio') {
    const mimeType = readString(record.mimeType);
    const source = readBoundedMediaSource(
      record.source,
      type,
      mimeType || undefined,
    );
    if (!source) {
      return null;
    }
    const title = readString(record.title);
    return {
      type,
      source,
      ...(mimeType ? { mimeType } : {}),
      ...(title ? { title } : {}),
    };
  }
  if (type === 'resource') {
    const uri = readString(record.uri);
    const name = readString(record.name);
    const mimeType = readString(record.mimeType);
    const text = typeof record.text === 'string' && record.text.trim() ? record.text : '';
    const description = readString(record.description);
    const size = readFiniteNumber(record.size);
    if (!uri && !name && !mimeType && !text && !description && size === undefined) {
      return null;
    }
    return {
      type: 'resource',
      ...(uri ? { uri } : {}),
      ...(name ? { name } : {}),
      ...(mimeType ? { mimeType } : {}),
      ...(text ? { text } : {}),
      ...(description ? { description } : {}),
      ...(size !== undefined && size >= 0 ? { size } : {}),
    };
  }
  if (type === 'link') {
    const url = readString(record.url);
    if (!url) {
      return null;
    }
    const title = readString(record.title);
    const description = readString(record.description);
    return {
      type: 'link',
      url,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    };
  }
  if (type === 'diff') {
    return typeof record.content === 'string' && record.content.trim()
      ? {
          type: 'diff',
          content: record.content,
          ...(readString(record.path) ? { path: readString(record.path) } : {}),
        }
      : null;
  }
  if (type === 'list' && Array.isArray(record.items)) {
    const items = record.items
      .filter((item): item is string => typeof item === 'string')
      .slice(0, MAX_TOOL_RESULT_LIST_ITEMS);
    if (items.length === 0) {
      return null;
    }
    const declaredTotal = readFiniteNumber(record.totalItems);
    const totalItems = declaredTotal === undefined
      ? record.items.length
      : Math.max(items.length, Math.floor(declaredTotal));
    return {
      type: 'list',
      items,
      ...(totalItems > items.length ? { totalItems } : {}),
    };
  }
  return null;
}

function readToolResultErrorMessage(
  value: unknown,
  visited = new WeakSet<object>(),
  depth = 0,
): string {
  if (depth >= MAX_TOOL_RESULT_DEPTH) {
    return '';
  }
  const directMessage = readString(value);
  if (directMessage) {
    return directMessage;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => readToolResultErrorMessage(entry, visited, depth + 1))
      .filter(Boolean)
      .join('\n');
  }
  const record = readRecord(value);
  if (!record || visited.has(record)) {
    return '';
  }
  visited.add(record);
  const type = normalizeType(record.type);
  if (
    type === 'audio'
    || type === 'file'
    || type === 'image'
    || type === 'input_audio'
    || type === 'input_image'
    || type === 'resource'
    || type === 'resource_link'
  ) {
    return '';
  }
  const directRecordMessage = readFirstString(
    record,
    ['message', 'error', 'detail', 'reason', 'error_code', 'text'],
  );
  if (directRecordMessage) {
    return directRecordMessage;
  }
  for (const key of [
    'content',
    'data',
    'functionResponse',
    'liveOutput',
    'output',
    'parts',
    'response',
    'responseParts',
    'result',
    'resultDisplay',
    'structuredContent',
    'structured_content',
  ]) {
    if (!(key in record)) {
      continue;
    }
    const nestedMessage = readToolResultErrorMessage(record[key], visited, depth + 1);
    if (nestedMessage) {
      return nestedMessage;
    }
  }
  return depth === 0 ? formatToolResultValue(value) : '';
}

function resolveMedia(
  record: Record<string, unknown>,
): { mimeType?: string; source: string } | null {
  const type = normalizeType(record.type);
  const nestedSource = readRecord(record.source);
  const inlineData = readRecord(record.inlineData);
  const fileData = readRecord(record.fileData);
  const mimeType = readFirstString(record, ['mimeType', 'mime_type', 'mediaType', 'media_type', 'mime'])
    || readFirstString(nestedSource, ['mimeType', 'mime_type', 'mediaType', 'media_type', 'mime'])
    || readFirstString(inlineData, ['mimeType', 'mime_type'])
    || readFirstString(fileData, ['mimeType', 'mime_type']);
  const expectedKind: AgentSessionItemMediaKind | undefined =
    mimeType.toLowerCase().startsWith('image/') || type.includes('image')
      ? 'image'
      : mimeType.toLowerCase().startsWith('audio/') || type.includes('audio')
        ? 'audio'
        : undefined;
  const externalSource = readFirstString(record, [
    'url',
    'uri',
    'fileUri',
    'file_uri',
    'imageUrl',
    'image_url',
    'audioUrl',
    'audio_url',
  ])
    || readFirstString(nestedSource, ['url', 'uri', 'fileUri', 'file_uri'])
    || readFirstString(fileData, ['url', 'uri', 'fileUri', 'file_uri']);
  const boundedExternalSource = readBoundedMediaSource(
    externalSource,
    expectedKind,
    mimeType || undefined,
  );
  if (boundedExternalSource) {
    const inferredMimeType = /^data:([^;,]+)/iu.exec(boundedExternalSource)?.[1];
    return {
      ...(mimeType || inferredMimeType ? { mimeType: mimeType || inferredMimeType } : {}),
      source: boundedExternalSource,
    };
  }
  const data = readFirstString(record, ['data', 'base64'])
    || readFirstString(nestedSource, ['data', 'base64'])
    || readFirstString(inlineData, ['data', 'base64']);
  if (!data) {
    return null;
  }
  if (/^(?:data:|https?:|blob:)/iu.test(data)) {
    const source = readBoundedMediaSource(data, expectedKind, mimeType || undefined);
    return source ? { ...(mimeType ? { mimeType } : {}), source } : null;
  }
  const source = buildBoundedDataMediaSource(data, mimeType);
  if (!source) {
    return null;
  }
  return {
    ...(mimeType ? { mimeType } : {}),
    source,
  };
}

function appendMediaOrResourceBlock(
  record: Record<string, unknown>,
  blocks: AgentSessionItemToolResultBlockView[],
): boolean {
  const type = normalizeType(record.type);
  const title = readFirstString(record, ['title', 'name', 'filename', 'alt']);
  const media = resolveMedia(record);
  if (!media) {
    if (type === 'document' || type === 'file') {
      const nestedSource = readRecord(record.source);
      const mimeType = readFirstString(
        record,
        ['mimeType', 'mime_type', 'mediaType', 'media_type', 'mime'],
      ) || readFirstString(
        nestedSource,
        ['mimeType', 'mime_type', 'mediaType', 'media_type', 'mime'],
      );
      if (title || mimeType) {
        blocks.push({
          type: 'resource',
          ...(title ? { name: title } : {}),
          ...(mimeType ? { mimeType } : {}),
        });
        return true;
      }
    }
    return false;
  }
  if (media.mimeType?.toLowerCase().startsWith('image/') || type.includes('image')) {
    blocks.push({ type: 'image', ...media, ...(title ? { title } : {}) });
    return true;
  }
  if (media.mimeType?.toLowerCase().startsWith('audio/') || type.includes('audio')) {
    blocks.push({ type: 'audio', ...media, ...(title ? { title } : {}) });
    return true;
  }
  const resourceUri = /^(?:blob|data):/iu.test(media.source) ? '' : media.source;
  const resourceName = title || (type === 'document' ? 'Document' : '');
  blocks.push({
    type: 'resource',
    ...(resourceUri ? { uri: resourceUri } : {}),
    ...(resourceName ? { name: resourceName } : {}),
    ...(media.mimeType ? { mimeType: media.mimeType } : {}),
  });
  return true;
}

function normalizeToolResultValue(
  value: unknown,
  blocks: AgentSessionItemToolResultBlockView[],
  visited: WeakSet<object>,
  depth = 0,
): void {
  if (
    value === undefined
    || value === null
    || blocks.length >= MAX_TOOL_RESULT_BLOCKS
    || depth >= MAX_TOOL_RESULT_DEPTH
  ) {
    return;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    if (text) {
      blocks.push({ type: 'text', text });
    }
    return;
  }
  if (Array.isArray(value)) {
    const ansiOutput = readAnsiOutputText(value);
    if (ansiOutput.trim()) {
      blocks.push({ type: 'text', text: ansiOutput });
      return;
    }
    const primitiveItems = value.length > 1 && value.every((entry) =>
      ['string', 'number', 'boolean'].includes(typeof entry),
    );
    if (primitiveItems) {
      const items = value.slice(0, MAX_TOOL_RESULT_LIST_ITEMS).map(String);
      blocks.push({
        type: 'list',
        items,
        ...(value.length > items.length ? { totalItems: value.length } : {}),
      });
      return;
    }
    for (const entry of value) {
      normalizeToolResultValue(entry, blocks, visited, depth + 1);
      if (blocks.length >= MAX_TOOL_RESULT_BLOCKS) {
        break;
      }
    }
    return;
  }
  const record = readRecord(value);
  if (!record || visited.has(record)) {
    return;
  }

  visited.add(record);
  const type = normalizeType(record.type);
  if (
    type === 'error'
    || type.endsWith('_error')
    || isTrueProtocolFlag(record.is_error)
    || isTrueProtocolFlag(record.isError)
  ) {
    blocks.push({ type: 'error', message: readToolResultErrorMessage(record) });
    return;
  }
  const hasEmbeddedError = hasAgentSessionItemToolErrorValue(record.error);
  if (hasEmbeddedError) {
    blocks.push({ type: 'error', message: readToolResultErrorMessage(record.error) });
  }
  if (type.includes('redacted_result')) {
    return;
  }
  if (
    type === 'image'
    || type === 'audio'
    || type === 'document'
    || type === 'file'
    || type === 'input_audio'
    || type === 'input_image'
    || type === 'media'
    || readRecord(record.inlineData)
    || readRecord(record.fileData)
  ) {
    appendMediaOrResourceBlock(record, blocks);
    return;
  }
  if (type === 'resource' || type === 'resource_link' || readRecord(record.resource)) {
    const resource = readRecord(record.resource) ?? record;
    const uri = readFirstString(resource, ['uri', 'url']);
    if (!uri && appendMediaOrResourceBlock(resource, blocks)) {
      return;
    }
    if (uri) {
      const name = readFirstString(resource, ['name', 'title']);
      const mimeType = readFirstString(resource, ['mimeType', 'mime_type']);
      const blob = readString(resource.blob);
      if (blob && mimeType.toLowerCase().startsWith('image/')) {
        const source = /^(?:blob:|data:|https?:)/iu.test(blob)
          ? readBoundedMediaSource(blob, 'image', mimeType)
          : buildBoundedDataMediaSource(blob, mimeType);
        if (!source) {
          return;
        }
        blocks.push({
          type: 'image',
          source,
          mimeType,
          ...(name ? { title: name } : {}),
        });
        return;
      }
      if (blob && mimeType.toLowerCase().startsWith('audio/')) {
        const source = /^(?:blob:|data:|https?:)/iu.test(blob)
          ? readBoundedMediaSource(blob, 'audio', mimeType)
          : buildBoundedDataMediaSource(blob, mimeType);
        if (!source) {
          return;
        }
        blocks.push({
          type: 'audio',
          source,
          mimeType,
          ...(name ? { title: name } : {}),
        });
        return;
      }
      const text = readString(resource.text);
      const description = readFirstString(resource, ['description', 'snippet']);
      const size = readFiniteNumber(resource.size);
      blocks.push({
        type: 'resource',
        ...(!/^(?:blob|data):/iu.test(uri) ? { uri } : {}),
        ...(name ? { name } : {}),
        ...(mimeType ? { mimeType } : {}),
        ...(text ? { text: resource.text as string } : {}),
        ...(description ? { description } : {}),
        ...(size !== undefined && size >= 0 ? { size } : {}),
      });
      return;
    }
  }
  const url = readFirstString(record, ['url', 'href']);
  if (type === 'link' || url) {
    if (url) {
      const title = readFirstString(record, ['title', 'name']);
      const description = readFirstString(record, ['description', 'snippet']);
      blocks.push({
        type: 'link',
        url,
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
      });
      return;
    }
  }
  const diff = readString(record.diff)
    || (type === 'diff' ? readString(record.content) : '');
  if (diff) {
    const path = readFirstString(record, ['path', 'filePath', 'file_path']);
    blocks.push({ type: 'diff', content: diff, ...(path ? { path } : {}) });
    return;
  }
  if (projectStructuredToolResultDisplay(record, blocks)) {
    return;
  }
  const text = readString(record.text);
  if (text) {
    blocks.push({ type: 'text', text: record.text as string });
    return;
  }
  if (Array.isArray(record.items)) {
    if (record.items.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry))) {
      const items = record.items.slice(0, MAX_TOOL_RESULT_LIST_ITEMS).map(String);
      blocks.push({
        type: 'list',
        items,
        ...(record.items.length > items.length ? { totalItems: record.items.length } : {}),
      });
    } else {
      normalizeToolResultValue(record.items, blocks, visited, depth + 1);
    }
    return;
  }
  const functionResponse = readRecord(record.functionResponse);
  if (functionResponse) {
    normalizeToolResultValue(functionResponse.response, blocks, visited, depth + 1);
    normalizeToolResultValue(functionResponse.parts, blocks, visited, depth + 1);
    return;
  }
  const summary = readString(record.summary);
  if (summary) {
    blocks.push({ type: 'text', text: record.summary as string });
    return;
  }
  for (const key of [
    'content',
    'contentItems',
    'content_items',
    'output',
    'result',
    'data',
    'response',
    'responseParts',
    'parts',
    'structuredContent',
    'structured_content',
    'attachments',
  ]) {
    if (!(key in record)) {
      continue;
    }
    const previousBlockCount = blocks.length;
    normalizeToolResultValue(record[key], blocks, visited, depth + 1);
    if (blocks.length > previousBlockCount) {
      return;
    }
  }

  if (hasEmbeddedError) {
    return;
  }

  if (appendFlattenedStructuredResult(record, blocks)) {
    return;
  }

  const fallback = formatToolResultValue(record).trim();
  if (fallback) {
    blocks.push({ type: 'text', text: fallback });
  }
}

function resolveAgentSessionItemToolCallNonErrorOutputValue(
  record: Record<string, unknown>,
): unknown {
  const state = readRecord(record.state);
  const stateMetadata = readRecord(state?.metadata);
  const interruptedOutput = stateMetadata?.interrupted === true
    ? stateMetadata.output
    : undefined;
  const type = normalizeType(record.type);
  return interruptedOutput
    ?? record.output
    ?? record.aggregated_output
    ?? record.aggregatedOutput
    ?? record.result
    ?? record.resultDisplay
    ?? record.contentItems
    ?? record.content_items
    ?? state?.output
    ?? state?.result
    ?? (type === 'tool_result' ? record.content : undefined);
}

export function resolveAgentSessionItemToolCallOutputValue(
  record: Record<string, unknown>,
): unknown {
  const state = readRecord(record.state);
  const stateMetadata = readRecord(state?.metadata);
  const interruptedOutput = stateMetadata?.interrupted === true
    ? stateMetadata.output
    : undefined;
  const errorValue = hasAgentSessionItemToolErrorValue(record.error)
    ? record.error
    : hasAgentSessionItemToolErrorValue(state?.error)
      ? state?.error
      : undefined;
  return interruptedOutput
    ?? errorValue
    ?? resolveAgentSessionItemToolCallNonErrorOutputValue(record);
}

function isStructuredMediaToolResultValue(
  value: unknown,
  visited = new WeakSet<object>(),
  depth = 0,
): boolean {
  if (depth >= MAX_TOOL_RESULT_DEPTH) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => isStructuredMediaToolResultValue(entry, visited, depth + 1));
  }
  const record = readRecord(value);
  if (!record || visited.has(record)) {
    return false;
  }
  visited.add(record);
  const type = normalizeType(record.type);
  if (
    [
      'audio',
      'document',
      'file',
      'image',
      'input_audio',
      'input_image',
      'media',
      'resource',
      'resource_link',
    ].includes(type)
    || readRecord(record.inlineData)
    || readRecord(record.fileData)
  ) {
    return true;
  }
  return [
    record.attachments,
    record.content,
    record.contentItems,
    record.content_items,
    record.output,
    record.parts,
    record.resource,
    record.result,
  ].some((entry) => isStructuredMediaToolResultValue(entry, visited, depth + 1));
}

export function resolveAgentSessionItemToolCallOutput(
  record: Record<string, unknown>,
): string {
  const outputValue = resolveAgentSessionItemToolCallOutputValue(record);
  return isStructuredMediaToolResultValue(outputValue)
    ? ''
    : formatToolResultValue(outputValue);
}

export function resolveAgentSessionItemToolCallResultBlocks(
  record: Record<string, unknown>,
  status: AgentSessionItemToolCallStatus | undefined,
): readonly AgentSessionItemToolResultBlockView[] {
  if (Array.isArray(record.resultBlocks)) {
    const normalizedBlocks = record.resultBlocks
      .slice(0, MAX_TOOL_RESULT_BLOCKS)
      .map(normalizeCanonicalResultBlock)
      .filter((block): block is AgentSessionItemToolResultBlockView => block !== null);
    if (normalizedBlocks.length > 0) {
      return normalizedBlocks;
    }
  }

  const blocks: AgentSessionItemToolResultBlockView[] = [];
  const state = readRecord(record.state);
  const errorValue = hasAgentSessionItemToolErrorValue(record.error)
    ? record.error
    : hasAgentSessionItemToolErrorValue(state?.error)
      ? state?.error
      : undefined;
  const outputValue = resolveAgentSessionItemToolCallOutputValue(record);
  const nonErrorOutputValue = resolveAgentSessionItemToolCallNonErrorOutputValue(record);
  const errorText = formatToolResultValue(errorValue).trim();
  const nonErrorOutputText = formatToolResultValue(nonErrorOutputValue).trim();
  if (errorValue !== undefined) {
    const message = readToolResultErrorMessage(errorValue).trim();
    if (message) {
      blocks.push({ type: 'error', message });
    }
  } else if (status === 'error') {
    const message = readToolResultErrorMessage(outputValue).trim();
    if (message) {
      blocks.push({ type: 'error', message });
    }
  } else {
    normalizeToolResultValue(outputValue, blocks, new WeakSet<object>());
  }
  if (
    errorValue !== undefined
    && nonErrorOutputValue !== undefined
    && nonErrorOutputValue !== null
    && nonErrorOutputText
    && nonErrorOutputText !== errorText
  ) {
    normalizeToolResultValue(nonErrorOutputValue, blocks, new WeakSet<object>());
  }

  const attachments = state?.attachments ?? record.attachments;
  if (
    attachments !== undefined
    && attachments !== outputValue
    && attachments !== nonErrorOutputValue
  ) {
    normalizeToolResultValue(attachments, blocks, new WeakSet<object>());
  }
  return blocks.slice(0, MAX_TOOL_RESULT_BLOCKS);
}
