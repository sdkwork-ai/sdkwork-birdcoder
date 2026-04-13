import type { LocalFolderMountSource } from '@sdkwork/birdcoder-types';

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };

export async function openLocalFolder(): Promise<LocalFolderMountSource | null> {
  // Check if running in Tauri
  const isTauri = '__TAURI__' in window;

  if (isTauri) {
    try {
      // Use Tauri API
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selectedPath = await open({
        directory: true,
        multiple: false,
      });
      if (selectedPath) {
        return { type: 'tauri', path: selectedPath as string };
      }
    } catch (err) {
      console.error('Error opening directory with Tauri:', err);
      throw err;
    }
  } else {
    // Use File System Access API
    const directoryPickerWindow = window as DirectoryPickerWindow;
    if (directoryPickerWindow.showDirectoryPicker) {
      try {
        const directoryHandle = await directoryPickerWindow.showDirectoryPicker();
        return { type: 'browser', handle: directoryHandle };
      } catch (err) {
        const pickerError = err as Error & { name?: string };
        if (pickerError.name !== 'AbortError') {
          console.error('Error opening directory:', pickerError);
          throw pickerError;
        }
      }
    } else {
      throw new Error('File System Access API is not supported in this browser.');
    }
  }
  return null;
}
