import assert from 'node:assert/strict';

import {
  BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_IDS,
  BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import {
  assembleBirdCoderPromptRuntime,
  instantiateBirdCoderAppTemplateRuntime,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/promptSkillTemplateRuntime.ts';

assert.throws(
  () =>
    assembleBirdCoderPromptRuntime({
      fragments: [],
    } as unknown as Parameters<typeof assembleBirdCoderPromptRuntime>[0]),
  /engine key/i,
  'prompt runtime assembly must reject missing engine keys.',
);
assert.throws(
  () =>
    assembleBirdCoderPromptRuntime({
      engineKey: 'codex',
      fragments: [],
    } as unknown as Parameters<typeof assembleBirdCoderPromptRuntime>[0]),
  /model id/i,
  'prompt runtime assembly must reject missing model ids.',
);

const promptRuntime = assembleBirdCoderPromptRuntime({
  engineKey: 'codex',
  modelId: 'gpt-5.4',
  fragments: [
    {
      fragmentId: 'turn-1',
      layerId: 'turn_prompt',
      content: 'Close Step 16 CP16-2 without reopening frozen Code or Studio boundaries.',
    },
    {
      fragmentId: 'platform-1',
      layerId: 'platform_rule',
      content: 'Platform invariants stay enforced.',
    },
    {
      fragmentId: 'project-1',
      layerId: 'project_context',
      content: 'Workspace birdcoder-project includes release and docs evidence.',
    },
    {
      fragmentId: 'skill-1',
      layerId: 'skills_context',
      content: 'Installed skills: release-governance, template-audit.',
    },
    {
      fragmentId: 'template-1',
      layerId: 'template_preset',
      content: 'Agent-tooling preset defaults to governed release notes.',
    },
    {
      fragmentId: 'organization-1',
      layerId: 'organization_rule',
      content: 'Repository contracts must be auditable and deterministic.',
    },
  ],
});

assert.deepEqual(
  promptRuntime.layers.map((layer) => layer.layerId),
  BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS,
);
assert.deepEqual(promptRuntime.layerIds, BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS);
assert.deepEqual(promptRuntime.layers.map((layer) => layer.fragmentIds), [
  ['platform-1'],
  ['organization-1'],
  ['template-1'],
  ['skill-1'],
  ['project-1'],
  ['turn-1'],
]);
assert.equal(
  promptRuntime.promptText,
  [
    'Platform invariants stay enforced.',
    'Repository contracts must be auditable and deterministic.',
    'Agent-tooling preset defaults to governed release notes.',
    'Installed skills: release-governance, template-audit.',
    'Workspace birdcoder-project includes release and docs evidence.',
    'Close Step 16 CP16-2 without reopening frozen Code or Studio boundaries.',
  ].join('\n\n'),
);

const geminiPromptRuntime = assembleBirdCoderPromptRuntime({
  engineKey: 'gemini',
  modelId: 'gemini-2.5-pro',
  fragments: promptRuntime.layers.flatMap((layer) =>
    layer.fragments.map((fragment) => ({
      fragmentId: fragment.fragmentId,
      layerId: fragment.layerId,
      content: fragment.content,
    })),
  ),
});

assert.deepEqual(
  geminiPromptRuntime.layers.map((layer) => layer.layerId),
  promptRuntime.layers.map((layer) => layer.layerId),
);

const templateRuntime = instantiateBirdCoderAppTemplateRuntime({
  templateId: 'template.agent-tooling',
  templateVersionId: 'template.agent-tooling@2026-04-12',
  targetProfileId: 'agent-tooling',
  preset: {
    presetId: 'preset.agent-governed',
    targetProfileId: 'agent-tooling',
    promptSeed: 'Use governed release assets and auditable prompt assembly.',
    skillInstallationIds: ['installation-typescript', 'installation-release'],
    workflowIds: ['release-governance', 'skill-installation'],
    scaffoldFiles: ['README.md', 'src/index.ts', '.github/workflows/release.yml'],
    relativeOutputDir: 'generated/{{projectSlug}}',
  },
  request: {
    instantiationId: 'instantiation-1',
    workspaceId: '100000000000000101',
    projectId: 'project-birdcoder',
    projectName: 'BirdCoder Agent Tooling',
    projectSlug: 'birdcoder-agent-tooling',
    destinationRoot: 'D:\\workspace\\birdcoder',
  },
});

assert.deepEqual(BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_IDS.includes('agent-tooling'), true);
assert.equal(templateRuntime.targetProfile.id, 'agent-tooling');
assert.deepEqual(templateRuntime.releaseFamilies, ['server', 'container']);
assert.equal(
  templateRuntime.outputDirectory,
  'D:/workspace/birdcoder/generated/birdcoder-agent-tooling',
);
assert.equal(templateRuntime.status, 'planned');
assert.equal(
  templateRuntime.promptSeed,
  'Use governed release assets and auditable prompt assembly.',
);
assert.deepEqual(templateRuntime.skillInstallationIds, [
  'installation-typescript',
  'installation-release',
]);
assert.deepEqual(templateRuntime.workflowIds, ['release-governance', 'skill-installation']);
assert.deepEqual(
  templateRuntime.sourceChain.map((entry) => entry.stage),
  ['preset', 'target_profile', 'instantiation'],
);

console.log('prompt and template runtime assembly contract passed.');
