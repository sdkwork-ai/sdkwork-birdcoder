import { isBirdCoderTauriRuntime, resolveBirdCoderTauriInvoke } from './tauriRuntime.ts';

export interface LocalPluginSkillSnapshot {
  id: string;
  name: string;
  description?: string | null;
  path: string;
}

export interface LocalPluginSnapshot {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  rootPath: string;
  manifestPath: string;
  status: 'manifest-only' | 'typed-local-provider' | 'process-adapter' | 'unavailable';
  skills: LocalPluginSkillSnapshot[];
  mcpServers: string[];
}

export interface LocalPluginLoadErrorSnapshot {
  providerId: string;
  path?: string | null;
  kind: string;
  message: string;
}

export interface LocalPluginCatalogSnapshot {
  providerId: string;
  plugins: LocalPluginSnapshot[];
  errors: LocalPluginLoadErrorSnapshot[];
}

export interface LocalPluginCatalogRuntime {
  discover(providerId: string): Promise<LocalPluginCatalogSnapshot>;
}

export function createBirdCoderLocalPluginCatalogRuntime(): LocalPluginCatalogRuntime {
  return {
    async discover(providerId) {
      if (!(await isBirdCoderTauriRuntime())) {
        return { providerId, plugins: [], errors: [] };
      }
      const invoke = await resolveBirdCoderTauriInvoke();
      if (!invoke) {
        return { providerId, plugins: [], errors: [{ providerId, kind: 'source-unavailable', message: 'Desktop plugin host is unavailable.' }] };
      }
      return invoke<LocalPluginCatalogSnapshot>('local_plugin_catalog_discover', {
        providerId,
        roots: [],
      });
    },
  };
}
