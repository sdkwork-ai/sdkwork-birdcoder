import type {
  DriveUploaderClient,
  DriveUploaderProfile,
  MediaResource,
  SdkworkDriveAppClient,
} from '@sdkwork/birdcoder-pc-core/sdk/drive-app';
import { getPath } from '@sdkwork/utils/object';
import { isBlank } from '@sdkwork/utils/string';
import { getBirdCoderDriveAppClient } from './iamRuntime.ts';

const BIRDCODER_CHAT_APP_RESOURCE_TYPE = 'birdcoder-chat-composer';
const BIRDCODER_CHAT_UPLOAD_SCENE = 'birdcoder_chat_attachment';
const BIRDCODER_CHAT_UPLOAD_SOURCE = 'birdcoder_pc_local_file';
const CHAT_DOWNLOAD_GRANT_TTL_SECONDS = 3600;

export interface BirdCoderChatDriveUploadOptions {
  file: File;
  resourceId?: string;
  profile: DriveUploaderProfile;
  signal?: AbortSignal;
}

export interface BirdCoderChatDriveUploadResult {
  driveSpaceId: string;
  mediaResource: MediaResource;
  nodeId: string;
}

function resolveChatAppResourceId(resourceId?: string): string {
  if (typeof resourceId === 'string' && !isBlank(resourceId)) {
    return resourceId.trim();
  }
  return 'default';
}

function mapProfileToMediaKind(profile: DriveUploaderProfile): MediaResource['kind'] {
  switch (profile) {
    case 'image':
    case 'thumbnail':
    case 'avatar':
      return 'image';
    case 'video':
      return 'video';
    case 'audio':
      return 'audio';
    case 'archive':
      return 'archive';
    case 'document':
    case 'text':
    case 'dataset':
      return 'document';
    default:
      return 'other';
  }
}

function readDownloadUrl(payload: unknown): string | undefined {
  const value = getPath(payload, 'downloadUrl') ?? getPath(payload, 'data.downloadUrl');
  if (typeof value !== 'string' || isBlank(value)) {
    return undefined;
  }
  const normalizedValue = value.trim();
  return /^https?:\/\//iu.test(normalizedValue)
    || (normalizedValue.startsWith('/') && !normalizedValue.startsWith('//'))
    ? normalizedValue
    : undefined;
}

function resolveUploaderMethod(
  uploader: DriveUploaderClient,
  profile: DriveUploaderProfile,
): DriveUploaderClient['upload'] {
  switch (profile) {
    case 'image':
      return uploader.uploadImage.bind(uploader);
    case 'video':
      return uploader.uploadVideo.bind(uploader);
    case 'audio':
      return uploader.uploadAudio.bind(uploader);
    case 'document':
      return uploader.uploadDocument.bind(uploader);
    case 'archive':
      return uploader.uploadArchive.bind(uploader);
    case 'text':
      return uploader.uploadText.bind(uploader);
    case 'dataset':
      return uploader.uploadDataset.bind(uploader);
    case 'attachment':
      return uploader.uploadAttachment.bind(uploader);
    case 'avatar':
      return uploader.uploadAvatar.bind(uploader);
    case 'thumbnail':
      return uploader.uploadThumbnail.bind(uploader);
    default:
      return uploader.upload.bind(uploader);
  }
}

async function resolveChatAttachmentPreviewUrl(
  client: SdkworkDriveAppClient,
  nodeId: string,
): Promise<string | undefined> {
  try {
    const grant = await client.drive.downloadGrants.create(nodeId, {
      requestedTtlSeconds: CHAT_DOWNLOAD_GRANT_TTL_SECONDS,
    });
    return readDownloadUrl(grant);
  } catch {
    return undefined;
  }
}

export async function resolveBirdCoderChatAttachmentPreviewUrl(
  nodeId: string,
): Promise<string | undefined> {
  const normalizedNodeId = nodeId.trim();
  if (!normalizedNodeId) {
    return undefined;
  }
  return resolveChatAttachmentPreviewUrl(getBirdCoderDriveAppClient(), normalizedNodeId);
}

export async function uploadBirdCoderChatAttachmentToDrive(
  options: BirdCoderChatDriveUploadOptions,
): Promise<BirdCoderChatDriveUploadResult> {
  const client = getBirdCoderDriveAppClient();
  const upload = resolveUploaderMethod(client.uploader, options.profile);
  const uploadResult = await upload({
    file: options.file,
    appResourceType: BIRDCODER_CHAT_APP_RESOURCE_TYPE,
    appResourceId: resolveChatAppResourceId(options.resourceId),
    scene: BIRDCODER_CHAT_UPLOAD_SCENE,
    source: BIRDCODER_CHAT_UPLOAD_SOURCE,
    originalFileName: options.file.name,
    contentType: options.file.type.trim() || undefined,
    retention: { mode: 'long_term' },
    signal: options.signal,
  });

  const driveSpaceId = uploadResult.uploadItem.spaceId?.trim();
  const nodeId = uploadResult.uploadItem.nodeId;
  if (!driveSpaceId || !nodeId) {
    throw new Error('Drive upload did not return a stable Space and Node identity.');
  }
  const mediaResource: MediaResource = {
    id: nodeId,
    kind: mapProfileToMediaKind(options.profile),
    source: 'drive',
    uri: `drive://spaces/${encodeURIComponent(driveSpaceId)}/nodes/${encodeURIComponent(nodeId)}`,
    fileName: uploadResult.uploadItem.originalFileName,
    mimeType: uploadResult.uploadItem.contentType,
    sizeBytes: uploadResult.uploadItem.contentLength,
    checksumSha256: uploadResult.uploadItem.checksumSha256Hex,
  };

  return {
    driveSpaceId,
    mediaResource,
    nodeId,
  };
}

export function buildDriveMediaResourceContentBlock(mediaResource: MediaResource): string {
  return `\n\n[DRIVE_MEDIA:${JSON.stringify(mediaResource)}]\n`;
}

export function resolveChatAttachmentUploadProfile(file: File): DriveUploaderProfile {
  const contentType = file.type.trim().toLowerCase();
  if (contentType.startsWith('image/')) {
    return 'image';
  }
  if (contentType.startsWith('video/')) {
    return 'video';
  }
  if (contentType.startsWith('audio/')) {
    return 'audio';
  }
  if (
    contentType.startsWith('text/')
    || contentType.includes('json')
    || contentType.includes('xml')
    || contentType.includes('yaml')
  ) {
    return 'text';
  }
  if (
    contentType.includes('pdf')
    || contentType.includes('word')
    || contentType.includes('sheet')
    || contentType.includes('presentation')
  ) {
    return 'document';
  }
  if (
    contentType.includes('zip')
    || contentType.includes('tar')
    || contentType.includes('gzip')
    || contentType.includes('7z')
  ) {
    return 'archive';
  }
  return 'attachment';
}
