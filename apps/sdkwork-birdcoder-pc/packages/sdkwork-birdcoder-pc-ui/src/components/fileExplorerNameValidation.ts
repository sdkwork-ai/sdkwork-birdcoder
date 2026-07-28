export type FileExplorerNameValidationReason =
  | 'empty'
  | 'dot-entry'
  | 'path-separator'
  | 'invalid-character'
  | 'too-long'
  | 'trailing-dot-or-space'
  | 'windows-reserved-name';

export type FileExplorerNameValidationResult =
  | {
      isValid: true;
      name: string;
    }
  | {
      isValid: false;
      reason: FileExplorerNameValidationReason;
    };

const WINDOWS_RESERVED_DEVICE_NAME_PATTERN =
  /^(?:con|prn|aux|nul|com(?:[1-9]|\u00b9|\u00b2|\u00b3)|lpt(?:[1-9]|\u00b9|\u00b2|\u00b3))(?:\..*)?$/iu;
const WINDOWS_INVALID_FILE_NAME_CHARACTER_PATTERN = /[<>:"|?*\u0000-\u001f]/u;
export const MAX_FILE_EXPLORER_NAME_UTF8_BYTES = 255;

export function validateFileExplorerNodeName(
  input: string,
): FileExplorerNameValidationResult {
  if (!input.trim()) {
    return { isValid: false, reason: 'empty' };
  }

  if (input === '.' || input === '..') {
    return { isValid: false, reason: 'dot-entry' };
  }

  if (/[\\/]/u.test(input)) {
    return { isValid: false, reason: 'path-separator' };
  }

  if (WINDOWS_INVALID_FILE_NAME_CHARACTER_PATTERN.test(input)) {
    return { isValid: false, reason: 'invalid-character' };
  }

  if (new TextEncoder().encode(input).byteLength > MAX_FILE_EXPLORER_NAME_UTF8_BYTES) {
    return { isValid: false, reason: 'too-long' };
  }

  if (input !== input.trim() || input.endsWith('.')) {
    return { isValid: false, reason: 'trailing-dot-or-space' };
  }

  if (WINDOWS_RESERVED_DEVICE_NAME_PATTERN.test(input)) {
    return { isValid: false, reason: 'windows-reserved-name' };
  }

  return { isValid: true, name: input };
}

export function normalizeFileExplorerNameForComparison(name: string): string {
  return name.normalize('NFC').toLowerCase();
}
