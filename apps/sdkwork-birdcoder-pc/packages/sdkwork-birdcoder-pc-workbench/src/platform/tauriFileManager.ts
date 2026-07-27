import { resolveBirdCoderTauriInvoke } from '@sdkwork/birdcoder-pc-infrastructure/platform/tauriRuntime';

export async function revealTauriPathInFileManager(path: string): Promise<boolean> {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return false;
  }

  const invoke = await resolveBirdCoderTauriInvoke();
  if (!invoke) {
    return false;
  }

  await invoke('desktop_reveal_in_file_manager', { path: normalizedPath });
  return true;
}
