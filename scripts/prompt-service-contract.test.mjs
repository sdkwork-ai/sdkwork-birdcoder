import assert from 'node:assert/strict';
import fs from 'node:fs';

const promptServicePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/PromptsSdkPromptService.ts',
  import.meta.url,
);
const promptClientPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/promptsSdkClient.ts',
  import.meta.url,
);
const promptPortPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IPromptService.ts',
  import.meta.url,
);
const chatPresentationStatePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/chat/persistence.ts',
  import.meta.url,
);
const retiredProviderServicePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedPromptService.ts',
  import.meta.url,
);

const promptServiceSource = fs.readFileSync(promptServicePath, 'utf8');
const promptClientSource = fs.readFileSync(promptClientPath, 'utf8');
const promptPortSource = fs.readFileSync(promptPortPath, 'utf8');
const chatPresentationStateSource = fs.readFileSync(chatPresentationStatePath, 'utf8');

assert.match(
  promptServiceSource,
  /from '@sdkwork\/prompts-app-sdk'/u,
  'Saved Prompt persistence must use the sdkwork-prompts generated App SDK.',
);
assert.match(
  promptServiceSource,
  /client\.prompts\.templateVersions\.(?:list|create)/u,
  'Prompt template version operations must use the generated templateVersions module.',
);
assert.doesNotMatch(
  promptServiceSource,
  /templates\.versions|Repository|localStorage|fallback|mirror|projection|dualWrite|dual-write/iu,
  'The Prompt SDK adapter must not recreate a local store, transport fallback, or persistence copy.',
);
assert.match(
  promptClientSource,
  /createClient\(\{[\s\S]*tokenManager:/u,
  'The Prompts App SDK client must be created with the application TokenManager.',
);
assert.doesNotMatch(
  promptPortSource,
  /SessionPromptHistory|recordSessionPromptUsage|useCount/u,
  'The Prompt service port must not own Agents Session input history or synthetic usage counters.',
);
assert.match(
  chatPresentationStateSource,
  /sessionPromptHistoryMemory = new Map/u,
  'Composer recall must be explicit presentation-only memory.',
);
assert.doesNotMatch(
  chatPresentationStateSource,
  /createBirdCoderStorageProvider|agentSessionPromptEntryRepository|localStorage|getStoredJson|setStoredJson/u,
  'Composer recall must not write BirdCoder local persistence.',
);
assert.equal(
  fs.existsSync(retiredProviderServicePath),
  false,
  'The BirdCoder provider-backed Prompt persistence adapter must be retired.',
);

const templates = [];
const versionsByTemplate = new Map();
let templateSequence = 0;
let versionSequence = 0;
let versionCreateCount = 0;

const fakeClient = {
  prompts: {
    templates: {
      async list() {
        return {
          items: templates.map((template) => ({ ...template })),
          pageInfo: { mode: 'cursor', hasMore: false, nextCursor: null },
        };
      },
      async create(body) {
        templateSequence += 1;
        const template = {
          ...body,
          id: String(templateSequence),
          latest_version_id: null,
          status: 'draft',
          updated_at: '2026-07-23T00:00:00.000Z',
        };
        templates.unshift(template);
        versionsByTemplate.set(template.id, []);
        return { ...template };
      },
      async get(templateId) {
        const template = templates.find((candidate) => candidate.id === templateId);
        assert.ok(template, `missing fake template ${templateId}`);
        return { ...template };
      },
      async update(templateId, body) {
        const template = templates.find((candidate) => candidate.id === templateId);
        assert.ok(template, `missing fake template ${templateId}`);
        Object.assign(template, body, { updated_at: '2026-07-23T00:01:00.000Z' });
        return { ...template };
      },
    },
    templateVersions: {
      async list(templateId) {
        return {
          items: (versionsByTemplate.get(templateId) ?? []).map((version) => ({ ...version })),
          pageInfo: { mode: 'cursor', hasMore: false, nextCursor: null },
        };
      },
      async create(templateId, body) {
        versionSequence += 1;
        versionCreateCount += 1;
        const version = {
          ...body,
          id: String(versionSequence),
          template_id: templateId,
          status: 'draft',
        };
        versionsByTemplate.get(templateId).unshift(version);
        const template = templates.find((candidate) => candidate.id === templateId);
        assert.ok(template, `missing fake template ${templateId}`);
        template.latest_version_id = version.id;
        return { ...version };
      },
    },
  },
};

const cacheBust = `?t=${Date.now()}`;
const { PromptsSdkPromptService } = await import(`${promptServicePath.href}${cacheBust}`);
const promptService = new PromptsSdkPromptService(fakeClient);

const saved = await promptService.saveSavedPrompt('  summarize release notes  ');
assert.equal(saved.text, 'summarize release notes');
assert.equal(versionCreateCount, 1, 'first save must create exactly one content version.');

await promptService.saveSavedPrompt('summarize release notes');
assert.equal(
  versionCreateCount,
  1,
  're-saving unchanged content must not misuse Prompt Version as an input-usage counter.',
);
assert.deepEqual(
  (await promptService.listSavedPrompts()).map((entry) => entry.text),
  ['summarize release notes'],
  'Saved Prompt reads must resolve content through sdkwork-prompts template versions.',
);

await promptService.deleteSavedPrompt('summarize release notes');
assert.deepEqual(
  await promptService.listSavedPrompts(),
  [],
  'Saved Prompt deletion must archive the sdkwork-prompts template.',
);
await assert.rejects(
  () => promptService.saveSavedPrompt('   '),
  /text is required/u,
  'Saved Prompt writes must reject empty content at the service boundary.',
);

console.log('prompt service contract passed.');
