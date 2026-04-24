import type { BirdCoderEntityStorageBinding } from './storageBindings.ts';
import {
  BIRDCODER_APP_TEMPLATE_INSTANTIATION_STORAGE_BINDING,
  BIRDCODER_APP_TEMPLATE_PRESET_STORAGE_BINDING,
  BIRDCODER_APP_TEMPLATE_STORAGE_BINDING,
  BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_STORAGE_BINDING,
  BIRDCODER_APP_TEMPLATE_VERSION_STORAGE_BINDING,
  BIRDCODER_PROMPT_ASSET_STORAGE_BINDING,
  BIRDCODER_PROMPT_ASSET_VERSION_STORAGE_BINDING,
  BIRDCODER_PROMPT_BUNDLE_ITEM_STORAGE_BINDING,
  BIRDCODER_PROMPT_BUNDLE_STORAGE_BINDING,
  BIRDCODER_PROMPT_EVALUATION_STORAGE_BINDING,
  BIRDCODER_PROMPT_RUN_STORAGE_BINDING,
  BIRDCODER_SAVED_PROMPT_ENTRY_STORAGE_BINDING,
  BIRDCODER_SKILL_BINDING_STORAGE_BINDING,
  BIRDCODER_SKILL_CAPABILITY_STORAGE_BINDING,
  BIRDCODER_SKILL_INSTALLATION_STORAGE_BINDING,
  BIRDCODER_SKILL_PACKAGE_STORAGE_BINDING,
  BIRDCODER_SKILL_RUNTIME_CONFIG_STORAGE_BINDING,
  BIRDCODER_SKILL_VERSION_STORAGE_BINDING,
} from './storageBindings.ts';

export const BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS = [
  'platform_rule',
  'organization_rule',
  'template_preset',
  'skill_binding',
  'project_context',
  'turn_prompt',
] as const;

export type BirdCoderPromptCompositionLayerId =
  (typeof BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS)[number];

export interface BirdCoderPromptCompositionLayerDefinition {
  id: BirdCoderPromptCompositionLayerId;
  order: number;
  description: string;
  sourceType: 'governance' | 'template' | 'skill' | 'context' | 'prompt';
}

export const BIRDCODER_PROMPT_COMPOSITION_LAYERS: readonly BirdCoderPromptCompositionLayerDefinition[] =
  [
    {
      id: 'platform_rule',
      order: 10,
      description: 'Kernel-level platform, safety, and product invariants.',
      sourceType: 'governance',
    },
    {
      id: 'organization_rule',
      order: 20,
      description: 'Organization, repository, and team conventions.',
      sourceType: 'governance',
    },
    {
      id: 'template_preset',
      order: 30,
      description: 'App template preset defaults and project bootstrap guidance.',
      sourceType: 'template',
    },
    {
      id: 'skill_binding',
      order: 40,
      description: 'Installed skill capabilities and runtime bindings.',
      sourceType: 'skill',
    },
    {
      id: 'project_context',
      order: 50,
      description: 'Workspace, project, files, docs, and execution evidence context.',
      sourceType: 'context',
    },
    {
      id: 'turn_prompt',
      order: 60,
      description: 'Current user turn prompt and transient task instruction.',
      sourceType: 'prompt',
    },
  ];

export interface BirdCoderPromptFragmentInput {
  fragmentId: string;
  layerId: BirdCoderPromptCompositionLayerId;
  content: string;
}

export interface BirdCoderResolvedPromptLayer {
  layerId: BirdCoderPromptCompositionLayerId;
  order: number;
  sourceType: BirdCoderPromptCompositionLayerDefinition['sourceType'];
  fragments: readonly BirdCoderPromptFragmentInput[];
  fragmentIds: readonly string[];
  content: string;
}

export interface BirdCoderPromptRuntimeAssemblyOptions {
  engineKey: string;
  modelId: string;
  fragments: readonly BirdCoderPromptFragmentInput[];
}

export interface BirdCoderPromptRuntimeAssembly {
  engineKey: string;
  modelId: string;
  layerIds: readonly BirdCoderPromptCompositionLayerId[];
  layers: readonly BirdCoderResolvedPromptLayer[];
  promptText: string;
}

export const BIRDCODER_SKILL_BINDING_SCOPE_TYPES = [
  'workspace',
  'project',
  'coding_session',
  'turn',
] as const;

export type BirdCoderSkillBindingScopeType =
  (typeof BIRDCODER_SKILL_BINDING_SCOPE_TYPES)[number];

export interface BirdCoderSkillBindingScopeDefinition {
  id: BirdCoderSkillBindingScopeType;
  description: string;
}

export const BIRDCODER_SKILL_BINDING_SCOPES: readonly BirdCoderSkillBindingScopeDefinition[] = [
  {
    id: 'workspace',
    description: 'Shared defaults and policies applied to all projects in a workspace.',
  },
  {
    id: 'project',
    description: 'Project-specific skill packs, workflows, and engineering conventions.',
  },
  {
    id: 'coding_session',
    description: 'Session-local bindings for one coding objective or engine runtime.',
  },
  {
    id: 'turn',
    description: 'Single-turn ephemeral bindings for one execution cycle only.',
  },
];

export interface BirdCoderSkillInstallationDescriptor {
  installationId: string;
  packageId: string;
  versionId: string;
  capabilityIds: readonly string[];
  config?: Readonly<Record<string, string>>;
}

export interface BirdCoderSkillBindingDescriptor {
  bindingId: string;
  installationId: string;
  scopeType: BirdCoderSkillBindingScopeType;
  scopeId: string;
  enabled?: boolean;
  capabilityIds?: readonly string[];
  config?: Readonly<Record<string, string>>;
}

export interface BirdCoderSkillRuntimeConfigDescriptor {
  runtimeConfigId: string;
  bindingId: string;
  values: Readonly<Record<string, string>>;
}

export interface BirdCoderSkillRuntimeSourceEntry {
  stage: 'installation' | 'binding' | 'runtime_config';
  id: string;
}

export interface BirdCoderResolvedSkillBinding {
  bindingId: string;
  installationId: string;
  packageId: string;
  versionId: string;
  scopeType: BirdCoderSkillBindingScopeType;
  scopeId: string;
  capabilityIds: readonly string[];
  resolvedConfig: Readonly<Record<string, string>>;
  sourceChain: readonly BirdCoderSkillRuntimeSourceEntry[];
}

export interface BirdCoderSkillRuntimeAssemblyOptions {
  installations: readonly BirdCoderSkillInstallationDescriptor[];
  bindings: readonly BirdCoderSkillBindingDescriptor[];
  runtimeConfigs?: readonly BirdCoderSkillRuntimeConfigDescriptor[];
}

export interface BirdCoderSkillRuntimeAssembly {
  scopeOrder: readonly BirdCoderSkillBindingScopeType[];
  resolvedBindings: readonly BirdCoderResolvedSkillBinding[];
  activeCapabilityIds: readonly string[];
}

export const BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_IDS = [
  'web',
  'desktop',
  'server',
  'fullstack',
  'plugin',
  'agent-tooling',
] as const;

export type BirdCoderAppTemplateTargetProfileId =
  (typeof BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_IDS)[number];

export interface BirdCoderAppTemplateTargetProfileDefinition {
  id: BirdCoderAppTemplateTargetProfileId;
  description: string;
  releaseFamilies: readonly string[];
}

export const BIRDCODER_APP_TEMPLATE_TARGET_PROFILES: readonly BirdCoderAppTemplateTargetProfileDefinition[] =
  [
    {
      id: 'web',
      description: 'Browser-first application template.',
      releaseFamilies: ['web'],
    },
    {
      id: 'desktop',
      description: 'Desktop-hosted application template.',
      releaseFamilies: ['desktop'],
    },
    {
      id: 'server',
      description: 'Server-only service or API template.',
      releaseFamilies: ['server', 'container', 'kubernetes'],
    },
    {
      id: 'fullstack',
      description: 'Combined web, desktop, and server delivery template.',
      releaseFamilies: ['web', 'desktop', 'server', 'container', 'kubernetes'],
    },
    {
      id: 'plugin',
      description: 'Extensible plugin or marketplace package template.',
      releaseFamilies: ['plugin'],
    },
    {
      id: 'agent-tooling',
      description: 'Agent runtime, workflow, or automation template.',
      releaseFamilies: ['server', 'container'],
    },
  ];

export interface BirdCoderAppTemplatePresetDescriptor {
  presetId: string;
  targetProfileId: BirdCoderAppTemplateTargetProfileId;
  promptSeed?: string;
  skillBindingIds?: readonly string[];
  workflowIds?: readonly string[];
  scaffoldFiles?: readonly string[];
  relativeOutputDir?: string;
}

export interface BirdCoderAppTemplateInstantiationRequest {
  instantiationId: string;
  workspaceId: string;
  projectId?: string;
  projectName: string;
  projectSlug: string;
  destinationRoot: string;
}

export interface BirdCoderAppTemplateRuntimeSourceEntry {
  stage: 'preset' | 'target_profile' | 'instantiation';
  id: string;
}

export interface BirdCoderAppTemplateRuntimeInstantiationOptions {
  templateId: string;
  templateVersionId: string;
  targetProfileId: BirdCoderAppTemplateTargetProfileId;
  preset: BirdCoderAppTemplatePresetDescriptor;
  request: BirdCoderAppTemplateInstantiationRequest;
}

export interface BirdCoderAppTemplateRuntimeInstantiation {
  instantiationId: string;
  templateId: string;
  templateVersionId: string;
  presetId: string;
  targetProfile: BirdCoderAppTemplateTargetProfileDefinition;
  releaseFamilies: readonly string[];
  outputDirectory: string;
  promptSeed?: string;
  skillBindingIds: readonly string[];
  workflowIds: readonly string[];
  scaffoldFiles: readonly string[];
  status: 'planned';
  sourceChain: readonly BirdCoderAppTemplateRuntimeSourceEntry[];
}

export const BIRDCODER_PROMPT_STORAGE_BINDINGS: readonly BirdCoderEntityStorageBinding[] = [
  BIRDCODER_SAVED_PROMPT_ENTRY_STORAGE_BINDING,
  BIRDCODER_PROMPT_ASSET_STORAGE_BINDING,
  BIRDCODER_PROMPT_ASSET_VERSION_STORAGE_BINDING,
  BIRDCODER_PROMPT_BUNDLE_STORAGE_BINDING,
  BIRDCODER_PROMPT_BUNDLE_ITEM_STORAGE_BINDING,
  BIRDCODER_PROMPT_RUN_STORAGE_BINDING,
  BIRDCODER_PROMPT_EVALUATION_STORAGE_BINDING,
];

export const BIRDCODER_SKILL_STORAGE_BINDINGS: readonly BirdCoderEntityStorageBinding[] = [
  BIRDCODER_SKILL_PACKAGE_STORAGE_BINDING,
  BIRDCODER_SKILL_VERSION_STORAGE_BINDING,
  BIRDCODER_SKILL_CAPABILITY_STORAGE_BINDING,
  BIRDCODER_SKILL_INSTALLATION_STORAGE_BINDING,
  BIRDCODER_SKILL_BINDING_STORAGE_BINDING,
  BIRDCODER_SKILL_RUNTIME_CONFIG_STORAGE_BINDING,
];

export const BIRDCODER_APP_TEMPLATE_STORAGE_BINDINGS: readonly BirdCoderEntityStorageBinding[] = [
  BIRDCODER_APP_TEMPLATE_STORAGE_BINDING,
  BIRDCODER_APP_TEMPLATE_VERSION_STORAGE_BINDING,
  BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_STORAGE_BINDING,
  BIRDCODER_APP_TEMPLATE_PRESET_STORAGE_BINDING,
  BIRDCODER_APP_TEMPLATE_INSTANTIATION_STORAGE_BINDING,
];
