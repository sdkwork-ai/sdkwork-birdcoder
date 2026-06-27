import { useState } from 'react';
import { resolveBirdCoderLegalLinks } from '@sdkwork/birdcoder-h5-commons';
import { clearBirdCoderSessionRecord } from '@sdkwork/birdcoder-h5-core';
import {
  BirdCoderSettingsProvider,
  BIRDCODER_H5_ENGINE_OPTIONS,
  BIRDCODER_H5_LANGUAGE_OPTIONS,
  BIRDCODER_H5_THEME_OPTIONS,
  useBirdCoderSettings,
  type BirdCoderEnginePreference,
  type BirdCoderLanguagePreference,
  type BirdCoderThemePreference,
} from '../state/settingsState';

const BIRDCODER_H5_APP_VERSION = '0.1.0';
const BIRDCODER_H5_STORAGE_PREFIX = 'sdkwork.birdcoder.';

const ENGINE_LABELS: Record<BirdCoderEnginePreference, string> = {
  webview: 'WebView',
  servo: 'Servo',
  cef: 'CEF',
};

const THEME_LABELS: Record<BirdCoderThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const LANGUAGE_LABELS: Record<BirdCoderLanguagePreference, string> = {
  en: 'English',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
};

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function OptionRow<T extends string>({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: T;
  current: T;
  onSelect: (value: T) => void;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="flex w-full items-center justify-between py-2 text-sm"
    >
      <span className={selected ? 'font-medium text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
      <span
        className={[
          'h-4 w-4 rounded-full border',
          selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
        ].join(' ')}
      />
    </button>
  );
}

function SettingsContent() {
  const { state, setEngine, setTheme, setLanguage, reset } = useBirdCoderSettings();
  const legal = resolveBirdCoderLegalLinks();
  const [cacheCleared, setCacheCleared] = useState(false);

  function clearBirdCoderCache() {
    if (typeof window !== 'undefined') {
      // Clear non-token BirdCoder keys from localStorage (settings, caches).
      if (window.localStorage) {
        const keysToRemove = Object.keys(window.localStorage).filter(
          (key) => key.startsWith(BIRDCODER_H5_STORAGE_PREFIX),
        );
        keysToRemove.forEach((key) => window.localStorage.removeItem(key));
      }
      // Clear non-token BirdCoder keys from sessionStorage.
      if (window.sessionStorage) {
        const sessionKeysToRemove = Object.keys(window.sessionStorage).filter(
          (key) => key.startsWith(BIRDCODER_H5_STORAGE_PREFIX),
        );
        sessionKeysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
      }
    }
    reset();
    setCacheCleared(true);
  }

  async function signOut() {
    // Use the secure storage adapter to properly clear the session token
    // from sessionStorage. This is fail-safe: even if the adapter throws,
    // we still redirect to the login page.
    try {
      await clearBirdCoderSessionRecord();
    } catch {
      // Best-effort cleanup; redirect proceeds regardless.
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 px-4 py-6">
      <div>
        <h2 className="text-base font-semibold">Settings</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage rendering engine, appearance, language, and account preferences.
        </p>
      </div>

      <SettingsSection
        title="Engine"
        description="Select the rendering engine used to load the BirdCoder workspace."
      >
        <div className="divide-y divide-border">
          {BIRDCODER_H5_ENGINE_OPTIONS.map((option) => (
            <OptionRow
              key={option}
              label={ENGINE_LABELS[option]}
              value={option}
              current={state.engine}
              onSelect={setEngine}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Theme"
        description="Choose how BirdCoder follows light, dark, or system appearance."
      >
        <div className="divide-y divide-border">
          {BIRDCODER_H5_THEME_OPTIONS.map((option) => (
            <OptionRow
              key={option}
              label={THEME_LABELS[option]}
              value={option}
              current={state.theme}
              onSelect={setTheme}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Language"
        description="Set the interface language for the mobile renderer."
      >
        <div className="divide-y divide-border">
          {BIRDCODER_H5_LANGUAGE_OPTIONS.map((option) => (
            <OptionRow
              key={option}
              label={LANGUAGE_LABELS[option]}
              value={option}
              current={state.language}
              onSelect={setLanguage}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Account" description="Session and local data management.">
        <div className="flex flex-col gap-2 text-sm">
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-border px-3 py-2 text-left font-medium text-foreground"
          >
            Log out
          </button>
          <button
            type="button"
            onClick={clearBirdCoderCache}
            className="rounded-lg border border-border px-3 py-2 text-left font-medium text-foreground"
          >
            Clear cache
          </button>
          {cacheCleared ? (
            <p className="text-xs text-muted-foreground">Local cache cleared.</p>
          ) : null}
          <div className="mt-1 flex items-center justify-between text-muted-foreground">
            <span>Version</span>
            <span>{BIRDCODER_H5_APP_VERSION}</span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="About" description="Privacy, support, and legal resources.">
        <ul className="space-y-3 text-sm">
          <li>
            <a
              href={legal.officialWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              sdkwork.dev
            </a>
          </li>
          <li>
            <a
              href={legal.privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Privacy policy
            </a>
          </li>
          <li>
            <a
              href={legal.termsOfServiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Terms of service
            </a>
          </li>
          <li>
            <a
              href={legal.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Support
            </a>
          </li>
        </ul>
      </SettingsSection>
    </div>
  );
}

export function SettingsPage() {
  return (
    <BirdCoderSettingsProvider>
      <SettingsContent />
    </BirdCoderSettingsProvider>
  );
}
