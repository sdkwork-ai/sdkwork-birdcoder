import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const mcpSettingsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/MCPSettings.tsx',
);
const environmentSettingsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/EnvironmentSettings.tsx',
);
const archivedSettingsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/ArchivedSettings.tsx',
);
const configSettingsSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/ConfigSettings.tsx',
);
const configSettingsImportSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/appSettingsImport.ts',
);
const terminalLaunchSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/terminal/sdkworkTerminalLaunch.ts',
);
const codeTerminalPanelSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodeTerminalIntegrationPanel.tsx',
);
const studioTerminalPanelSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioTerminalIntegrationPanel.tsx',
);
const appMainBodySource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppMainBody.tsx',
);
const dockerDefaultEnv = readText('deployments/docker/profiles/default.env');

assert.doesNotMatch(
  mcpSettingsSource,
  /Local Python Environment|Database Connector|status:\s*'connected'/u,
  'MCP settings must not ship demo servers or fake connected status.',
);
assert.match(
  mcpSettingsSource,
  /usePersistedState/u,
  'MCP settings must persist user-defined servers locally instead of hardcoded fixtures.',
);
assert.match(
  mcpSettingsSource,
  /settings\.mcp\.notConnected/u,
  'MCP settings must disclose honest disconnected state until runtime health checks exist.',
);
assert.match(
  mcpSettingsSource,
  /function createMcpServerId\(\): string[\s\S]*globalThis\.crypto\?\.randomUUID[\s\S]*Math\.random\(\)/u,
  'MCP settings must remain usable in older WebViews that do not expose crypto.randomUUID.',
);
assert.doesNotMatch(
  mcpSettingsSource,
  /�|锟/u,
  'MCP settings must not render corrupted encoding artifacts in server status text.',
);
assert.match(
  readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPageDialogs.tsx'),
  /studio\.debugConfigurationUnavailable/u,
  'Studio debug dialog must use localized honest-unavailable copy.',
);
assert.match(
  readText('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageDialogs.tsx'),
  /studio\.debugConfigurationUnavailable/u,
  'Code debug dialog must use localized honest-unavailable copy.',
);
assert.doesNotMatch(
  environmentSettingsSource,
  /API_KEY=your_api_key_here|In a real app, this would save/u,
  'Environment settings must not ship demo env content or fake save comments.',
);
assert.match(
  environmentSettingsSource,
  /usePersistedState/u,
  'Environment settings must persist variables locally instead of hardcoded fixtures.',
);
assert.match(
  environmentSettingsSource,
  /settings\.environment\.variablesSavedLocally/u,
  'Environment settings must disclose local-only persistence until .env sync ships.',
);
assert.doesNotMatch(
  archivedSettingsSource,
  /Fix authentication bug|Implement dark mode|Refactor database connection|useState\(\[\s*\{/u,
  'Archived settings must not ship demo archived sessions or fake restore/delete flows.',
);
assert.match(
  archivedSettingsSource,
  /settings\.archived\.runtimeUnavailable/u,
  'Archived settings must disclose runtime wiring is pending.',
);
assert.doesNotMatch(
  configSettingsSource,
  /Opening config\.toml|configurationImported'\), 'success'|href="#"/u,
  'Config settings must not report fake config-file opening/import success or render placeholder links.',
);
assert.match(
  configSettingsSource,
  /disabled[\s\S]*settings\.config\.configFileUnavailable/u,
  'Config settings must disable config.toml editing and disclose that runtime support is unavailable.',
);
assert.match(
  configSettingsSource,
  /settings\.config\.governanceScopeDescription/u,
  'Config settings must disclose that command governance does not intercept interactive PTY input.',
);
assert.match(
  configSettingsSource,
  /parseAppSettingsImport\(file\)[\s\S]*updateSettings\(imported\.settings\)/u,
  'Config import must parse and atomically apply validated settings before reporting success.',
);
assert.match(
  configSettingsImportSource,
  /MAX_APP_SETTINGS_IMPORT_BYTES[\s\S]*JSON\.parse[\s\S]*normalizeImportedValue/u,
  'Config import must enforce a size budget, parse JSON, and validate recognized setting values.',
);
assert.match(
  terminalLaunchSource,
  /evaluateCommand\(normalizedCommand\)[\s\S]*saveAuditRecord\([\s\S]*if \(!decision\.allowed\)/u,
  'IDE-launched terminal commands must be evaluated and audited before a process launch plan is returned.',
);
for (const [surface, source] of [
  ['code', codeTerminalPanelSource],
  ['studio', studioTerminalPanelSource],
  ['app', appMainBodySource],
]) {
  assert.match(
    source,
    /useToast[\s\S]*onLaunchBlocked|handle(?:Terminal)?LaunchBlocked[\s\S]*addToast/u,
    `${surface} terminal surface must surface blocked command feedback instead of failing silently.`,
  );
}
assert.match(
  dockerDefaultEnv,
  /SDKWORK_BIRDCODER_REALTIME_BACKEND=memory/u,
  'Docker default env must default realtime backend to memory for single-replica deployments.',
);
assert.match(
  dockerDefaultEnv,
  /SDKWORK_BIRDCODER_REDIS_ENABLED=false/u,
  'Docker default env must keep Redis disabled until HA overlay is applied.',
);

console.log('settings surface honesty contract passed.');
