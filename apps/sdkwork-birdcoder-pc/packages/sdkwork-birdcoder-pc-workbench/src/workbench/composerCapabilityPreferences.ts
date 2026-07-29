import type {
  ComposerProviderCapabilities,
  ComposerProviderCapabilityItem,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export type ComposerCapabilityPreferenceKind = 'plugin' | 'skill';

export function getComposerCapabilityPreferenceId(
  kind: ComposerCapabilityPreferenceKind,
  item: Pick<ComposerProviderCapabilityItem, 'id' | 'source'>,
): string {
  return `${kind}:${item.source ?? 'remote'}:${encodeURIComponent(item.id.trim())}`;
}

export function applyDisabledComposerCapabilities(
  capabilities: ComposerProviderCapabilities,
  disabledCapabilityIds: readonly string[],
): ComposerProviderCapabilities {
  if (disabledCapabilityIds.length === 0) {
    return capabilities;
  }

  const disabledIds = new Set(disabledCapabilityIds);
  const apply = (
    kind: ComposerCapabilityPreferenceKind,
    item: ComposerProviderCapabilityItem,
  ): ComposerProviderCapabilityItem => disabledIds.has(
    getComposerCapabilityPreferenceId(kind, item),
  )
    ? { ...item, enabled: false }
    : item;

  return {
    ...capabilities,
    plugins: capabilities.plugins.map((item) => apply('plugin', item)),
    skills: capabilities.skills.map((item) => apply('skill', item)),
  };
}
