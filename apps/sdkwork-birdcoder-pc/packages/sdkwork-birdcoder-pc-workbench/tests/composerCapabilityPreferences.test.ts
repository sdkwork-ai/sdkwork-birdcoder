import { describe, expect, it } from 'vitest';

import {
  applyDisabledComposerCapabilities,
  getComposerCapabilityPreferenceId,
} from '../src/workbench/composerCapabilityPreferences.ts';
import {
  MAX_COMPOSER_CAPABILITY_ID_LENGTH,
  MAX_DISABLED_COMPOSER_CAPABILITY_IDS,
  normalizeWorkbenchPreferences,
} from '../src/workbench/preferences.ts';

describe('composer capability preferences', () => {
  it('normalizes, de-duplicates, and bounds persisted capability ids', () => {
    const normalized = normalizeWorkbenchPreferences({
      disabledComposerCapabilityIds: [
        ' plugin:local:visualize ',
        'plugin:local:visualize',
        '',
        42,
        ...Array.from(
          { length: MAX_DISABLED_COMPOSER_CAPABILITY_IDS + 5 },
          (_, index) => `skill:remote:${index}-${'x'.repeat(MAX_COMPOSER_CAPABILITY_ID_LENGTH)}`,
        ),
      ],
    });

    expect(normalized.disabledComposerCapabilityIds).toHaveLength(
      MAX_DISABLED_COMPOSER_CAPABILITY_IDS,
    );
    expect(normalized.disabledComposerCapabilityIds[0]).toBe('plugin:local:visualize');
    expect(normalized.disabledComposerCapabilityIds[1]).toHaveLength(
      MAX_COMPOSER_CAPABILITY_ID_LENGTH,
    );
  });

  it('creates source-aware ids and disables only the selected capability', () => {
    const localPlugin = {
      description: 'Local plugin',
      enabled: true,
      id: 'visualize/local',
      name: 'Visualize',
      source: 'local' as const,
      status: 'enabled' as const,
      targetRef: 'plugin://visualize',
    };
    const remotePlugin = {
      ...localPlugin,
      description: 'Remote MCP server',
      source: 'remote' as const,
      targetRef: 'mcp://visualize',
    };
    const disabledId = getComposerCapabilityPreferenceId('plugin', localPlugin);
    const capabilities = applyDisabledComposerCapabilities({
      errors: [],
      plugins: [localPlugin, remotePlugin],
      skills: [],
    }, [disabledId]);

    expect(disabledId).toBe('plugin:local:visualize%2Flocal');
    expect(capabilities.plugins[0]?.enabled).toBe(false);
    expect(capabilities.plugins[1]?.enabled).toBe(true);
    expect(localPlugin.enabled).toBe(true);
  });
});
