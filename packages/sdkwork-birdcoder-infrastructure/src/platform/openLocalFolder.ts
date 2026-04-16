import type { LocalFolderMountSource } from '@sdkwork/birdcoder-types';
import { isBirdCoderTauriRuntime } from './tauriRuntime.ts';

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };

export async function openLocalFolder(): Promise<LocalFolderMountSource | null> {
  const directoryPickerWindow = window as DirectoryPickerWindow;

  // Prefer the host-native dialog in Tauri so desktop imports never trigger
  // the browser File System Access permission prompt path.
  if (await isBirdCoderTauriRuntime()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selectedPath = await open({
        directory: true,
        multiple: false,
      });
      if (selectedPath) {
        return { type: 'tauri', path: selectedPath as string };
      }

      return null;
    } catch (err) {
      const pickerError = err as Error & { name?: string };
      if (pickerError.name === 'AbortError') {
        return null;
      }

      console.error('Error opening directory with Tauri dialog API:', pickerError);
      throw pickerError;
    }
  }

  if (directoryPickerWindow.showDirectoryPicker) {
    try {
      const directoryHandle = await directoryPickerWindow.showDirectoryPicker();
      return { type: 'browser', handle: directoryHandle };
    } catch (err) {
      const pickerError = err as Error & { name?: string };
      if (pickerError.name === 'AbortError') {
        return null;
      }

      console.error('Error opening directory with browser File System Access API:', pickerError);
      throw pickerError;
    }
  }

  throw new Error('File System Access API is not supported in this browser.');
}
