import { invoke } from '@tauri-apps/api/core';

export function readSecureAppSession(): Promise<string | null> {
  return invoke<string | null>('secure_app_session_read');
}

export function writeSecureAppSession(raw: string): Promise<void> {
  return invoke<void>('secure_app_session_write', { raw });
}

export function deleteSecureAppSession(): Promise<void> {
  return invoke<void>('secure_app_session_delete');
}
