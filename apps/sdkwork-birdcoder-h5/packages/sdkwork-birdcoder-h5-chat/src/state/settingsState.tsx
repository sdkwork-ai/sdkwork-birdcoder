/**
 * BirdCoder H5 settings state.
 *
 * Phone-first settings preferences for the H5 mobile renderer: rendering engine,
 * theme, and language. State is owned by a React Context backed by `useReducer`
 * and persisted to `localStorage` so Capacitor and browser modes share one
 * preference store.
 *
 * The shape mirrors the PC settings preferences so future cross-surface
 * sharing through `@sdkwork/birdcoder-settings-shared` remains a drop-in.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

/** Rendering engine preference surfaced in the H5 settings screen. */
export type BirdCoderEnginePreference = 'webview' | 'servo' | 'cef';

/** Theme preference resolved against the mobile host theme adapter. */
export type BirdCoderThemePreference = 'dark' | 'light' | 'system';

/** Language preference aligned with the mobile i18n catalog. */
export type BirdCoderLanguagePreference = 'en' | 'zh-Hans' | 'zh-Hant';

export interface BirdCoderSettingsState {
  engine: BirdCoderEnginePreference;
  theme: BirdCoderThemePreference;
  language: BirdCoderLanguagePreference;
}

export type BirdCoderSettingsAction =
  | { type: 'setEngine'; engine: BirdCoderEnginePreference }
  | { type: 'setTheme'; theme: BirdCoderThemePreference }
  | { type: 'setLanguage'; language: BirdCoderLanguagePreference }
  | { type: 'reset' };

const SETTINGS_STORAGE_KEY = 'sdkwork.birdcoder.h5.settings.v1';

export const BIRDCODER_H5_SETTINGS_DEFAULT: BirdCoderSettingsState = {
  engine: 'webview',
  theme: 'system',
  language: 'en',
};

export const BIRDCODER_H5_ENGINE_OPTIONS: readonly BirdCoderEnginePreference[] = [
  'webview',
  'servo',
  'cef',
];

export const BIRDCODER_H5_THEME_OPTIONS: readonly BirdCoderThemePreference[] = [
  'system',
  'light',
  'dark',
];

export const BIRDCODER_H5_LANGUAGE_OPTIONS: readonly BirdCoderLanguagePreference[] = [
  'en',
  'zh-Hans',
  'zh-Hant',
];

function settingsReducer(
  state: BirdCoderSettingsState,
  action: BirdCoderSettingsAction,
): BirdCoderSettingsState {
  switch (action.type) {
    case 'setEngine':
      return { ...state, engine: action.engine };
    case 'setTheme':
      return { ...state, theme: action.theme };
    case 'setLanguage':
      return { ...state, language: action.language };
    case 'reset':
      return BIRDCODER_H5_SETTINGS_DEFAULT;
    default:
      return state;
  }
}

function readPersistedSettings(): BirdCoderSettingsState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return BIRDCODER_H5_SETTINGS_DEFAULT;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return BIRDCODER_H5_SETTINGS_DEFAULT;
    }
    const parsed = JSON.parse(raw) as Partial<BirdCoderSettingsState>;
    return {
      engine: BIRDCODER_H5_ENGINE_OPTIONS.includes(parsed.engine as BirdCoderEnginePreference)
        ? (parsed.engine as BirdCoderEnginePreference)
        : BIRDCODER_H5_SETTINGS_DEFAULT.engine,
      theme: BIRDCODER_H5_THEME_OPTIONS.includes(parsed.theme as BirdCoderThemePreference)
        ? (parsed.theme as BirdCoderThemePreference)
        : BIRDCODER_H5_SETTINGS_DEFAULT.theme,
      language: BIRDCODER_H5_LANGUAGE_OPTIONS.includes(
        parsed.language as BirdCoderLanguagePreference,
      )
        ? (parsed.language as BirdCoderLanguagePreference)
        : BIRDCODER_H5_SETTINGS_DEFAULT.language,
    };
  } catch {
    return BIRDCODER_H5_SETTINGS_DEFAULT;
  }
}

function persistSettings(state: BirdCoderSettingsState): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable in private mode or embedded WebView;
    // preferences remain in-memory for the current session.
  }
}

export interface BirdCoderSettingsContextValue {
  state: BirdCoderSettingsState;
  setEngine: (engine: BirdCoderEnginePreference) => void;
  setTheme: (theme: BirdCoderThemePreference) => void;
  setLanguage: (language: BirdCoderLanguagePreference) => void;
  reset: () => void;
}

const BirdCoderSettingsContext = createContext<BirdCoderSettingsContextValue | null>(null);

export interface BirdCoderSettingsProviderProps {
  children: ReactNode;
  initialState?: BirdCoderSettingsState;
}

export function BirdCoderSettingsProvider({
  children,
  initialState,
}: BirdCoderSettingsProviderProps) {
  const [state, dispatch] = useReducer(
    settingsReducer,
    initialState ?? readPersistedSettings(),
  );

  useEffect(() => {
    persistSettings(state);
  }, [state]);

  const value = useMemo<BirdCoderSettingsContextValue>(
    () => ({
      state,
      setEngine: (engine) => dispatch({ type: 'setEngine', engine }),
      setTheme: (theme) => dispatch({ type: 'setTheme', theme }),
      setLanguage: (language) => dispatch({ type: 'setLanguage', language }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [state],
  );

  return (
    <BirdCoderSettingsContext.Provider value={value}>
      {children}
    </BirdCoderSettingsContext.Provider>
  );
}

export function useBirdCoderSettings(): BirdCoderSettingsContextValue {
  const value = useContext(BirdCoderSettingsContext);
  if (!value) {
    throw new Error(
      'useBirdCoderSettings must be used within a BirdCoderSettingsProvider.',
    );
  }
  return value;
}
