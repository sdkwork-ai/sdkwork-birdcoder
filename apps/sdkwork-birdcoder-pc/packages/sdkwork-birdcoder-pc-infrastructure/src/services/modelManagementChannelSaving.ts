import { resolveBirdCoderModelRelayApiKey } from './agentModelRelayConfig.ts';
import type {
  AgentModelProviderId,
  IAgentModelConfigurationService,
} from './interfaces/IAgentModelConfigurationService.ts';
import type {
  IUserModelConfigService,
  UserModelChannel,
  UserModelChannelKind,
} from './interfaces/IUserModelConfigService.ts';

/**
 * Save-orchestration for the settings model-management panel.
 *
 * The settings panel must persist a channel locally (the client-local sqlite
 * store is the single source of truth), apply the configuration to the agents
 * runtime for every checked provider (the "real setting" step that makes the
 * channel usable by the engines right away), and persist the per-engine
 * bindings and default selection so the panel and the picker surfaces show the
 * same state. The shape mirrors the draft produced by the shared
 * `ModelAccessChannelConfigurationDialog` so callers can pass it through
 * unchanged.
 *
 * Saves serialize through a module-level chain: concurrent panel submissions
 * (double clicks, fast re-edits) must never interleave their revocation
 * sweeps, which could otherwise delete bindings written by a save that is
 * still in flight.
 */

let saveChain: Promise<unknown> = Promise.resolve();

export interface SaveModelManagementChannelOfferingDraft {
  vendorCode: string;
  vendorName: string;
  models: readonly {
    modelId: string;
    displayName: string;
    /** Token metadata preserved from catalog / import data. */
    contextTokens?: number;
    maxOutputTokens?: number;
    toolCallRounds?: number;
  }[];
}

/** Structural projection of `ModelAccessChannelConfigurationDraft`. */
export interface SaveModelManagementChannelDraft {
  channelId: string;
  kind: UserModelChannelKind;
  name: string;
  description: string;
  baseUrl: string;
  apiKey: string;
  apiKeyConfigured: boolean;
  offerings: readonly SaveModelManagementChannelOfferingDraft[];
  defaultVendorCode: string;
  defaultModelId: string;
  supportedAgentProviderIds: readonly string[];
}

export interface SaveModelManagementChannelInput {
  agentModelConfigurationService: IAgentModelConfigurationService;
  userModelConfigService: IUserModelConfigService;
  draft: SaveModelManagementChannelDraft;
  /** Provider ids the host can actually serve; out-of-list ids are dropped. */
  availableProviderIds: readonly string[];
  /** Apply-failure observer (defaults to `console.warn`). */
  onApplyWarning?: (providerId: string, error: unknown) => void;
}

export interface SaveModelManagementChannelResult {
  code: string;
  apiKeyConfigured: boolean;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values
    .map((value) => value.trim())
    .filter(Boolean))];
}

/**
 * Persists and applies a model access channel from the settings panel.
 *
 * The client-local persistence is authoritative and never skipped; applying
 * the configuration to the agents runtime is best-effort per provider (a
 * missing credential or an unavailable agents service must not block saving),
 * because the workbench re-applies the effective configuration on boot and
 * before every dispatched turn. The per-engine selection row is written even
 * when the apply round-trip fails so the workbench can self-heal the
 * configuration later.
 */
export async function saveModelManagementChannel(
  input: SaveModelManagementChannelInput,
): Promise<SaveModelManagementChannelResult> {
  const run = () => saveModelManagementChannelSerialized(input);
  const result = saveChain.then(run, run);
  saveChain = result.then(() => undefined, () => undefined);
  return result;
}

async function saveModelManagementChannelSerialized(
  input: SaveModelManagementChannelInput,
): Promise<SaveModelManagementChannelResult> {
  const {
    agentModelConfigurationService,
    userModelConfigService,
    draft,
    availableProviderIds,
  } = input;
  const onApplyWarning = input.onApplyWarning ?? ((providerId: string, error: unknown) => {
    console.warn(`Failed to apply model configuration for provider "${providerId}".`, error);
  });

  const code = draft.channelId.trim();
  if (!code) {
    throw new Error('A channel identity is required.');
  }
  const name = draft.name.trim();
  const baseUrl = draft.baseUrl.trim();
  const description = draft.description?.trim() ?? '';
  const defaultVendorCode = draft.defaultVendorCode.trim();
  const defaultModelId = draft.defaultModelId.trim();
  const apiKey = draft.apiKey.trim();
  const availableProviderIdSet = new Set(availableProviderIds);
  const supportedProviderIds = uniqueStrings(draft.supportedAgentProviderIds)
    .filter((providerId) => availableProviderIdSet.has(providerId));
  if (supportedProviderIds.length === 0) {
    throw new Error('The model configuration must support at least one Agent provider.');
  }

  // A freshly entered key wins; otherwise keep the stored credential so an
  // edit that leaves the key field empty does not drop the saved secret.
  // Official channels authenticate with the logged-in session auth token when
  // no explicit credential is provided, matching the workbench ensure path.
  // A failed credential read is a hard failure: proceeding without knowing
  // whether a key exists could silently mark the channel unconfigured and
  // drop the stored secret on the next panel save.
  const existingKey = apiKey
    ? null
    : (await userModelConfigService.getApiKey(code));
  const relayApiKey = draft.kind === 'official' && !apiKey && !existingKey
    ? resolveBirdCoderModelRelayApiKey()
    : '';
  const effectiveApiKey = apiKey || existingKey || relayApiKey || undefined;
  const apiKeyConfigured = Boolean(effectiveApiKey) || draft.apiKeyConfigured;

  const localChannel: UserModelChannel = {
    code,
    name,
    kind: draft.kind,
    baseUrl,
    description,
    defaultVendorCode,
    defaultModelId,
    apiKeyConfigured,
    sortOrder: null,
    offerings: draft.offerings.map((offering) => ({
      vendorCode: offering.vendorCode.trim(),
      vendorName: offering.vendorName.trim() || offering.vendorCode.trim(),
      models: offering.models.map((model) => ({
        modelId: model.modelId.trim(),
        displayName: model.displayName.trim() || model.modelId.trim(),
        supportsMultimodal: false,
        // Token metadata survives round-trips so imported channels keep the
        // context/output window info the gateway catalog provided.
        ...(model.contextTokens == null ? {} : { contextTokens: model.contextTokens }),
        ...(model.maxOutputTokens == null ? {} : { maxOutputTokens: model.maxOutputTokens }),
        ...(model.toolCallRounds == null ? {} : { toolCallRounds: model.toolCallRounds }),
      })),
    })),
  };
  await userModelConfigService.upsertChannel(localChannel);
  if (apiKey) {
    await userModelConfigService.upsertApiKey(code, apiKey);
  }

  // Revoke bindings and selections for providers that were bound before but
  // are no longer in the saved provider set. A narrowed set must be reflected
  // in the edit dialog, the picker, and the engine bindings instead of
  // resurrecting stale rows on the next load. Best-effort: a store hiccup
  // must not block the save.
  const normalizedCode = code.trim().toLowerCase();
  const existingBindings = await userModelConfigService.listEngineConfigs().catch(() => []);
  for (const binding of existingBindings) {
    if (binding.channelCode.trim().toLowerCase() === normalizedCode
      && !supportedProviderIds.includes(binding.engineId)) {
      await userModelConfigService.deleteEngineConfig(binding.engineId, code);
    }
  }
  const existingSelections = await userModelConfigService.listEngineSelections().catch(() => []);
  for (const selection of existingSelections) {
    if (selection.channelCode.trim().toLowerCase() === normalizedCode
      && !supportedProviderIds.includes(selection.engineId)) {
      await userModelConfigService.deleteEngineSelection(selection.engineId);
    }
  }

  const supportedModelIds = uniqueStrings(draft.offerings.flatMap(
    (offering) => offering.models.map((model) => model.modelId),
  ));
  const supportedProviderIdsAsProviderIds = supportedProviderIds as AgentModelProviderId[];
  const appliedAt = new Date().toISOString();

  // Apply to the agents runtime and record the per-engine binding only for
  // providers that actually accepted the configuration.
  for (const providerId of supportedProviderIds) {
    try {
      await agentModelConfigurationService.apply({
        configurationId: code,
        engineId: providerId as AgentModelProviderId,
        vendorCode: defaultVendorCode,
        baseUrl,
        ...(effectiveApiKey ? { apiKey: effectiveApiKey } : {}),
        defaultModelId,
        supportedModelIds,
        supportedProviderIds: supportedProviderIdsAsProviderIds,
        supportsMultimodal: false,
      });
    } catch (error) {
      onApplyWarning(providerId, error);
      continue;
    }
    await userModelConfigService.upsertEngineConfig({
      engineId: providerId,
      channelCode: code,
      vendorCode: defaultVendorCode,
      baseUrl,
      defaultModelId,
      supportedModelIds,
      supportedProviderIds: supportedProviderIdsAsProviderIds,
      supportsMultimodal: false,
      apiKeyConfigured,
      appliedAt,
    });
  }

  // Persist the default selection for the first checked provider so the
  // engine-bindings panel shows the pairing and restarts restore it. An
  // engine that already selected a different channel keeps its choice: the
  // saved configuration stays available through the picker, but a panel save
  // must not hijack the user's active selection. The selection is written even
  // when the apply round-trip failed: the workbench re-applies the effective
  // configuration on boot and before every turn.
  const selectionEngineId = supportedProviderIds[0];
  if (selectionEngineId) {
    const existingSelection = await userModelConfigService
      .getEngineSelection(selectionEngineId)
      .catch(() => null);
    if (!existingSelection
      || existingSelection.channelCode.trim().toLowerCase() === normalizedCode) {
      await userModelConfigService.upsertEngineSelection({
        engineId: selectionEngineId,
        channelCode: code,
        modelId: defaultModelId,
      });
      try {
        await agentModelConfigurationService.applySelection({
          configurationId: code,
          engineId: selectionEngineId as AgentModelProviderId,
          modelId: defaultModelId,
        });
      } catch (error) {
        onApplyWarning(selectionEngineId, error);
      }
    }
  }

  return { code, apiKeyConfigured };
}
