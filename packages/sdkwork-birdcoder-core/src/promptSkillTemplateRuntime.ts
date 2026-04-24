import {
  BIRDCODER_APP_TEMPLATE_TARGET_PROFILES,
  BIRDCODER_PROMPT_COMPOSITION_LAYERS,
  BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS,
  BIRDCODER_SKILL_BINDING_SCOPE_TYPES,
  type BirdCoderAppTemplateRuntimeInstantiation,
  type BirdCoderAppTemplateRuntimeInstantiationOptions,
  type BirdCoderPromptFragmentInput,
  type BirdCoderPromptRuntimeAssembly,
  type BirdCoderPromptRuntimeAssemblyOptions,
  type BirdCoderResolvedPromptLayer,
  type BirdCoderResolvedSkillBinding,
  type BirdCoderSkillBindingDescriptor,
  type BirdCoderSkillInstallationDescriptor,
  type BirdCoderSkillRuntimeAssembly,
  type BirdCoderSkillRuntimeAssemblyOptions,
  type BirdCoderSkillRuntimeConfigDescriptor,
} from '@sdkwork/birdcoder-types';

function normalizeStringList(values: readonly string[] | undefined): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values ?? []) {
    const candidate = String(value ?? '').trim();
    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

function mergeConfigRecords(
  ...records: Array<Readonly<Record<string, string>> | undefined>
): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const record of records) {
    if (!record) {
      continue;
    }

    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = String(key ?? '').trim();
      const normalizedValue = String(value ?? '').trim();
      if (!normalizedKey || !normalizedValue) {
        continue;
      }

      merged[normalizedKey] = normalizedValue;
    }
  }

  return merged;
}

function normalizePortablePath(value: string): string {
  const normalized = String(value ?? '').trim().replace(/\\/g, '/');
  if (!normalized) {
    return '';
  }

  const [prefix, ...segments] = normalized.split('/');
  const compactSegments = segments.filter((segment) => segment.length > 0);
  return compactSegments.length > 0 ? `${prefix}/${compactSegments.join('/')}` : prefix;
}

function joinPortablePath(basePath: string, relativePath: string): string {
  const normalizedBase = normalizePortablePath(basePath).replace(/\/+$/g, '');
  const normalizedRelative = normalizePortablePath(relativePath).replace(/^\/+/g, '');

  if (!normalizedBase) {
    return normalizedRelative;
  }

  if (!normalizedRelative) {
    return normalizedBase;
  }

  return `${normalizedBase}/${normalizedRelative}`;
}

function applyTemplateVariables(
  template: string | undefined,
  values: Record<string, string>,
): string {
  return String(template ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, token) => {
    const replacement = values[token];
    return replacement === undefined ? '' : replacement;
  });
}

function toPromptLayerContent(fragments: readonly BirdCoderPromptFragmentInput[]): string {
  return fragments
    .map((fragment) => String(fragment.content ?? '').trim())
    .filter((content) => content.length > 0)
    .join('\n');
}

function sortBindingsByScope(
  bindings: readonly BirdCoderSkillBindingDescriptor[],
): BirdCoderSkillBindingDescriptor[] {
  const scopeOrder = new Map(
    BIRDCODER_SKILL_BINDING_SCOPE_TYPES.map((scope, index) => [scope, index]),
  );

  return [...bindings].sort((left, right) => {
    const leftOrder = scopeOrder.get(left.scopeType) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = scopeOrder.get(right.scopeType) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.bindingId.localeCompare(right.bindingId);
  });
}

export function assembleBirdCoderPromptRuntime(
  options: BirdCoderPromptRuntimeAssemblyOptions,
): BirdCoderPromptRuntimeAssembly {
  const engineKey = String(options.engineKey ?? '').trim();
  if (!engineKey) {
    throw new Error('Prompt runtime assembly requires an explicit engine key.');
  }

  const modelId = String(options.modelId ?? '').trim();
  if (!modelId) {
    throw new Error(`Prompt runtime assembly requires an explicit model id for engine "${engineKey}".`);
  }

  const fragmentsByLayer = new Map<string, BirdCoderPromptFragmentInput[]>();

  for (const fragment of options.fragments ?? []) {
    const layerId = String(fragment.layerId ?? '').trim();
    if (!layerId || !BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS.includes(layerId as never)) {
      continue;
    }

    const nextFragments = fragmentsByLayer.get(layerId) ?? [];
    nextFragments.push({
      fragmentId: String(fragment.fragmentId ?? '').trim(),
      layerId: fragment.layerId,
      content: String(fragment.content ?? ''),
    });
    fragmentsByLayer.set(layerId, nextFragments);
  }

  const layers: BirdCoderResolvedPromptLayer[] = BIRDCODER_PROMPT_COMPOSITION_LAYERS.map(
    (layerDefinition) => {
      const fragments = fragmentsByLayer.get(layerDefinition.id) ?? [];

      return {
        layerId: layerDefinition.id,
        order: layerDefinition.order,
        sourceType: layerDefinition.sourceType,
        fragments,
        fragmentIds: fragments.map((fragment) => fragment.fragmentId),
        content: toPromptLayerContent(fragments),
      };
    },
  );

  return {
    engineKey,
    modelId,
    layerIds: [...BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS],
    layers,
    promptText: layers
      .map((layer) => layer.content)
      .filter((content) => content.length > 0)
      .join('\n\n'),
  };
}

export function assembleBirdCoderSkillRuntime(
  options: BirdCoderSkillRuntimeAssemblyOptions,
): BirdCoderSkillRuntimeAssembly {
  const installationsById = new Map<string, BirdCoderSkillInstallationDescriptor>();
  for (const installation of options.installations ?? []) {
    installationsById.set(installation.installationId, installation);
  }

  const runtimeConfigsByBindingId = new Map<string, BirdCoderSkillRuntimeConfigDescriptor[]>();
  for (const runtimeConfig of options.runtimeConfigs ?? []) {
    const nextConfigs = runtimeConfigsByBindingId.get(runtimeConfig.bindingId) ?? [];
    nextConfigs.push(runtimeConfig);
    runtimeConfigsByBindingId.set(runtimeConfig.bindingId, nextConfigs);
  }

  const resolvedBindings: BirdCoderResolvedSkillBinding[] = [];
  for (const binding of sortBindingsByScope(options.bindings ?? [])) {
    if (binding.enabled === false) {
      continue;
    }

    const installation = installationsById.get(binding.installationId);
    if (!installation) {
      continue;
    }

    const installationCapabilityIds = normalizeStringList(installation.capabilityIds);
    const bindingCapabilityIds = normalizeStringList(
      binding.capabilityIds?.length ? binding.capabilityIds : installationCapabilityIds,
    ).filter((capabilityId) => installationCapabilityIds.includes(capabilityId));

    if (bindingCapabilityIds.length === 0) {
      continue;
    }

    const runtimeConfigs = runtimeConfigsByBindingId.get(binding.bindingId) ?? [];
    const resolvedConfig = mergeConfigRecords(
      installation.config,
      binding.config,
      ...runtimeConfigs.map((runtimeConfig) => runtimeConfig.values),
    );

    resolvedBindings.push({
      bindingId: binding.bindingId,
      installationId: installation.installationId,
      packageId: installation.packageId,
      versionId: installation.versionId,
      scopeType: binding.scopeType,
      scopeId: binding.scopeId,
      capabilityIds: bindingCapabilityIds,
      resolvedConfig,
      sourceChain: [
        {
          stage: 'installation',
          id: installation.installationId,
        },
        {
          stage: 'binding',
          id: binding.bindingId,
        },
        ...runtimeConfigs.map((runtimeConfig) => ({
          stage: 'runtime_config' as const,
          id: runtimeConfig.runtimeConfigId,
        })),
      ],
    });
  }

  return {
    scopeOrder: [...BIRDCODER_SKILL_BINDING_SCOPE_TYPES],
    resolvedBindings,
    activeCapabilityIds: normalizeStringList(
      resolvedBindings.flatMap((binding) => binding.capabilityIds),
    ),
  };
}

export function instantiateBirdCoderAppTemplateRuntime(
  options: BirdCoderAppTemplateRuntimeInstantiationOptions,
): BirdCoderAppTemplateRuntimeInstantiation {
  const targetProfile = BIRDCODER_APP_TEMPLATE_TARGET_PROFILES.find(
    (profile) => profile.id === options.targetProfileId,
  );

  if (!targetProfile) {
    throw new Error(`Unknown app template target profile: ${options.targetProfileId}`);
  }

  if (options.preset.targetProfileId !== options.targetProfileId) {
    throw new Error(
      `Template preset ${options.preset.presetId} does not match target profile ${options.targetProfileId}.`,
    );
  }

  const relativeOutputDir = applyTemplateVariables(options.preset.relativeOutputDir, {
    projectName: options.request.projectName,
    projectSlug: options.request.projectSlug,
    workspaceId: options.request.workspaceId,
  });

  return {
    instantiationId: options.request.instantiationId,
    templateId: options.templateId,
    templateVersionId: options.templateVersionId,
    presetId: options.preset.presetId,
    targetProfile,
    releaseFamilies: [...targetProfile.releaseFamilies],
    outputDirectory: joinPortablePath(options.request.destinationRoot, relativeOutputDir),
    promptSeed: options.preset.promptSeed,
    skillBindingIds: normalizeStringList(options.preset.skillBindingIds),
    workflowIds: normalizeStringList(options.preset.workflowIds),
    scaffoldFiles: normalizeStringList(options.preset.scaffoldFiles),
    status: 'planned',
    sourceChain: [
      {
        stage: 'preset',
        id: options.preset.presetId,
      },
      {
        stage: 'target_profile',
        id: targetProfile.id,
      },
      {
        stage: 'instantiation',
        id: options.request.instantiationId,
      },
    ],
  };
}
