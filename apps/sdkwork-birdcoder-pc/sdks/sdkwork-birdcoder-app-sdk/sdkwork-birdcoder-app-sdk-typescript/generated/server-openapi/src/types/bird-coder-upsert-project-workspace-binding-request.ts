export interface BirdCoderUpsertProjectWorkspaceBindingRequest {
  /** Opaque Drive sandbox identifier. */
  sandboxId: string;
  /** Opaque Drive directory-entry identifier. */
  rootEntryId: string;
  /** Canonical sandbox-relative path using forward-slash segments. Empty means the sandbox root. */
  logicalPath: string;
}
