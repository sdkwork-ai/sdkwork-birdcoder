export type VoiceRecognitionLanguageSetting = 'Auto' | 'Chinese' | 'English';

export interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

export interface BrowserSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: BrowserSpeechRecognitionAlternative;
}

export interface BrowserSpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<BrowserSpeechRecognitionResult>;
}

export interface BrowserSpeechRecognitionErrorEvent {
  readonly error: string;
}

export interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

export interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

export interface VoiceDictationShortcutEvent {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  shiftKey: boolean;
}

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

export function getBrowserSpeechRecognitionConstructor(
  browserWindow: Window | undefined = typeof window === 'undefined' ? undefined : window,
): BrowserSpeechRecognitionConstructor | null {
  if (!browserWindow) {
    return null;
  }

  const speechWindow = browserWindow as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function isBrowserSpeechRecognitionSupported(
  browserWindow?: Window,
): boolean {
  return getBrowserSpeechRecognitionConstructor(browserWindow) !== null;
}

export function isVoiceDictationShortcut(event: VoiceDictationShortcutEvent): boolean {
  return event.code === 'Space'
    && event.ctrlKey
    && event.shiftKey
    && !event.altKey
    && !event.metaKey
    && !event.repeat;
}

export function resolveVoiceRecognitionLocale(
  setting: VoiceRecognitionLanguageSetting,
  appLanguage: string,
  browserLanguage: string,
): string {
  if (setting === 'Chinese') {
    return 'zh-CN';
  }
  if (setting === 'English') {
    return 'en-US';
  }
  if (appLanguage === 'Chinese') {
    return 'zh-CN';
  }
  if (appLanguage === 'English') {
    return 'en-US';
  }

  return browserLanguage.trim() || 'en-US';
}
