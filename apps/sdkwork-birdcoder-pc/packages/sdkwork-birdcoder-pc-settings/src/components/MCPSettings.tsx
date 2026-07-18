import { useEffect, useState } from 'react';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import { usePersistedState } from '@sdkwork/birdcoder-pc-workbench';
import { useTranslation } from 'react-i18next';
import { SettingsProps } from './types';

type McpServerRecord = {
  id: string;
  name: string;
  url: string;
};

const EMPTY_MCP_SERVERS: McpServerRecord[] = [];

function createMcpServerId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === 'function') {
    return randomUuid.call(globalThis.crypto);
  }

  return `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeMcpServers(value: unknown): McpServerRecord[] {
  if (!Array.isArray(value)) {
    return EMPTY_MCP_SERVERS;
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    if (!name || !url) {
      return [];
    }

    const id =
      typeof record.id === 'string' && record.id.trim().length > 0
        ? record.id.trim()
        : createMcpServerId();

    return [{ id, name, url }];
  });
}

export function MCPSettings(_props: SettingsProps) {
  const { t } = useTranslation();
  const [servers, setServers, isHydrated] = usePersistedState<McpServerRecord[]>(
    'settings',
    'mcp-servers',
    EMPTY_MCP_SERVERS,
  );
  const [isAdding, setIsAdding] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const normalized = normalizeMcpServers(servers);
    if (normalized.length !== servers.length || normalized.some((server, index) => server.id !== servers[index]?.id)) {
      setServers(normalized);
    }
  }, [isHydrated, servers, setServers]);

  const handleAddServer = () => {
    const name = newServerName.trim();
    const url = newServerUrl.trim();
    if (!name || !url) {
      return;
    }

    setServers([
      ...servers,
      {
        id: createMcpServerId(),
        name,
        url,
      },
    ]);
    setIsAdding(false);
    setNewServerName('');
    setNewServerUrl('');
  };

  const handleRemoveServer = (id: string) => {
    setServers(servers.filter((server) => server.id !== id));
  };

  if (!isHydrated) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '0ms' }}>
        <h1 className="text-2xl font-semibold text-white mb-8">{t('settings.mcp.title')}</h1>
        
        <div className="mb-6">
          <p className="text-gray-400 text-sm">{t('settings.mcp.description')}</p>
          <p className="text-gray-500 text-xs mt-2">{t('settings.mcp.connectionStatusUnavailable')}</p>
        </div>

        <div className="space-y-4 mb-8">
          {servers.map((server) => (
            <div key={server.id} className="bg-[#18181b] rounded-xl border border-white/10 p-4 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-gray-500" aria-hidden="true" />
                <div>
                  <div className="text-white font-medium">{server.name}</div>
                  <div className="text-sm text-gray-500">
                    {server.url} - {t('settings.mcp.notConnected')}
                  </div>
                </div>
              </div>
              <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveServer(server.id)}>
                {t('common.remove')}
              </Button>
            </div>
          ))}
          {servers.length === 0 && (
            <div className="bg-[#18181b]/50 rounded-xl border border-white/5 p-8 text-center text-gray-500">
              {t('settings.mcp.noServersConfigured')}
            </div>
          )}
        </div>

        {isAdding ? (
          <div className="bg-[#18181b] rounded-xl border border-white/10 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-white font-medium mb-4">{t('settings.mcp.addNewServer')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('settings.mcp.serverName')}</label>
                <input type="text" value={newServerName} onChange={(e) => setNewServerName(e.target.value)} className="w-full bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" placeholder="e.g., My Custom Tool" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('settings.mcp.serverUrl')}</label>
                <input type="text" value={newServerUrl} onChange={(e) => setNewServerUrl(e.target.value)} className="w-full bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" placeholder="http://localhost:8000" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="ghost" onClick={() => setIsAdding(false)}>{t('common.cancel')}</Button>
                <Button variant="default" onClick={handleAddServer} disabled={!newServerName.trim() || !newServerUrl.trim()}>{t('settings.mcp.addServer')}</Button>
              </div>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setIsAdding(true)}>
            {t('settings.mcp.addNewServer')}
          </Button>
        )}
      </div>
    </div>
  );
}
