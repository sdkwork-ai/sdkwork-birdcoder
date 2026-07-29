import { describe, expect, it } from 'vitest';

import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from '../src/settings/appSettings.ts';
import {
  isVoiceDictationShortcut,
  resolveVoiceRecognitionLocale,
} from '../src/settings/voiceRecognition.ts';

describe('voice recognition settings', () => {
  it('resolves explicit and inherited recognition languages', () => {
    expect(resolveVoiceRecognitionLocale('Chinese', 'English', 'en-GB')).toBe('zh-CN');
    expect(resolveVoiceRecognitionLocale('English', 'Chinese', 'zh-CN')).toBe('en-US');
    expect(resolveVoiceRecognitionLocale('Auto', 'Chinese', 'en-GB')).toBe('zh-CN');
    expect(resolveVoiceRecognitionLocale('Auto', 'Auto-detect', 'en-GB')).toBe('en-GB');
    expect(resolveVoiceRecognitionLocale('Auto', 'Auto-detect', '')).toBe('en-US');
  });

  it('persists canonical voice settings and rejects unknown languages', () => {
    const configured = normalizeAppSettings({
      voiceContinuousListening: true,
      voiceShortcutEnabled: true,
      voiceRecognitionLanguage: 'Chinese',
    });
    expect(configured.voiceContinuousListening).toBe(true);
    expect(configured.voiceShortcutEnabled).toBe(true);
    expect(configured.voiceRecognitionLanguage).toBe('Chinese');

    const invalid = normalizeAppSettings({
      voiceRecognitionLanguage: 'Unknown' as 'Chinese',
    });
    expect(invalid.voiceRecognitionLanguage).toBe(DEFAULT_APP_SETTINGS.voiceRecognitionLanguage);
  });

  it('only accepts the non-repeating in-app Ctrl+Shift+Space shortcut', () => {
    const baseEvent = {
      altKey: false,
      code: 'Space',
      ctrlKey: true,
      metaKey: false,
      repeat: false,
      shiftKey: true,
    };

    expect(isVoiceDictationShortcut(baseEvent)).toBe(true);
    expect(isVoiceDictationShortcut({ ...baseEvent, repeat: true })).toBe(false);
    expect(isVoiceDictationShortcut({ ...baseEvent, metaKey: true })).toBe(false);
    expect(isVoiceDictationShortcut({ ...baseEvent, code: 'Enter' })).toBe(false);
  });
});
