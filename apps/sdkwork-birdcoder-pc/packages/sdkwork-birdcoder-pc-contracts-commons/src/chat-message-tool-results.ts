import type {
  BirdCoderChatMessageToolCallStatus,
  BirdCoderChatMessageToolResultBlock,
} from '@sdkwork/birdcoder-chat-contracts';

const MAX_TOOL_RESULT_BLOCKS = 200;
const MAX_TOOL_RESULT_DEPTH = 16;
const MAX_TOOL_RESULT_LIST_ITEMS = 200;

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
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
  return readString(value).toLowerCase().replace(/[.\s-]+/gu, '_');
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

export function hasStructuredChatMessageToolError(
  value: unknown,
  visited = new WeakSet<object>(),
  depth = 0,
): boolean {
  if (depth >= MAX_TOOL_RESULT_DEPTH) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((entry) =>
      hasStructuredChatMessageToolError(entry, visited, depth + 1),
    );
  }
  const record = readRecord(value);
  if (!record || visited.has(record)) {
    return false;
  }
  visited.add(record);
  const type = normalizeType(record.type);
  if (
    record.is_error === true
    || record.error !== undefined
    || type === 'error'
    || type.endsWith('_error')
  ) {
    return true;
  }
  return ['content', 'output', 'response', 'result', 'parts'].some((key) =>
    hasStructuredChatMessageToolError(record[key], visited, depth + 1),
  );
}

function normalizeCanonicalResultBlock(
  value: unknown,
): BirdCoderChatMessageToolResultBlock | null {
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
    const source = readString(record.source);
    if (!source) {
      return null;
    }
    const mimeType = readString(record.mimeType);
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
    if (!uri) {
      return null;
    }
    const name = readString(record.name);
    const mimeType = readString(record.mimeType);
    const text = typeof record.text === 'string' && record.text.trim() ? record.text : '';
    const description = readString(record.description);
    const size = readFiniteNumber(record.size);
    return {
      type: 'resource',
      uri,
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

function readToolResultErrorMessage(value: unknown): string {
  const directMessage = readString(value);
  if (directMessage) {
    return directMessage;
  }
  const record = readRecord(value);
  return readFirstString(record, ['message', 'error', 'detail', 'reason', 'error_code'])
    || formatToolResultValue(value);
}

function resolveMedia(
  record: Record<string, unknown>,
): { mimeType?: string; source: string } | null {
  const nestedSource = readRecord(record.source);
  const inlineData = readRecord(record.inlineData);
  const fileData = readRecord(record.fileData);
  const mimeType = readFirstString(record, ['mimeType', 'mime_type', 'mediaType', 'media_type', 'mime'])
    || readFirstString(nestedSource, ['mimeType', 'mime_type', 'mediaType', 'media_type', 'mime'])
    || readFirstString(inlineData, ['mimeType', 'mime_type'])
    || readFirstString(fileData, ['mimeType', 'mime_type']);
  const externalSource = readFirstString(record, ['url', 'uri', 'fileUri', 'file_uri'])
    || readFirstString(nestedSource, ['url', 'uri', 'fileUri', 'file_uri'])
    || readFirstString(fileData, ['url', 'uri', 'fileUri', 'file_uri']);
  if (externalSource) {
    return { ...(mimeType ? { mimeType } : {}), source: externalSource };
  }
  const data = readFirstString(record, ['data', 'base64'])
    || readFirstString(nestedSource, ['data', 'base64'])
    || readFirstString(inlineData, ['data', 'base64']);
  if (!data) {
    return null;
  }
  if (/^(?:data:|https?:|blob:)/iu.test(data)) {
    return { ...(mimeType ? { mimeType } : {}), source: data };
  }
  return {
    ...(mimeType ? { mimeType } : {}),
    source: `data:${mimeType || 'application/octet-stream'};base64,${data}`,
  };
}

function appendMediaOrResourceBlock(
  record: Record<string, unknown>,
  blocks: BirdCoderChatMessageToolResultBlock[],
): boolean {
  const media = resolveMedia(record);
  if (!media) {
    return false;
  }
  const title = readFirstString(record, ['title', 'name', 'filename', 'alt']);
  if (media.mimeType?.toLowerCase().startsWith('image/')) {
    blocks.push({ type: 'image', ...media, ...(title ? { title } : {}) });
    return true;
  }
  if (media.mimeType?.toLowerCase().startsWith('audio/')) {
    blocks.push({ type: 'audio', ...media, ...(title ? { title } : {}) });
    return true;
  }
  blocks.push({
    type: 'resource',
    uri: media.source,
    ...(title ? { name: title } : {}),
    ...(media.mimeType ? { mimeType: media.mimeType } : {}),
  });
  return true;
}

function projectToolResultValue(
  value: unknown,
  blocks: BirdCoderChatMessageToolResultBlock[],
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
      projectToolResultValue(entry, blocks, visited, depth + 1);
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
  if (type === 'error' || type.endsWith('_error') || record.is_error === true) {
    blocks.push({ type: 'error', message: readToolResultErrorMessage(record) });
    return;
  }
  if (type.includes('redacted_result')) {
    return;
  }
  if (
    type === 'image'
    || type === 'audio'
    || type === 'file'
    || type === 'media'
    || readRecord(record.inlineData)
    || readRecord(record.fileData)
  ) {
    if (appendMediaOrResourceBlock(record, blocks)) {
      return;
    }
  }
  if (type === 'resource' || type === 'resource_link' || readRecord(record.resource)) {
    const resource = readRecord(record.resource) ?? record;
    const uri = readFirstString(resource, ['uri', 'url']);
    if (uri) {
      const name = readFirstString(resource, ['name', 'title']);
      const mimeType = readFirstString(resource, ['mimeType', 'mime_type']);
      const text = readString(resource.text);
      const description = readFirstString(resource, ['description', 'snippet']);
      const size = readFiniteNumber(resource.size);
      blocks.push({
        type: 'resource',
        uri,
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
      projectToolResultValue(record.items, blocks, visited, depth + 1);
    }
    return;
  }
  const functionResponse = readRecord(record.functionResponse);
  if (functionResponse) {
    projectToolResultValue(functionResponse.response, blocks, visited, depth + 1);
    projectToolResultValue(functionResponse.parts, blocks, visited, depth + 1);
    return;
  }
  for (const key of ['content', 'output', 'result', 'data', 'response', 'parts', 'attachments']) {
    if (!(key in record)) {
      continue;
    }
    const previousBlockCount = blocks.length;
    projectToolResultValue(record[key], blocks, visited, depth + 1);
    if (blocks.length > previousBlockCount) {
      return;
    }
  }

  const fallback = formatToolResultValue(record).trim();
  if (fallback) {
    blocks.push({ type: 'text', text: fallback });
  }
}

export function resolveChatMessageToolCallOutputValue(
  record: Record<string, unknown>,
): unknown {
  const state = readRecord(record.state);
  const stateMetadata = readRecord(state?.metadata);
  const interruptedOutput = stateMetadata?.interrupted === true
    ? stateMetadata.output
    : undefined;
  const type = normalizeType(record.type);
  return interruptedOutput
    ?? record.error
    ?? state?.error
    ?? record.output
    ?? record.aggregated_output
    ?? record.result
    ?? state?.output
    ?? state?.result
    ?? (type === 'tool_result' ? record.content : undefined);
}

export function resolveChatMessageToolCallOutput(
  record: Record<string, unknown>,
): string {
  return formatToolResultValue(resolveChatMessageToolCallOutputValue(record));
}

export function resolveChatMessageToolCallResultBlocks(
  record: Record<string, unknown>,
  status: BirdCoderChatMessageToolCallStatus | undefined,
): readonly BirdCoderChatMessageToolResultBlock[] {
  if (Array.isArray(record.resultBlocks)) {
    const normalizedBlocks = record.resultBlocks
      .slice(0, MAX_TOOL_RESULT_BLOCKS)
      .map(normalizeCanonicalResultBlock)
      .filter((block): block is BirdCoderChatMessageToolResultBlock => block !== null);
    if (normalizedBlocks.length > 0) {
      return normalizedBlocks;
    }
  }

  const blocks: BirdCoderChatMessageToolResultBlock[] = [];
  const state = readRecord(record.state);
  const errorValue = record.error ?? state?.error;
  const outputValue = resolveChatMessageToolCallOutputValue(record);
  if (errorValue !== undefined && errorValue !== null) {
    const message = readToolResultErrorMessage(errorValue).trim();
    if (message) {
      blocks.push({ type: 'error', message });
    }
  }
  if (status === 'error' && errorValue === undefined) {
    const message = readToolResultErrorMessage(outputValue).trim();
    if (message) {
      blocks.push({ type: 'error', message });
    }
  } else if (outputValue !== errorValue) {
    projectToolResultValue(outputValue, blocks, new WeakSet<object>());
  }

  const attachments = state?.attachments ?? record.attachments;
  if (attachments !== undefined && attachments !== outputValue) {
    projectToolResultValue(attachments, blocks, new WeakSet<object>());
  }
  return blocks.slice(0, MAX_TOOL_RESULT_BLOCKS);
}
