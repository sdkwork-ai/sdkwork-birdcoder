import type { ProjectRuntimeLocationResolution } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export function getResolvedProjectRuntimeLocationWorkingDirectory(
  resolution: ProjectRuntimeLocationResolution,
): string | null {
  return resolution.status === 'resolved'
    ? resolution.location.localWorkingDirectory
    : null;
}

/**
 * A cancelled picker is an intentional no-op. Other outcomes have a
 * user-safe service message and may fall back to the caller's action wording.
 */
export function getProjectRuntimeLocationFailureMessage(
  resolution: ProjectRuntimeLocationResolution,
  fallbackMessage: string,
): string | null {
  if (resolution.status === 'resolved' || resolution.status === 'cancelled') {
    return null;
  }

  return resolution.message || fallbackMessage;
}
