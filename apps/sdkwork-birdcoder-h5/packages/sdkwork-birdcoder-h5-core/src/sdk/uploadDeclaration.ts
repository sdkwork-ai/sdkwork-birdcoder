/**
 * Application upload declaration constants.
 *
 * Authority: `DRIVE_SPEC.md` section 18 (Application Upload Declaration Contract).
 * Declared values live in `apps/sdkwork-birdcoder-h5/specs/upload.declaration.json`; this module
 * carries them into code so upload call sites reference a constant instead of repeating literals.
 *
 * Two prior values were rule violations and are corrected here:
 *  - `scene` was `birdcoder_agent_session_attachment`, which is snake_case; section 18.1 requires
 *    a lowercase kebab-case scene label.
 *  - `appResourceType` was `birdcoder-agent-session-item`, which is not a dotted
 *    `<domain>.<resource>` business type; section 18.2 requires at least two dot-separated
 *    lowercase segments.
 */

export interface BirdCoderH5UploadDeclarationEntry {
  readonly appResourceIdKind: 'application' | 'entity' | 'draft';
  readonly appResourceType: string;
  readonly purpose: string;
  readonly retention: 'long_term' | 'temporary';
  readonly scene: string;
  readonly source: string;
  readonly uploadProfileCode: string;
}

/** This application's canonical appId, from `sdkwork.app.config.json` `backend.appId`. */
export const BIRDCODER_H5_APP_ID = 'sdkwork-birdcoder-h5' as const;

/** The single call-origin label for every upload from this application. */
export const BIRDCODER_H5_UPLOAD_SOURCE = 'sdkwork-birdcoder-h5' as const;

/**
 * Agent session attachments.
 *
 * Section 18.1 requires one entry per distinct `(appResourceType, scene, uploadProfileCode)`
 * triple. The session attachment service selects a profile from the file shape, so the profile
 * is a call-time choice rather than a declared constant; the entry therefore declares the
 * identity fields (`appResourceType`, `scene`, `source`) that every such upload shares.
 */
export const BIRDCODER_H5_AGENT_SESSION_ATTACHMENT_UPLOAD = {
  appResourceIdKind: 'entity',
  appResourceType: 'birdcoder.session_item',
  purpose: 'File attached to an agent session from the BirdCoder H5 surface.',
  retention: 'long_term',
  scene: 'agent-session-attachment',
  source: BIRDCODER_H5_UPLOAD_SOURCE,
  uploadProfileCode: 'attachment',
} as const satisfies BirdCoderH5UploadDeclarationEntry;

/** Every declared upload purpose for this application. */
export const BIRDCODER_H5_UPLOAD_DECLARATIONS: readonly BirdCoderH5UploadDeclarationEntry[] = [
  BIRDCODER_H5_AGENT_SESSION_ATTACHMENT_UPLOAD,
];
