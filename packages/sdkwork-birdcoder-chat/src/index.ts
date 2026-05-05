import type {
  BirdCoderCodeEngineKey,
} from '@sdkwork/birdcoder-types';
import type {
  ChatEngineRegistryEntry,
  IChatEngine,
} from './types.ts';

export * from './types.ts';
export * from './providerAdapter.ts';

export interface ChatEngineRegistry {
  create(engineId: BirdCoderCodeEngineKey | string): IChatEngine | null;
  get(engineId: BirdCoderCodeEngineKey | string): ChatEngineRegistryEntry | null;
  list(): readonly ChatEngineRegistryEntry[];
  register(entry: ChatEngineRegistryEntry): void;
}

export function createChatEngineRegistry(
  entries: readonly ChatEngineRegistryEntry[] = [],
): ChatEngineRegistry {
  const entriesById = new Map<string, ChatEngineRegistryEntry>();

  for (const entry of entries) {
    entriesById.set(entry.engineId, entry);
  }

  return {
    create(engineId) {
      return entriesById.get(String(engineId))?.createEngine() ?? null;
    },
    get(engineId) {
      return entriesById.get(String(engineId)) ?? null;
    },
    list() {
      return Array.from(entriesById.values());
    },
    register(entry) {
      entriesById.set(entry.engineId, entry);
    },
  };
}

export {
  BIRDCODER_CODE_ENGINE_PERMISSION_REQUEST_TOOL_NAME,
  BIRDCODER_CODE_ENGINE_USER_QUESTION_TOOL_NAME,
  canonicalizeBirdCoderCodeEngineProviderToolName,
  canonicalizeBirdCoderCodeEngineToolName,
  isBirdCoderCodeEngineApprovalToolName,
  isBirdCoderCodeEngineSettledStatus,
  isBirdCoderCodeEngineUserQuestionToolName,
  flushBirdCoderCodeEngineToolCallDeltas,
  mergeBirdCoderCodeEngineCommandSnapshot,
  mergeBirdCoderCodeEngineToolCallDelta,
  normalizeBirdCoderCodeEngineBoolean,
  normalizeBirdCoderCodeEngineDialectKey,
  normalizeBirdCoderCodeEngineExitCode,
  normalizeBirdCoderCodeEngineRuntimeStatus,
  normalizeBirdCoderCodeEngineToolLifecycleStatus,
  resolveBirdCoderCodeEngineApprovalRuntimeStatus,
  resolveBirdCoderCodeEngineArtifactKind,
  resolveBirdCoderCodeEngineCommandInteractionState,
  resolveBirdCoderCodeEngineCommandStatus,
  resolveBirdCoderCodeEngineCommandText,
  resolveBirdCoderCodeEngineSessionRuntimeStatus,
  resolveBirdCoderCodeEngineSessionStatusFromRuntime,
  resolveBirdCoderCodeEngineRiskLevel,
  resolveBirdCoderCodeEngineToolKind,
  resolveBirdCoderCodeEngineUserQuestionRuntimeStatus,
  shouldPreserveBirdCoderCodeEngineCommandText,
  parseBirdCoderApiJson,
} from '@sdkwork/birdcoder-types';
export type {
  BirdCoderCodeEngineCommandSnapshot,
  BirdCoderCodeEngineCommandStatus,
  BirdCoderCodeEngineCommandInteractionState,
  BirdCoderCodeEngineCommandInteractionStateInput,
  BirdCoderCodeEngineCommandTextInput,
  BirdCoderCodeEngineCommandStatusInput,
  BirdCoderCodeEngineInteractionRuntimeStatusInput,
  BirdCoderCodeEnginePendingToolCallDelta,
  BirdCoderCodeEngineProviderToolNameInput,
  BirdCoderCodeEngineToolClassificationInput,
  BirdCoderCodeEngineToolCallDelta,
  BirdCoderCodeEngineToolCallDeltaAccumulator,
  BirdCoderCodeEngineToolCallDeltaInput,
  BirdCoderCodeEngineToolKind,
  BirdCoderCodeEngineToolKindInput,
  BirdCoderCodeEngineToolLifecycleStatus,
} from '@sdkwork/birdcoder-types';
