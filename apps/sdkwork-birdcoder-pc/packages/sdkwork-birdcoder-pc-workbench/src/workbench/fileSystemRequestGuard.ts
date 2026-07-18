export interface FileSystemRequestGuardState {
  activeProjectId: string;
  fileTreeRequestVersion: number;
  fileContentRequestVersion: number;
  searchRequestVersion: number;
  pendingFileTreeRequests: number;
  pendingFileContentRequests: number;
  pendingSearchRequests: number;
}

export interface FileSystemRequestStartResult {
  requestVersion: number;
  state: FileSystemRequestGuardState;
}

export function createFileSystemRequestGuardState(
  projectId: string,
): FileSystemRequestGuardState {
  return {
    activeProjectId: projectId,
    fileTreeRequestVersion: 0,
    fileContentRequestVersion: 0,
    searchRequestVersion: 0,
    pendingFileTreeRequests: 0,
    pendingFileContentRequests: 0,
    pendingSearchRequests: 0,
  };
}

export function resetFileSystemRequestGuardState(
  previousState: FileSystemRequestGuardState,
  projectId: string,
): FileSystemRequestGuardState {
  return {
    activeProjectId: projectId,
    fileTreeRequestVersion: previousState.fileTreeRequestVersion + 1,
    fileContentRequestVersion: previousState.fileContentRequestVersion + 1,
    searchRequestVersion: previousState.searchRequestVersion + 1,
    pendingFileTreeRequests: 0,
    pendingFileContentRequests: 0,
    pendingSearchRequests: 0,
  };
}

export function beginFileTreeRequest(
  state: FileSystemRequestGuardState,
): FileSystemRequestStartResult {
  return {
    requestVersion: state.fileTreeRequestVersion + 1,
    state: {
      ...state,
      fileTreeRequestVersion: state.fileTreeRequestVersion + 1,
      pendingFileTreeRequests: state.pendingFileTreeRequests + 1,
    },
  };
}

export function beginFileContentRequest(
  state: FileSystemRequestGuardState,
): FileSystemRequestStartResult {
  return {
    requestVersion: state.fileContentRequestVersion + 1,
    state: {
      ...state,
      fileContentRequestVersion: state.fileContentRequestVersion + 1,
      pendingFileContentRequests: state.pendingFileContentRequests + 1,
    },
  };
}

export function beginSearchRequest(
  state: FileSystemRequestGuardState,
): FileSystemRequestStartResult {
  return {
    requestVersion: state.searchRequestVersion + 1,
    state: {
      ...state,
      searchRequestVersion: state.searchRequestVersion + 1,
      pendingSearchRequests: state.pendingSearchRequests + 1,
    },
  };
}

function completePendingRequests(
  state: FileSystemRequestGuardState,
  candidateProjectId: string,
  pendingKey:
    | 'pendingFileTreeRequests'
    | 'pendingFileContentRequests'
    | 'pendingSearchRequests',
): FileSystemRequestGuardState {
  if (!isProjectActiveForRequestGuard(state, candidateProjectId)) {
    return state;
  }

  return {
    ...state,
    [pendingKey]: Math.max(0, state[pendingKey] - 1),
  };
}

export function completeFileTreeRequest(
  state: FileSystemRequestGuardState,
  candidateProjectId: string,
): FileSystemRequestGuardState {
  return completePendingRequests(state, candidateProjectId, 'pendingFileTreeRequests');
}

export function completeFileContentRequest(
  state: FileSystemRequestGuardState,
  candidateProjectId: string,
): FileSystemRequestGuardState {
  return completePendingRequests(state, candidateProjectId, 'pendingFileContentRequests');
}

export function completeSearchRequest(
  state: FileSystemRequestGuardState,
  candidateProjectId: string,
): FileSystemRequestGuardState {
  return completePendingRequests(state, candidateProjectId, 'pendingSearchRequests');
}

export function hasPendingFileTreeRequests(state: FileSystemRequestGuardState): boolean {
  return state.pendingFileTreeRequests > 0;
}

export function hasPendingFileContentRequests(state: FileSystemRequestGuardState): boolean {
  return state.pendingFileContentRequests > 0;
}

export function hasPendingSearchRequests(state: FileSystemRequestGuardState): boolean {
  return state.pendingSearchRequests > 0;
}

export function isProjectActiveForRequestGuard(
  state: FileSystemRequestGuardState,
  candidateProjectId: string,
): boolean {
  return state.activeProjectId === candidateProjectId;
}

export function isLatestFileTreeRequestForGuard(
  state: FileSystemRequestGuardState,
  candidateProjectId: string,
  requestVersion: number,
): boolean {
  return (
    isProjectActiveForRequestGuard(state, candidateProjectId) &&
    state.fileTreeRequestVersion === requestVersion
  );
}

export function isLatestFileContentRequestForGuard(
  state: FileSystemRequestGuardState,
  candidateProjectId: string,
  requestVersion: number,
): boolean {
  return (
    isProjectActiveForRequestGuard(state, candidateProjectId) &&
    state.fileContentRequestVersion === requestVersion
  );
}

export function isLatestSearchRequestForGuard(
  state: FileSystemRequestGuardState,
  candidateProjectId: string,
  requestVersion: number,
): boolean {
  return (
    isProjectActiveForRequestGuard(state, candidateProjectId) &&
    state.searchRequestVersion === requestVersion
  );
}
