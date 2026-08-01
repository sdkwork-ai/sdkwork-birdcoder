import { describe, expect, it } from 'vitest';

import type {
  WorkbenchCodeEngineDefinition,
  WorkbenchUnifiedCustomAgentModelDefinition,
} from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';
import {
  createWorkbenchUnifiedAgentModelSelectorCatalog,
  resolveWorkbenchUnifiedAgentModelOptionId,
} from './workbenchUnifiedAgentModelSelectorAdapter';

const catalogModel = {
  id: 'catalog-model',
  label: 'Catalog model',
  description: 'Built-in catalog model',
  vendor: 'openai',
  modelVendor: 'openai',
  providerId: 'provider.openai',
  bindingId: 'binding.provider.codex',
  defaultForEngine: true,
  source: 'agents-catalog',
} as const;

const engine: WorkbenchCodeEngineDefinition = {
  id: 'codex',
  agentId: 'agent.code-engine.codex',
  bindingId: 'binding.agent.codex',
  label: 'Codex',
  aliases: [],
  defaultModelId: catalogModel.id,
  models: [catalogModel],
  modelCatalog: [catalogModel],
  modelIds: [catalogModel.id],
  tier: 'official-sdk',
  defaultAccessModeId: '',
  accessModes: [],
};

const customConfiguration: WorkbenchUnifiedCustomAgentModelDefinition = {
  configurationId: 'model.custom.example.gpt-5-custom',
  modelId: 'gpt-5-custom',
  label: 'GPT-5 Custom',
  description: 'Unified custom model configuration',
  vendorCode: 'example',
  baseUrl: 'https://models.example.test/v1',
  supportedModelIds: ['gpt-5-custom', 'gpt-5-fast'],
  supportedProviderIds: ['codex', 'claude-code'],
  supportsMultimodal: true,
  apiKeyConfigured: true,
};

describe('workbench unified Agent model selector adapter', () => {
  it('projects every supported model from one configuration as a selectable option', () => {
    const catalog = createWorkbenchUnifiedAgentModelSelectorCatalog(
      [engine],
      [customConfiguration],
    );

    const customOptions = catalog.options.filter((option) => option.kind === 'custom');
    expect(customOptions).toMatchObject([
      {
        configurationId: customConfiguration.configurationId,
        modelId: 'gpt-5-custom',
        label: 'GPT-5 Custom',
      },
      {
        configurationId: customConfiguration.configurationId,
        modelId: 'gpt-5-fast',
        label: 'gpt-5-fast',
      },
    ]);

    const defaultOptionId = resolveWorkbenchUnifiedAgentModelOptionId(
      catalog,
      'codex',
      'gpt-5-custom',
    );
    const alternateOptionId = resolveWorkbenchUnifiedAgentModelOptionId(
      catalog,
      'claude-code',
      'gpt-5-fast',
    );
    expect(defaultOptionId).not.toBe('');
    expect(alternateOptionId).not.toBe('');
    expect(alternateOptionId).not.toBe(defaultOptionId);
  });
});
