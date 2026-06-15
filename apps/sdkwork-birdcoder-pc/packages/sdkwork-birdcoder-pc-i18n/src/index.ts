import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  buildBirdCoderLocaleResources,
  buildLocaleResource,
  defineLocaleModule,
  flattenLocaleKeys,
} from './locales/index.ts';

const resources = buildBirdCoderLocaleResources();

export function resolveBirdCoderLanguagePreference(
  preference?: string | null,
  browserLanguage =
    typeof navigator !== 'undefined' && typeof navigator.language === 'string'
      ? navigator.language
      : 'en',
): 'en' | 'zh' {
  if (preference === 'English') {
    return 'en';
  }

  if (preference === 'Chinese') {
    return 'zh';
  }

  return browserLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: resolveBirdCoderLanguagePreference(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });
}

export function ensureBirdCoderI18n() {
  return i18n;
}

export {
  buildBirdCoderLocaleResources,
  buildLocaleResource,
  defineLocaleModule,
  flattenLocaleKeys,
};

export default i18n;
