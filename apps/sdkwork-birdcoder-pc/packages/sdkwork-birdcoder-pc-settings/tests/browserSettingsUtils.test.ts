import { describe, expect, it } from 'vitest';
import { DEFAULT_INTEGRATION_PREFERENCES } from '@sdkwork/birdcoder-pc-workbench';
import {
  clearBirdCoderBrowserData,
  parseBrowserSettingsImport,
} from '../src/components/integration-settings/browserSettingsUtils';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('browser settings utilities', () => {
  it('imports only supported browser settings', () => {
    const imported = parseBrowserSettingsImport({
      browserEnabled: false,
      browserWebLinkOpenTarget: 'birdcoder',
      computerAnyAppEnabled: true,
      serverBaseUrl: 'https://unsafe.example',
    }, DEFAULT_INTEGRATION_PREFERENCES);

    expect(imported.browserEnabled).toBe(false);
    expect(imported.browserWebLinkOpenTarget).toBe('birdcoder');
    expect(imported).not.toHaveProperty('computerAnyAppEnabled');
    expect(imported).not.toHaveProperty('serverBaseUrl');
  });

  it('clears only BirdCoder browser-scoped records', () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    localStorage.setItem('sdkwork-birdcoder.browser.history', '[]');
    localStorage.setItem('sdkwork-birdcoder.ui.v1:browser:downloads', '[]');
    localStorage.setItem('sdkwork-birdcoder.ui.v1:settings:app', '{}');
    sessionStorage.setItem('sdkwork-birdcoder.browser.cache', '{}');
    sessionStorage.setItem('birdcoder.auth.session', 'keep');

    expect(clearBirdCoderBrowserData([localStorage, sessionStorage])).toBe(3);
    expect(localStorage.getItem('sdkwork-birdcoder.ui.v1:settings:app')).toBe('{}');
    expect(sessionStorage.getItem('birdcoder.auth.session')).toBe('keep');
  });
});
