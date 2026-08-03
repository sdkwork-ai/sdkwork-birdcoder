import type {
  AgentModelProviderId,
  IAgentModelConfigurationService,
  IUserModelConfigService,
  ModelAccessCatalogChannel,
  ModelAccessChannelKind,
  UserModelChannel,
  UserModelEngineSelection,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import {
  resolveBirdCoderModelRelayApiKey,
  resolveBirdCoderModelRelayBaseUrl,
  resolveBirdCoderVendorProtocol,
  type BirdCoderModelVendorProtocol,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

/**
 * Workbench-owned model configuration target resolution and application
 * guarantees.
 *
 * A selected model access configuration must drive every new session and
 * every sent message. The kernel keeps applied configurations in memory and
 * the external provider CLIs read their own config files, so the workbench
 * re-applies the engine's effective configuration (idempotently, with the
 * current auth token) at boot, on selection change, and right before a turn
 * is dispatched. When the user has not selected any channel, the engine
 * falls back to the BirdCoder official relay (`api.birdcoder.com`) with the
 * logged-in auth token as the API key.
 */

/** The auto-default official relay channel identity used when nothing is selected. */
export const BIRDOODER_OFFICIAL_RELAY_CHANNEL_CODE = 'official.birdcoder';

export interface WorkbenchEngineModelConfigTarget {
  channelCode: string;
  channelKind: ModelAccessChannelKind;
  vendorCode: string;
  vendorName: string;
  baseUrl: string;
  modelId: string;
  defaultModelId: string;
  supportedModelIds: string[];
  supportedProviderIds: AgentModelProviderId[];
  inputContextTokens?: number;
  outputContextTokens?: number;
  toolCallRounds?: number;
  supportsMultimodal?: boolean;
  /** True when no channel is selected and the official relay is the default. */
  isOfficialRelayDefault: boolean;
  protocol: BirdCoderModelVendorProtocol;
}

export interface ResolveWorkbenchEngineModelConfigTargetInput {
  engineId: string;
  /** `resolveWorkbenchCodeEngineSelectedModelAccessChannelId(...)` result. */
  preferenceChannelId: string;
  /** `resolveWorkbenchCodeEngineSelectedModelId(...)` result (may be empty). */
  selectedModelId: string;
  engineDefaultModelId: string;
  /** Model ids published by the engine definition. */
  engineModelIds: readonly string[];
  /** Vendor code of the engine's default model (openai/anthropic/google). */
  engineVendorCode: string;
  localChannels: readonly UserModelChannel[];
  catalogChannels: readonly ModelAccessCatalogChannel[];
  /** Client-local saved selection (engine selection row), when available. */
  storedSelection?: UserModelEngineSelection | null;
  agentProviderIds: readonly string[];
}

function normalizeChannelCode(value: string | null | undefined): string {
  return String(value ?? '').trim().slice(0, 160);
}

function normalizeModelId(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

function uniqueStrings(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

function findLocalChannel(
  channelCode: string,
  channels: readonly UserModelChannel[],
): UserModelChannel | undefined {
  const normalized = channelCode.trim().toLowerCase();
  return channels.find((channel) => (
    channel.code.trim().toLowerCase() === normalized
  ));
}

function findCatalogChannel(
  channelCode: string,
  channels: readonly ModelAccessCatalogChannel[],
): ModelAccessCatalogChannel | undefined {
  const normalized = channelCode.trim().toLowerCase();
  return channels.find((channel) => (
    channel.code.trim().toLowerCase() === normalized
    || channel.id.trim().toLowerCase() === normalized
  ));
}

function targetFromLocalChannel(
  channel: UserModelChannel,
  modelId: string,
  agentProviderIds: readonly string[],
): WorkbenchEngineModelConfigTarget | undefined {
  const vendorCode = channel.defaultVendorCode.trim() || 'openai';
  const channelBaseUrl = channel.baseUrl.trim();
  if (channel.kind !== 'official' && !channelBaseUrl) {
    // A relay/custom channel without an endpoint is unusable; it must not
    // silently fall back to the official relay. Skip it so resolution
    // continues to the next candidate or the official default.
    return undefined;
  }
  return {
    channelCode: channel.code.trim(),
    channelKind: channel.kind,
    vendorCode,
    vendorName: channel.name.trim(),
    baseUrl: channelBaseUrl,
    modelId,
    defaultModelId: channel.defaultModelId.trim() || modelId,
    supportedModelIds: uniqueStrings(channel.offerings.flatMap(
      (offering) => offering.models.map((model) => model.modelId),
    )),
    supportedProviderIds: [...agentProviderIds] as AgentModelProviderId[],
    inputContextTokens: undefined,
    outputContextTokens: undefined,
    toolCallRounds: undefined,
    supportsMultimodal: false,
    isOfficialRelayDefault: false,
    protocol: resolveBirdCoderVendorProtocol(vendorCode),
  };
}

function targetFromCatalogChannel(
  channel: ModelAccessCatalogChannel,
  modelId: string,
  agentProviderIds: readonly string[],
  resolveRelayBaseUrl: (protocol?: BirdCoderModelVendorProtocol | null) => string,
): WorkbenchEngineModelConfigTarget | undefined {
  const vendorCode = channel.defaultVendorCode?.trim() || 'openai';
  const protocol = resolveBirdCoderVendorProtocol(vendorCode);
  const isOfficialRelay = channel.kind === 'official';
  const channelBaseUrl = channel.baseUrl?.trim() ?? '';
  if (!isOfficialRelay && !channelBaseUrl) {
    // A relay/custom channel without an endpoint is unusable; it must not
    // silently fall back to the official relay. Skip it so resolution
    // continues to the next candidate or the official default.
    return undefined;
  }
  const supportedModelIds = uniqueStrings(channel.offerings.flatMap(
    (offering) => offering.models.map((model) => model.modelId),
  ));
  const supportedProviderIds = channel.supportedAgentProviderIds.length > 0
    ? uniqueStrings(channel.supportedAgentProviderIds)
    : [...agentProviderIds];
  return {
    channelCode: channel.code.trim() || channel.id.trim(),
    channelKind: channel.kind,
    vendorCode,
    vendorName: channel.name.trim(),
    // Official platform channels route through the BirdCoder relay; relay and
    // custom channels keep their own endpoint.
    baseUrl: isOfficialRelay
      ? resolveRelayBaseUrl(protocol)
      : channelBaseUrl,
    modelId,
    defaultModelId: channel.defaultModelId?.trim() || modelId,
    supportedModelIds,
    supportedProviderIds: supportedProviderIds as AgentModelProviderId[],
    isOfficialRelayDefault: false,
    protocol,
  };
}

function createOfficialRelayDefaultTarget(
  input: ResolveWorkbenchEngineModelConfigTargetInput,
  resolveRelayBaseUrl: (protocol?: BirdCoderModelVendorProtocol | null) => string,
): WorkbenchEngineModelConfigTarget {
  const vendorCode = input.engineVendorCode.trim() || 'openai';
  const protocol = resolveBirdCoderVendorProtocol(vendorCode);
  const modelId = normalizeModelId(input.selectedModelId) || input.engineDefaultModelId;
  // Prefer a real official catalog channel so the applied configuration id
  // matches what the picker/composer footer display. The catalog keeps
  // official channels first; fall back to the synthetic platform identity
  // when no catalog data is available (offline/fresh boot).
  const preferredOfficialChannel = findPreferredOfficialChannel(input, modelId);
  const channelCode = preferredOfficialChannel?.code.trim()
    || preferredOfficialChannel?.id.trim()
    || BIRDOODER_OFFICIAL_RELAY_CHANNEL_CODE;
  const supportedModelIds = preferredOfficialChannel
    ? uniqueStrings(preferredOfficialChannel.offerings.flatMap(
      (offering) => offering.models.map((model) => model.modelId),
    ))
    : uniqueStrings([...input.engineModelIds, modelId]);
  if (!supportedModelIds.includes(modelId)) {
    supportedModelIds.push(modelId);
  }
  return {
    channelCode,
    channelKind: 'official',
    vendorCode,
    vendorName: 'SDKWork BirdCoder',
    baseUrl: resolveRelayBaseUrl(protocol),
    modelId,
    defaultModelId: input.engineDefaultModelId || modelId,
    supportedModelIds,
    supportedProviderIds: [...input.agentProviderIds] as AgentModelProviderId[],
    isOfficialRelayDefault: true,
    protocol,
  };
}

function findPreferredOfficialChannel(
  input: ResolveWorkbenchEngineModelConfigTargetInput,
  modelId: string,
): ModelAccessCatalogChannel | undefined {
  const officialChannels = input.catalogChannels.filter(
    (channel) => channel.kind === 'official',
  );
  const normalizedModelId = modelId.trim().toLowerCase();
  const engineVendorCode = input.engineVendorCode.trim().toLowerCase();
  const offersModel = (channel: ModelAccessCatalogChannel) => channel.offerings.some(
    (offering) => offering.models.some((model) => (
      model.modelId.trim().toLowerCase() === normalizedModelId
    )),
  );
  const vendorMatches = (channel: ModelAccessCatalogChannel) => (
    channel.defaultVendorCode?.trim().toLowerCase() === engineVendorCode
  );
  return officialChannels.find((channel) => vendorMatches(channel) && offersModel(channel))
    ?? officialChannels.find(vendorMatches)
    ?? officialChannels.find(offersModel)
    ?? officialChannels[0];
}

/**
 * Resolves the effective model configuration target for an engine.
 *
 * Priority: explicit preference channel (local store first, then catalog) →
 * client-local saved engine selection → the official BirdCoder relay default.
 */
export function resolveWorkbenchEngineModelConfigTarget(
  input: ResolveWorkbenchEngineModelConfigTargetInput,
  resolveRelayBaseUrl: (
    protocol?: BirdCoderModelVendorProtocol | null,
  ) => string = resolveBirdCoderModelRelayBaseUrl,
): WorkbenchEngineModelConfigTarget {
  const agentProviderIds = [...new Set(input.agentProviderIds)];
  const preferenceChannelId = normalizeChannelCode(input.preferenceChannelId);
  const selectedModelId = normalizeModelId(input.selectedModelId);
  const candidateChannelIds = uniqueStrings([
    preferenceChannelId,
    input.storedSelection?.channelCode ?? null,
  ]);
  for (const channelId of candidateChannelIds) {
    if (!channelId) {
      continue;
    }
    const localChannel = findLocalChannel(channelId, input.localChannels);
    if (localChannel) {
      const target = targetFromLocalChannel(
        localChannel,
        selectedModelId || localChannel.defaultModelId.trim(),
        agentProviderIds,
      );
      if (target) {
        return target;
      }
    }
    const catalogChannel = findCatalogChannel(channelId, input.catalogChannels);
    if (catalogChannel) {
      const target = targetFromCatalogChannel(
        catalogChannel,
        selectedModelId || catalogChannel.defaultModelId?.trim() || '',
        agentProviderIds,
        resolveRelayBaseUrl,
      );
      if (target) {
        return target;
      }
    }
  }
  return createOfficialRelayDefaultTarget(input, resolveRelayBaseUrl);
}

/** Stable fingerprint used to skip idempotent re-application. */
export interface WorkbenchEngineModelConfigFingerprint {
  channelCode: string;
  modelId: string;
  apiKeyFingerprint: string;
}

function fingerprintOf(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }
  return String(hash);
}

export function resolveWorkbenchEngineModelConfigFingerprint(
  target: WorkbenchEngineModelConfigTarget,
  apiKey: string | null | undefined,
): WorkbenchEngineModelConfigFingerprint {
  return {
    channelCode: target.channelCode,
    modelId: target.modelId,
    apiKeyFingerprint: fingerprintOf(apiKey),
  };
}

export function isWorkbenchEngineModelConfigCurrent(
  previous: WorkbenchEngineModelConfigFingerprint | null | undefined,
  target: WorkbenchEngineModelConfigTarget,
  apiKey: string | null | undefined,
): boolean {
  if (!previous) {
    return false;
  }
  const current = resolveWorkbenchEngineModelConfigFingerprint(target, apiKey);
  return previous.channelCode === current.channelCode
    && previous.modelId === current.modelId
    && previous.apiKeyFingerprint === current.apiKeyFingerprint;
}

export interface EnsureWorkbenchEngineModelConfigurationOptions {
  agentModelConfigurationService: IAgentModelConfigurationService;
  userModelConfigService: IUserModelConfigService;
  engineId: string;
  target: WorkbenchEngineModelConfigTarget;
  /** The last successfully applied fingerprint for this engine, if any. */
  previous?: WorkbenchEngineModelConfigFingerprint | null;
  /** Resolves the official relay API key (defaults to the auth token). */
  resolveRelayApiKey?: () => string;
}

export interface EnsureWorkbenchEngineModelConfigurationResult {
  /** True when a configuration+selection was applied (or re-applied). */
  applied: boolean;
  fingerprint: WorkbenchEngineModelConfigFingerprint;
  /** `configuration-required` when a relay/custom channel has no credential. */
  status: 'applied' | 'unchanged' | 'configuration-required';
}

function toAgentModelProviderIds(values: readonly string[]): AgentModelProviderId[] {
  return [...new Set(values)] as AgentModelProviderId[];
}

/**
 * Applies the engine's model configuration (and selection) to the agents
 * runtime. Official relay targets carry the current auth token as the API
 * key; relay/custom targets reuse the saved client-local credential. The
 * call is idempotent: a matching fingerprint returns `unchanged` without a
 * round-trip.
 */
export async function ensureWorkbenchEngineModelConfigurationApplied(
  options: EnsureWorkbenchEngineModelConfigurationOptions,
): Promise<EnsureWorkbenchEngineModelConfigurationResult> {
  const {
    agentModelConfigurationService,
    userModelConfigService,
    engineId,
    target,
    previous,
  } = options;
  const resolveRelayApiKey = options.resolveRelayApiKey ?? resolveBirdCoderModelRelayApiKey;

  const apiKey = target.channelKind === 'official'
    ? resolveRelayApiKey()
    : (await userModelConfigService.getApiKey(target.channelCode)) ?? undefined;
  if (isWorkbenchEngineModelConfigCurrent(previous, target, apiKey)) {
    return {
      applied: false,
      fingerprint: resolveWorkbenchEngineModelConfigFingerprint(target, apiKey),
      status: 'unchanged',
    };
  }
  if (target.channelKind !== 'official' && !apiKey) {
    return {
      applied: false,
      fingerprint: resolveWorkbenchEngineModelConfigFingerprint(target, undefined),
      status: 'configuration-required',
    };
  }

  const engineIdAsProvider = engineId as AgentModelProviderId;
  await agentModelConfigurationService.apply({
    configurationId: target.channelCode,
    engineId: engineIdAsProvider,
    vendorCode: target.vendorCode,
    baseUrl: target.baseUrl,
    ...(apiKey ? { apiKey } : {}),
    defaultModelId: target.defaultModelId,
    supportedModelIds: [...new Set(target.supportedModelIds)],
    supportedProviderIds: toAgentModelProviderIds(target.supportedProviderIds),
    inputContextTokens: target.inputContextTokens,
    outputContextTokens: target.outputContextTokens,
    toolCallRounds: target.toolCallRounds,
    supportsMultimodal: target.supportsMultimodal ?? false,
  });
  await agentModelConfigurationService.applySelection({
    configurationId: target.channelCode,
    engineId: engineIdAsProvider,
    modelId: target.modelId,
  });
  return {
    applied: true,
    fingerprint: resolveWorkbenchEngineModelConfigFingerprint(target, apiKey),
    status: 'applied',
  };
}
