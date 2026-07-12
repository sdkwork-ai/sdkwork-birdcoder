export function buildBirdCoderEditorModelPath(
  surface: string,
  projectId: string | null | undefined,
  filePath: string | null | undefined,
): string | undefined {
  const normalizedSurface = surface.trim();
  const normalizedFilePath = filePath?.trim();
  if (!normalizedSurface || !normalizedFilePath) {
    return undefined;
  }

  const normalizedProjectId = projectId?.trim() || 'unscoped';
  return `birdcoder://editor/${encodeURIComponent(normalizedSurface)}/${encodeURIComponent(normalizedProjectId)}/${encodeURIComponent(normalizedFilePath)}`;
}
