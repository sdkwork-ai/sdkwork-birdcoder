export const H5_COMMONS_VERSION = '0.1.0';

export interface H5CommonsUtils {
  formatDate: (date: Date) => string;
  formatNumber: (num: number) => string;
}

export function createCommonsUtils(): H5CommonsUtils {
  return {
    formatDate: (date: Date) => date.toISOString(),
    formatNumber: (num: number) => num.toLocaleString(),
  };
}

export { AppProvider, useAppContext } from './providers/AppProvider.tsx';
