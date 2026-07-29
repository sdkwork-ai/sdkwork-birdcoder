import type { ComposerProviderCapabilityItem } from '@sdkwork/birdcoder-pc-workbench';

export type PluginSettingsTab = 'plugins' | 'mcp' | 'skills';

export interface PluginSettingsTabDefinition {
  count: number;
  id: PluginSettingsTab;
  label: string;
}

export interface PluginSettingsCapabilityItem {
  capability: ComposerProviderCapabilityItem;
  kind: 'plugin' | 'skill';
}
