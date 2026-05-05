import type { LocalFolderMountSource } from '@sdkwork/birdcoder-types';
import { isBirdCoderTauriRuntime } from './tauriRuntime.ts';

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type TauriDialogWindow = Window &
  typeof globalThis & {
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  };

type DesktopWorkingDirectoryPickerRequest = {
  defaultPath?: string;
  title?: string;
};

type TauriDirectoryDialogResult = string | null;

async function resolveTauriInvoke(): Promise<TauriInvoke> {
  const tauriWindow =
    typeof window === 'undefined' ? null : (window as TauriDialogWindow);
  const directInvoke = tauriWindow?.__TAURI_INTERNALS__?.invoke;
  if (typeof directInvoke === 'function') {
    return directInvoke;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

async function openTauriDirectoryDialog(): Promise<string | null> {
  const invoke = await resolveTauriInvoke();
  const selectedPath = await invoke<TauriDirectoryDialogResult>('desktop_pick_working_directory', {
    request: {} satisfies DesktopWorkingDirectoryPickerRequest,
  });

  return typeof selectedPath === 'string' && selectedPath.length > 0 ? selectedPath : null;
}

export async function openLocalFolder(): Promise<LocalFolderMountSource | null> {
  const directoryPickerWindow = window as DirectoryPickerWindow;

  // Prefer the host-native dialog in Tauri so desktop imports never trigger
  // the browser File System Access permission prompt path.
  if (await isBirdCoderTauriRuntime()) {
    try {
      const selectedPath = await openTauriDirectoryDialog();
      if (selectedPath) {
        return { type: 'tauri', path: selectedPath };
      }

      return null;
    } catch (err) {
      const pickerError = err as Error & { name?: string };
      if (pickerError.name === 'AbortError') {
        return null;
      }

      console.error('Error opening directory with BirdCoder desktop folder picker:', pickerError);
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
