import { useState } from 'react';
import { Button } from '@sdkwork/birdcoder-ui-shell';
import { useTranslation } from 'react-i18next';
import { SettingsProps } from './types';

export function MCPSettings(_props: SettingsProps) {
  const { t } = useTranslation();
  const [servers, setServers] = useState([
    { id: 1, name: 'Local Python Environment', url: 'http://localhost:8000', status: 'connected' },
    { id: 2, name: 'Database Connector', url: 'http://localhost:8001', status: 'disconnected' }
  ]);
  const [isAdding, setIsAdding] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');

  const handleAddServer = () => {
    if (newServerName && newServerUrl) {
      setServers([...servers, { id: Date.now(), name: newServerName, url: newServerUrl, status: 'disconnected' }]);
      setIsAdding(false);
      setNewServerName('');
      setNewServerUrl('');
    }
  };

  const handleRemoveServer = (id: number) => {
    setServers(servers.filter(s => s.id !== id));
  };

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '0ms' }}>
        <h1 className="text-2xl font-semibold text-white mb-8">{t('settings.mcp.title')}</h1>
        
        <div className="mb-6">
          <p className="text-gray-400 text-sm">{t('settings.mcp.description')}</p>
        </div>

        <div className="space-y-4 mb-8">
          {servers.map(server => (
            <div key={server.id} className="bg-[#18181b] rounded-xl border border-white/10 p-4 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${server.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div>
                  <div className="text-white font-medium">{server.name}</div>
                  <div className="text-sm text-gray-500">
                    {server.url} · {t(server.status === 'connected' ? 'common.connected' : 'common.disconnected')}
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
                <input type="text" value={newServerName} onChange={e => setNewServerName(e.target.value)} className="w-full bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" placeholder="e.g., My Custom Tool" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('settings.mcp.serverUrl')}</label>
                <input type="text" value={newServerUrl} onChange={e => setNewServerUrl(e.target.value)} className="w-full bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" placeholder="http://localhost:8000" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="ghost" onClick={() => setIsAdding(false)}>{t('common.cancel')}</Button>
                <Button variant="default" onClick={handleAddServer} disabled={!newServerName || !newServerUrl}>{t('settings.mcp.addServer')}</Button>
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
