export interface SelectedSessionAuthoritySnapshotPolicy {
  authorityAvailable: boolean;
  hasSynchronizedCurrentRequest: boolean;
  shouldBootstrapFromAuthority: boolean;
}

/**
 * A realtime subscription only carries changes that happen after it connects.
 * Every new selection request therefore needs one authoritative snapshot before
 * SSE or WebSocket can own subsequent transcript updates.
 */
export function shouldSynchronizeSelectedSessionAuthoritySnapshot({
  authorityAvailable,
  hasSynchronizedCurrentRequest,
  shouldBootstrapFromAuthority,
}: SelectedSessionAuthoritySnapshotPolicy): boolean {
  return (
    authorityAvailable &&
    (shouldBootstrapFromAuthority || !hasSynchronizedCurrentRequest)
  );
}
