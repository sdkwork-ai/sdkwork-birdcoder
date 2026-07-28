import { fromMarkdown } from 'mdast-util-from-markdown';
import { resolveAgentSessionItemMediaSource } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  AgentSessionItemPresentation,
  AgentSessionItemPresentationBlock,
  AgentSessionItemResourceView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';

const DRIVE_MEDIA_MARKER_PATTERN = /^[\t ]*\[DRIVE_MEDIA:(\{[^\r\n]*\})\][\t ]*(?:\r?\n|$)/gmu;
const MAX_USER_MESSAGE_RESOURCE_LOCATION_CHARACTERS = 32 * 1024;

interface MarkdownSyntaxNode {
  alt?: unknown;
  children?: MarkdownSyntaxNode[];
  position?: {
    end?: { offset?: number };
    start?: { offset?: number };
  };
  type?: string;
  url?: unknown;
}

interface SourceRange {
  end: number;
  start: number;
}

interface DriveMediaEnvelope {
  id?: unknown;
  kind?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  previewUrl?: unknown;
  uri?: unknown;
}

export interface UserMessageImageAttachment {
  driveNodeId?: string;
  id: string;
  source?: string;
  title: string;
}

export interface UserMessageAudioAttachment {
  driveNodeId?: string;
  id: string;
  mimeType?: string;
  source?: string;
  title: string;
}

export interface UserMessageFileAttachment {
  driveNodeId?: string;
  externalUrl?: string;
  id: string;
  kind: AgentSessionItemResourceView['kind'];
  mimeType?: string;
  path?: string;
  title: string;
}

export interface UserMessageDisplay {
  audioAttachments: UserMessageAudioAttachment[];
  fileAttachments: UserMessageFileAttachment[];
  imageAttachments: UserMessageImageAttachment[];
  supplementaryBlocks: AgentSessionItemPresentationBlock[];
  textBlocks: AgentSessionItemPresentationBlock[];
}

function readNonEmptyString(value: unknown): string | undefined {
  if (
    typeof value !== 'string'
    || value.length > MAX_USER_MESSAGE_RESOURCE_LOCATION_CHARACTERS
  ) {
    return undefined;
  }
  const normalizedValue = value.trim();
  return normalizedValue || undefined;
}

function resolveSafeExternalUrl(...values: unknown[]): string | undefined {
  for (const value of values) {
    const url = readNonEmptyString(value);
    if (url && /^https?:\/\//iu.test(url)) {
      return url;
    }
  }
  return undefined;
}

function resolveOpenableFilePath(resource: AgentSessionItemResourceView): string | undefined {
  for (const value of [resource.path, resource.origin?.path]) {
    const path = value?.trim();
    const isWindowsPath = Boolean(path && /^[a-z]:[\\/]/iu.test(path));
    const hasUriScheme = Boolean(path && /^[a-z][a-z0-9+.-]*:/iu.test(path));
    if (
      path
      && path.length <= MAX_USER_MESSAGE_RESOURCE_LOCATION_CHARACTERS
      && (isWindowsPath || !hasUriScheme)
    ) {
      return path;
    }
  }
  return undefined;
}

function resolveDriveNodeId(...values: unknown[]): string | undefined {
  for (const value of values) {
    const uri = readNonEmptyString(value);
    const nodeMatch = uri
      ? /^drive:\/(?:\/spaces\/[^/?#]+)?\/nodes\/([^/?#]+)/iu.exec(uri)
      : null;
    if (!nodeMatch?.[1]) {
      continue;
    }
    try {
      return decodeURIComponent(nodeMatch[1]);
    } catch {
      return nodeMatch[1];
    }
  }
  return undefined;
}

function resolveResourceTitle(resource: AgentSessionItemResourceView): string {
  return resource.name?.trim()
    || resource.origin?.name?.trim()
    || resolveOpenableFilePath(resource)
    || resource.uri?.trim()
    || resource.origin?.uri?.trim()
    || 'Attachment';
}

function mapDriveMediaKind(value: unknown): AgentSessionItemResourceView['kind'] {
  if (value === 'image' || value === 'audio') {
    return value;
  }
  return 'file';
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function resolveUploadedFilePayloadRange(
  content: string,
  markerEnd: number,
  fileName: string | undefined,
): SourceRange | null {
  if (!fileName) {
    return null;
  }
  const remainingContent = content.slice(markerEnd);
  const filePayloadPattern = new RegExp(
    `^[\\t ]*(?:\\r?\\n)*File:[\\t ]*${escapeRegularExpression(fileName)}[\\t ]*\\r?\\n(`
      + '`{3,}'
      + '|~{3,})[^\\r\\n]*\\r?\\n[\\s\\S]*?\\r?\\n\\1[\\t ]*(?:\\r?\\n|$)',
    'u',
  );
  const payloadMatch = filePayloadPattern.exec(remainingContent);
  if (!payloadMatch) {
    return null;
  }
  return {
    start: markerEnd,
    end: markerEnd + payloadMatch[0].length,
  };
}

function applySourceRanges(content: string, ranges: readonly SourceRange[]): string {
  if (ranges.length === 0) {
    return content;
  }
  const orderedRanges = [...ranges].sort((left, right) => left.start - right.start);
  let cursor = 0;
  let output = '';
  for (const range of orderedRanges) {
    const start = Math.max(cursor, range.start);
    const end = Math.max(start, range.end);
    if (start > cursor) {
      output += content.slice(cursor, start);
    }
    cursor = Math.max(cursor, end);
  }
  output += content.slice(cursor);
  return output.replace(/\n[\t ]*\n(?:[\t ]*\n)+/gu, '\n\n').trim();
}

function extractDriveMediaAttachments(content: string): {
  audios: UserMessageAudioAttachment[];
  content: string;
  files: UserMessageFileAttachment[];
  images: UserMessageImageAttachment[];
} {
  const audios: UserMessageAudioAttachment[] = [];
  const files: UserMessageFileAttachment[] = [];
  const images: UserMessageImageAttachment[] = [];
  const ranges: SourceRange[] = [];

  for (const markerMatch of content.matchAll(DRIVE_MEDIA_MARKER_PATTERN)) {
    const markerStart = markerMatch.index;
    const markerEnd = markerStart + markerMatch[0].length;
    let envelope: DriveMediaEnvelope;
    try {
      envelope = JSON.parse(markerMatch[1] ?? '') as DriveMediaEnvelope;
    } catch {
      continue;
    }

    const id = readNonEmptyString(envelope.id) ?? `drive-media-${markerStart}`;
    const fileName = readNonEmptyString(envelope.fileName);
    const mimeType = readNonEmptyString(envelope.mimeType);
    const title = fileName ?? 'Attachment';
    const kind = mapDriveMediaKind(envelope.kind);
    const previewUrl = resolveSafeExternalUrl(envelope.previewUrl);
    const driveNodeId = resolveDriveNodeId(envelope.uri);
    ranges.push({ start: markerStart, end: markerEnd });

    const payloadRange = resolveUploadedFilePayloadRange(content, markerEnd, fileName);
    if (payloadRange) {
      ranges.push(payloadRange);
    }

    if (kind === 'image' && (previewUrl || driveNodeId)) {
      images.push({
        id,
        title,
        ...(driveNodeId ? { driveNodeId } : {}),
        ...(previewUrl ? { source: previewUrl } : {}),
      });
      continue;
    }
    if (kind === 'audio' && (previewUrl || driveNodeId)) {
      audios.push({
        id,
        title,
        ...(driveNodeId ? { driveNodeId } : {}),
        ...(mimeType ? { mimeType } : {}),
        ...(previewUrl ? { source: previewUrl } : {}),
      });
      continue;
    }
    files.push({
      id,
      kind,
      title,
      ...(driveNodeId ? { driveNodeId } : {}),
      ...(mimeType ? { mimeType } : {}),
      ...(previewUrl ? { externalUrl: previewUrl } : {}),
    });
  }

  return {
    audios,
    content: applySourceRanges(content, ranges),
    files,
    images,
  };
}

function visitMarkdownImages(
  node: MarkdownSyntaxNode,
  visitor: (node: MarkdownSyntaxNode) => void,
): void {
  if (node.type === 'image') {
    visitor(node);
  }
  node.children?.forEach((child) => visitMarkdownImages(child, visitor));
}

function extractMarkdownImageAttachments(content: string): {
  content: string;
  images: UserMessageImageAttachment[];
} {
  if (!content.trim()) {
    return { content: '', images: [] };
  }
  const images: UserMessageImageAttachment[] = [];
  const ranges: SourceRange[] = [];
  let root: MarkdownSyntaxNode;
  try {
    root = fromMarkdown(content) as MarkdownSyntaxNode;
  } catch {
    return { content, images };
  }

  visitMarkdownImages(root, (node) => {
    const source = resolveAgentSessionItemMediaSource(node.url, 'image');
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (!source || start === undefined || end === undefined || end <= start) {
      return;
    }
    images.push({
      id: `markdown-image-${start}`,
      source,
      title: readNonEmptyString(node.alt) ?? 'Image',
    });
    ranges.push({ start, end });
  });

  return {
    content: applySourceRanges(content, ranges),
    images,
  };
}

function appendStructuredResource(
  resource: AgentSessionItemResourceView,
  audios: UserMessageAudioAttachment[],
  files: UserMessageFileAttachment[],
  images: UserMessageImageAttachment[],
): void {
  const title = resolveResourceTitle(resource);
  const driveNodeId = resolveDriveNodeId(resource.uri, resource.origin?.uri);
  const imageSource = resource.kind === 'image'
    ? resolveAgentSessionItemMediaSource(
        resource.mediaSource ?? resource.uri ?? resource.origin?.uri,
        'image',
        resource.mimeType,
      )
    : undefined;
  if (imageSource) {
    images.push({ id: resource.id, source: imageSource, title });
    return;
  }
  if (resource.kind === 'image' && driveNodeId) {
    images.push({ id: resource.id, driveNodeId, title });
    return;
  }
  const audioSource = resource.kind === 'audio'
    ? resolveAgentSessionItemMediaSource(
        resource.mediaSource ?? resource.uri ?? resource.origin?.uri,
        'audio',
        resource.mimeType,
      )
    : undefined;
  if (audioSource || (resource.kind === 'audio' && driveNodeId)) {
    audios.push({
      id: resource.id,
      title,
      ...(audioSource ? { source: audioSource } : {}),
      ...(driveNodeId ? { driveNodeId } : {}),
      ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
    });
    return;
  }
  const path = resolveOpenableFilePath(resource);
  const externalUrl = resolveSafeExternalUrl(resource.uri, resource.origin?.uri);
  files.push({
    id: resource.id,
    kind: resource.kind,
    title,
    ...(driveNodeId ? { driveNodeId } : {}),
    ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
    ...(path ? { path } : {}),
    ...(externalUrl ? { externalUrl } : {}),
  });
}

function deduplicateAttachments<T>(
  attachments: readonly T[],
  key: (attachment: T) => string,
): T[] {
  const seenKeys = new Set<string>();
  return attachments.filter((attachment) => {
    const attachmentKey = key(attachment);
    if (seenKeys.has(attachmentKey)) {
      return false;
    }
    seenKeys.add(attachmentKey);
    return true;
  });
}

function deduplicateFileAttachments(
  attachments: readonly UserMessageFileAttachment[],
): UserMessageFileAttachment[] {
  const deduplicatedAttachments: UserMessageFileAttachment[] = [];
  const attachmentIndexes = new Map<string, number>();
  for (const attachment of attachments) {
    const attachmentKey = attachment.id.trim()
      ? `id:${attachment.id.trim()}`
      : attachment.path
        ?? attachment.externalUrl
        ?? `${attachment.kind}:${attachment.title}`;
    const existingIndex = attachmentIndexes.get(attachmentKey);
    if (existingIndex === undefined) {
      attachmentIndexes.set(attachmentKey, deduplicatedAttachments.length);
      deduplicatedAttachments.push(attachment);
      continue;
    }
    const existingAttachment = deduplicatedAttachments[existingIndex]!;
    deduplicatedAttachments[existingIndex] = {
      ...existingAttachment,
      ...(existingAttachment.driveNodeId || !attachment.driveNodeId
        ? {}
        : { driveNodeId: attachment.driveNodeId }),
      ...(existingAttachment.externalUrl || !attachment.externalUrl
        ? {}
        : { externalUrl: attachment.externalUrl }),
      ...(existingAttachment.mimeType || !attachment.mimeType
        ? {}
        : { mimeType: attachment.mimeType }),
      ...(existingAttachment.path || !attachment.path
        ? {}
        : { path: attachment.path }),
    };
  }
  return deduplicatedAttachments;
}

export function resolveUserMessageDisplay(view: AgentSessionItemPresentation): UserMessageDisplay {
  const audioAttachments: UserMessageAudioAttachment[] = [];
  const fileAttachments: UserMessageFileAttachment[] = [];
  const imageAttachments: UserMessageImageAttachment[] = [];
  const textBlocks: AgentSessionItemPresentationBlock[] = [];
  const supplementaryBlocks: AgentSessionItemPresentationBlock[] = [];

  for (const block of view.blocks) {
    if (block.type === 'resources') {
      block.items.forEach((resource) => {
        appendStructuredResource(
          resource,
          audioAttachments,
          fileAttachments,
          imageAttachments,
        );
      });
      continue;
    }
    if (block.type !== 'markdown') {
      supplementaryBlocks.push(block);
      continue;
    }

    const driveMedia = extractDriveMediaAttachments(block.content);
    const markdownImages = extractMarkdownImageAttachments(driveMedia.content);
    audioAttachments.push(...driveMedia.audios);
    fileAttachments.push(...driveMedia.files);
    imageAttachments.push(...driveMedia.images, ...markdownImages.images);
    if (markdownImages.content.trim()) {
      textBlocks.push({ ...block, content: markdownImages.content });
    }
  }

  return {
    audioAttachments: deduplicateAttachments(
      audioAttachments,
      (attachment) => attachment.source ?? attachment.driveNodeId ?? attachment.id,
    ),
    fileAttachments: deduplicateFileAttachments(fileAttachments),
    imageAttachments: deduplicateAttachments(
      imageAttachments,
      (attachment) => attachment.source ?? attachment.driveNodeId ?? attachment.id,
    ),
    supplementaryBlocks,
    textBlocks,
  };
}
