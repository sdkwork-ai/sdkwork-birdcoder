import { enTranslation } from './en/index.ts';
import { zhTranslation } from './zh/index.ts';

export {
  buildLocaleResource,
  defineLocaleModule,
  flattenLocaleKeys,
  type LocaleLeaf,
  type LocaleModule,
  type LocaleTree,
} from './resource.ts';

export function buildBirdCoderLocaleResources() {
  return {
    en: {
      translation: enTranslation,
    },
    zh: {
      translation: zhTranslation,
    },
  } as const;
}
