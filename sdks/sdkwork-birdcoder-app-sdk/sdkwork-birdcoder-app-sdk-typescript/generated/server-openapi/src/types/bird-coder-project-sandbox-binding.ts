/** BirdCoder-owned binding to a Drive sandbox directory. Physical paths, provider roots, browser handles, and Tauri paths are never stored or returned. Every filesystem operation must authorize against Drive again. */
export interface BirdCoderProjectSandboxBinding {
  /** Opaque BirdCoder sandbox-binding identifier. */
  id: string;
  projectId: string;
  /** Opaque Drive sandbox identifier. This reference does not grant Drive access. */
  sandboxId: string;
  /** Opaque Drive entry identifier selected as the project root. */
  rootEntryId: string;
  /** Canonical sandbox-relative path using forward-slash segments. Empty means the sandbox root. */
  logicalPath: string;
  status: 'active' | 'revoked';
  /** Optimistic concurrency version used with the If-Match request header. */
  version: string;
  createdAt: string;
  updatedAt: string;
}
