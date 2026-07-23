export interface BirdCoderProjectDocumentBinding {
  id: string;
  uuid: string;
  projectId: string;
  /** Stable sdkwork-documents identifier; no cross-domain foreign key is created. */
  documentId: string;
  /** Lower-snake-case binding purpose. */
  bindingKind: string;
  /** Optimistic concurrency version used with the If-Match request header. */
  version: string;
  createdAt: string;
  updatedAt: string;
}
