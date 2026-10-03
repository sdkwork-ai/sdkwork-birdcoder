// Single-implementation re-export: the Drive chat-attachment upload service
// lives in `@sdkwork/birdcoder-pc-infrastructure` (itself re-exported through
// that package's index); this module keeps the workbench deep-import surface
// (`./services/birdcoderDriveUpload`) alive for `sdkwork-birdcoder-pc-ui`
// without duplicating the implementation. The surface mirrors the
// infrastructure module one-to-one, types included.
export type {
  BirdCoderChatDriveUploadOptions,
  BirdCoderChatDriveUploadResult,
} from '@sdkwork/birdcoder-pc-infrastructure/services/birdcoderDriveUpload';
export {
  buildDriveMediaResourceContentBlock,
  resolveBirdCoderChatAttachmentPreviewUrl,
  resolveChatAttachmentUploadProfile,
  uploadBirdCoderChatAttachmentToDrive,
} from '@sdkwork/birdcoder-pc-infrastructure/services/birdcoderDriveUpload';
