/**
 * Application upload declaration constants.
 *
 * Authority: `DRIVE_SPEC.md` section 18 (Application Upload Declaration Contract).
 * Declared values live in `apps/sdkwork-birdcoder-pc/specs/upload.declaration.json`; this module
 * carries them into code so upload call sites reference a constant instead of repeating literals.
 *
 * Three prior values were rule violations and are corrected here:
 *  - `appResourceType` was `birdcoder-chat-composer`, which is not a dotted
 *    `<domain>.<resource>` business type; section 18.2 requires at least two dot-separated
 *    lowercase segments.
 *  - `scene` was `birdcoder_chat_attachment`, which is snake_case; section 18.1 requires a
 *    lowercase kebab-case scene label.
 *  - `source` was `birdcoder_pc_local_file`, which named the implementation rather than a stable
 *    call-origin label.
 */

export interface BirdCoderPcUploadDeclarationEntry {
  readonly appResourceIdKind: 'application' | 'entity' | 'draft';
  readonly appResourceType: string;
  readonly purpose: string;
  readonly retention: 'long_term' | 'temporary';
  readonly scene: string;
  readonly source: string;
  readonly uploadProfileCode: string;
}

/** This application's canonical appId, from `sdkwork.app.config.json` `backend.appId`. */
export const BIRDCODER_PC_APP_ID = 'sdkwork-birdcoder-pc' as const;

/** The single call-origin label for every upload from this application. */
export const BIRDCODER_PC_UPLOAD_SOURCE = 'sdkwork-birdcoder-pc' as const;

/**
 * Chat composer attachments.
 *
 * Section 18.1 requires one entry per distinct `(appResourceType, scene, uploadProfileCode)`
 * triple. The composer selects a profile from the attached file's shape, so the profile is a
 * call-time choice rather than a declared constant; the entry declares the identity fields every
 * such upload shares.
 */
export const BIRDCODER_PC_CHAT_COMPOSER_ATTACHMENT_UPLOAD = {
  appResourceIdKind: 'entity',
  appResourceType: 'birdcoder.chat_composer_attachment',
  purpose: 'File attached to a chat composer message from the BirdCoder PC surface.',
  retention: 'long_term',
  scene: 'agent-session-attachment',
  source: BIRDCODER_PC_UPLOAD_SOURCE,
  uploadProfileCode: 'attachment',
} as const satisfies BirdCoderPcUploadDeclarationEntry;

/** Every declared upload purpose for this application. */
export const BIRDCODER_PC_UPLOAD_DECLARATIONS: readonly BirdCoderPcUploadDeclarationEntry[] = [
  BIRDCODER_PC_CHAT_COMPOSER_ATTACHMENT_UPLOAD,
];
