export function resolveEnvironment() {
  return {
    mode: import.meta.env.MODE || 'development',
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
  };
}
