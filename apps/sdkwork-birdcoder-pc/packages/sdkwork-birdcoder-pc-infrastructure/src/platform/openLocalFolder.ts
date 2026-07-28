import type { LocalFolderPickerResult } from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  isBirdCoderTauriRuntime,
  resolveBirdCoderTauriInvoke,
} from './tauriRuntime.ts';

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };

type DesktopWorkingDirectoryPickerRequest = {
  defaultPath?: string;
  title?: string;
};

type TauriDirectoryDialogResult = string | null;

async function openTauriDirectoryDialog(): Promise<string | null> {
  const invoke = await resolveBirdCoderTauriInvoke();
  if (!invoke) {
    throw new Error('The BirdCoder desktop folder picker is unavailable.');
  }
  const selectedPath = await invoke<TauriDirectoryDialogResult>('desktop_pick_working_directory', {
    request: {} satisfies DesktopWorkingDirectoryPickerRequest,
  });

  return typeof selectedPath === 'string' && selectedPath.trim().length > 0
    ? selectedPath
    : null;
}

function createUnsupportedLocalFolderPickerResult(): LocalFolderPickerResult {
  return {
    status: 'unsupported',
    capability: 'local_folder_picker',
    code: 'browser_file_system_access_unavailable',
    message: 'Local folder access is not available in this browser.',
  };
}

export async function openLocalFolder(): Promise<LocalFolderPickerResult> {
  if (typeof window === 'undefined') {
    return createUnsupportedLocalFolderPickerResult();
  }

  const directoryPickerWindow = window as DirectoryPickerWindow;

  // Prefer the host-native dialog in Tauri so desktop imports never trigger
  // the browser File System Access permission prompt path.
  if (await isBirdCoderTauriRuntime()) {
    try {
      const selectedPath = await openTauriDirectoryDialog();
      if (selectedPath) {
        return {
          status: 'selected',
          source: { type: 'tauri', path: selectedPath },
        };
      }

      return { status: 'cancelled' };
    } catch (err) {
      const pickerError = err as Error & { name?: string };
      if (pickerError.name === 'AbortError') {
        return { status: 'cancelled' };
      }

      console.error('The BirdCoder desktop folder picker could not be opened.');
      throw new Error('The BirdCoder desktop folder picker could not be opened.');
    }
  }

  if (directoryPickerWindow.showDirectoryPicker) {
    try {
      const directoryHandle = await directoryPickerWindow.showDirectoryPicker();
      return {
        status: 'selected',
        source: { type: 'browser', handle: directoryHandle },
      };
    } catch (err) {
      const pickerError = err as Error & { name?: string };
      if (pickerError.name === 'AbortError') {
        return { status: 'cancelled' };
      }

      console.error('The browser folder picker could not be opened.');
      throw new Error('The browser folder picker could not be opened.');
    }
  }

  return createUnsupportedLocalFolderPickerResult();
}

export async function isDesktopLocalFolderPickerRuntime(): Promise<boolean> {
  return isBirdCoderTauriRuntime();
}
