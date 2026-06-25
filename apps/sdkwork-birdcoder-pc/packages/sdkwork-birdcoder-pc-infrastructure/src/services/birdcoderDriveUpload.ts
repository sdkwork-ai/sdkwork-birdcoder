import type {
  DriveUploaderClient,
  DriveUploaderProfile,
  MediaResource,
  SdkworkDriveAppClient,
} from '@sdkwork/drive-app-sdk';
import { isBlank } from '@sdkwork/utils/string';
import { getBirdCoderDriveAppClient } from './iamRuntime.ts';

const BIRDCODER_CHAT_APP_RESOURCE_TYPE = 'birdcoder-chat-composer';
const BIRDCODER_CHAT_UPLOAD_SCENE = 'birdcoder_chat_attachment';
const BIRDCODER_CHAT_UPLOAD_SOURCE = 'birdcoder_pc_local_file';
const CHAT_DOWNLOAD_GRANT_TTL_SECONDS = 3600;

export interface BirdCoderChatDriveUploadOptions {
  file: File;
  sessionId?: string;
  profile: DriveUploaderProfile;
  signal?: AbortSignal;
}

export interface BirdCoderChatDriveUploadResult {
  mediaResource: MediaResource;
  nodeId: string;
  previewUrl?: string;
}

function resolveChatAppResourceId(sessionId?: string): string {
  if (typeof sessionId === 'string' && !isBlank(sessionId)) {
    return sessionId.trim();
  }
  return 'default';
}

function buildUploaderFingerprint(file: File): string {
  const contentType = file.type.trim() || 'application/octet-stream';
  return `name:${file.name}:size:${file.size}:type:${contentType}`;
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
      return 'file';
  }
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
  profile: DriveUploaderProfile,
): Promise<string | undefined> {
  if (profile !== 'image' && profile !== 'thumbnail' && profile !== 'avatar') {
    return undefined;
  }

  try {
    const grant = await client.drive.downloadGrants.create(nodeId, {
      requestedTtlSeconds: CHAT_DOWNLOAD_GRANT_TTL_SECONDS,
    });
    return grant.downloadUrl;
  } catch {
    return undefined;
  }
}

export async function uploadBirdCoderChatAttachmentToDrive(
  options: BirdCoderChatDriveUploadOptions,
): Promise<BirdCoderChatDriveUploadResult> {
  const client = getBirdCoderDriveAppClient();
  const upload = resolveUploaderMethod(client.uploader, options.profile);
  const uploadResult = await upload({
    file: options.file,
    appResourceType: BIRDCODER_CHAT_APP_RESOURCE_TYPE,
    appResourceId: resolveChatAppResourceId(options.sessionId),
    scene: BIRDCODER_CHAT_UPLOAD_SCENE,
    source: BIRDCODER_CHAT_UPLOAD_SOURCE,
    fileFingerprint: buildUploaderFingerprint(options.file),
    originalFileName: options.file.name,
    contentType: options.file.type.trim() || undefined,
    signal: options.signal,
  });

  const nodeId = uploadResult.uploadItem.nodeId;
  const mediaResource: MediaResource = {
    id: nodeId,
    kind: mapProfileToMediaKind(options.profile),
    source: 'drive',
    uri: `drive://nodes/${nodeId}`,
    fileName: uploadResult.uploadItem.originalFileName,
    mimeType: uploadResult.uploadItem.contentType,
    sizeBytes: uploadResult.uploadItem.contentLength,
    checksumSha256: uploadResult.uploadItem.checksumSha256Hex,
  };
  const previewUrl = await resolveChatAttachmentPreviewUrl(client, nodeId, options.profile);

  return {
    mediaResource,
    nodeId,
    previewUrl,
  };
}

export function buildDriveMediaResourceContentBlock(
  mediaResource: MediaResource,
  previewUrl?: string,
): string {
  if (previewUrl && mediaResource.kind === 'image') {
    const label = mediaResource.fileName?.trim() || 'image';
    return `\n![${label}](${previewUrl})\n`;
  }

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
