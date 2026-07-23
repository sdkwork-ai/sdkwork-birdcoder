import type {
  DriveUploaderClient,
  DriveUploaderProfile,
} from '@sdkwork/drive-app-sdk';
import { getBirdCoderH5DriveAppClient } from './dependencySdkClients.ts';

const APP_RESOURCE_TYPE = 'birdcoder-agent-session-item';
const UPLOAD_SCENE = 'birdcoder_agent_session_attachment';
const UPLOAD_SOURCE = 'birdcoder_h5_local_file';

export interface BirdCoderAgentSessionAttachmentUploadOptions {
  file: File;
  sessionId: string;
  profile: DriveUploaderProfile;
  signal?: AbortSignal;
}

export interface BirdCoderAgentSessionAttachmentUploadResult {
  driveRef: {
    resourceRole: 'attachment' | 'image' | 'audio';
    driveSpaceId: string;
    driveNodeId: string;
  };
  nodeId: string;
  spaceId: string;
}

function buildUploaderFingerprint(file: File): string {
  const contentType = file.type.trim() || 'application/octet-stream';
  return `name:${file.name}:size:${file.size}:type:${contentType}`;
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
    default:
      return uploader.uploadAttachment.bind(uploader);
  }
}

function resolveDriveResourceRole(
  profile: DriveUploaderProfile,
): BirdCoderAgentSessionAttachmentUploadResult['driveRef']['resourceRole'] {
  if (profile === 'image' || profile === 'thumbnail' || profile === 'avatar') {
    return 'image';
  }
  return profile === 'audio' ? 'audio' : 'attachment';
}

export async function uploadBirdCoderAgentSessionAttachmentToDrive(
  options: BirdCoderAgentSessionAttachmentUploadOptions,
): Promise<BirdCoderAgentSessionAttachmentUploadResult> {
  const sessionId = options.sessionId.trim();
  if (!sessionId) {
    throw new Error('Agent sessionId is required for attachment upload.');
  }
  const upload = resolveUploaderMethod(
    getBirdCoderH5DriveAppClient().uploader,
    options.profile,
  );
  const result = await upload({
    file: options.file,
    appResourceType: APP_RESOURCE_TYPE,
    appResourceId: sessionId,
    scene: UPLOAD_SCENE,
    source: UPLOAD_SOURCE,
    fileFingerprint: buildUploaderFingerprint(options.file),
    originalFileName: options.file.name,
    contentType: options.file.type.trim() || undefined,
    signal: options.signal,
  });
  const { nodeId, spaceId } = result.uploadItem;
  return {
    driveRef: {
      resourceRole: resolveDriveResourceRole(options.profile),
      driveSpaceId: spaceId,
      driveNodeId: nodeId,
    },
    nodeId,
    spaceId,
  };
}

export function resolveAgentSessionAttachmentUploadProfile(
  file: File,
): DriveUploaderProfile {
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
