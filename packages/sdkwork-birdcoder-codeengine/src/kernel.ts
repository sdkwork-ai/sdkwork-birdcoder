import {
  type BirdCoderEngineAccessLane,
  type BirdCoderEngineAccessPlan,
  type BirdCoderEngineDescriptor,
  type BirdCoderModelCatalogEntry,
  type BirdCoderStandardEngineId,
  type BirdCoderStandardEngineTheme,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_STANDARD_DEFAULT_ENGINE_ID,
  BIRDCODER_STANDARD_ENGINE_IDS,
  normalizeBirdCoderCodeEngineId,
  resolveBirdCoderCodeEngineNativeSessionLookupId,
} from './catalog.ts';
import {
  BIRDCODER_CODE_ENGINE_RESUME_SESSION_ARG_TOKEN,
  BIRDCODER_STANDARD_ENGINE_MANIFESTS,
  type WorkbenchCodeEngineCliDefinition,
  type WorkbenchCodeEngineServerSupportStatus,
  type WorkbenchCodeEngineSourceDefinition,
} from './manifest.ts';
import { resolveBirdCoderCodeEnginePrimaryAccessLane } from './access.ts';
import {
  getWorkbenchCodeEngineExecutionTopology,
  type WorkbenchCodeEngineExecutionTopology,
} from './topology.ts';

export const WORKBENCH_CODE_ENGINE_IDS = BIRDCODER_STANDARD_ENGINE_IDS;

export type WorkbenchCodeEngineId = BirdCoderStandardEngineId;
export type {
  WorkbenchCodeEngineCliDefinition,
  WorkbenchCodeEngineServerSupportStatus,
  WorkbenchCodeEngineSourceDefinition,
  WorkbenchCodeEngineSourceKind,
  WorkbenchCodeEngineSourceStatus,
} from './manifest.ts';
export type { WorkbenchCodeEngineExecutionTopology } from './topology.ts';

export interface WorkbenchCodeEngineKernelDefinition {
  id: WorkbenchCodeEngineId;
  label: string;
  terminalProfileId: WorkbenchCodeEngineId;
  description: string;
  aliases: readonly string[];
  monogram: string;
  theme: BirdCoderStandardEngineTheme;
  serverSupportStatus: WorkbenchCodeEngineServerSupportStatus;
  defaultModelId: string;
  modelIds: readonly string[];
  cli: WorkbenchCodeEngineCliDefinition;
  source: WorkbenchCodeEngineSourceDefinition;
  descriptor: BirdCoderEngineDescriptor;
  accessPlan: BirdCoderEngineAccessPlan | null;
  primaryAccessLane: BirdCoderEngineAccessLane | null;
  executionTopology: WorkbenchCodeEngineExecutionTopology;
  modelCatalog: readonly BirdCoderModelCatalogEntry[];
}

export const WORKBENCH_ENGINE_KERNELS: ReadonlyArray<WorkbenchCodeEngineKernelDefinition> =
  BIRDCODER_STANDARD_ENGINE_MANIFESTS.map((manifest) => {
    return {
      id: manifest.id,
      label: manifest.label,
      terminalProfileId: manifest.terminalProfileId,
      description: manifest.description,
      aliases: manifest.aliases,
      monogram: manifest.presentation.monogram,
      theme: manifest.presentation.theme,
      serverSupportStatus: manifest.serverSupportStatus,
      defaultModelId: manifest.defaultModelId,
      modelIds: manifest.modelIds,
      cli: manifest.cli,
      source: manifest.source,
      descriptor: manifest.descriptor,
      accessPlan: manifest.descriptor.accessPlan ?? null,
      primaryAccessLane: resolveBirdCoderCodeEnginePrimaryAccessLane(manifest.id),
      executionTopology: getWorkbenchCodeEngineExecutionTopology(manifest.id),
      modelCatalog: manifest.modelCatalog,
    };
  });

export const ENGINE_TERMINAL_PROFILE_IDS = WORKBENCH_ENGINE_KERNELS.map(
  (engine) => engine.terminalProfileId,
);

const WORKBENCH_ENGINE_ID_SET = new Set<string>(WORKBENCH_ENGINE_KERNELS.map((engine) => engine.id));

export function normalizeWorkbenchCodeEngineKernelId(
  value: string | null | undefined,
): WorkbenchCodeEngineId {
  return normalizeBirdCoderCodeEngineId(value) as WorkbenchCodeEngineId;
}

export function isWorkbenchCliEngineId(
  value: string | null | undefined,
): value is WorkbenchCodeEngineId {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue !== undefined && WORKBENCH_ENGINE_ID_SET.has(normalizedValue);
}

export function getWorkbenchCodeEngineKernel(
  value: string | null | undefined,
): WorkbenchCodeEngineKernelDefinition {
  const normalizedEngineId = normalizeWorkbenchCodeEngineKernelId(value);
  return (
    WORKBENCH_ENGINE_KERNELS.find((engine) => engine.id === normalizedEngineId) ??
    WORKBENCH_ENGINE_KERNELS.find((engine) => engine.id === BIRDCODER_STANDARD_DEFAULT_ENGINE_ID) ??
    WORKBENCH_ENGINE_KERNELS[0]
  );
}

export function findWorkbenchCodeEngineKernel(
  value: string | null | undefined,
): WorkbenchCodeEngineKernelDefinition | null {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  return (
    WORKBENCH_ENGINE_KERNELS.find(
      (engine) =>
        engine.id === normalizedValue ||
        engine.aliases.some((alias) => alias.toLowerCase() === normalizedValue) ||
        engine.label.toLowerCase() === normalizedValue,
    ) ?? null
  );
}

export function listWorkbenchCliEngines(): ReadonlyArray<WorkbenchCodeEngineKernelDefinition> {
  return WORKBENCH_ENGINE_KERNELS;
}

function quoteWorkbenchCodeEngineTerminalArg(value: string): string {
  if (/^[A-Za-z0-9._:@/\\-]+$/u.test(value)) {
    return value;
  }

  return `"${value.replace(/["\\]/gu, '\\$&')}"`;
}

export function buildWorkbenchCodeEngineTerminalResumeCommand(input: {
  engineId: string | null | undefined;
  nativeSessionId: string | null | undefined;
}): string {
  const kernel = getWorkbenchCodeEngineKernel(input.engineId);
  const sessionId = resolveBirdCoderCodeEngineNativeSessionLookupId(
    input.nativeSessionId,
    kernel.id,
  );
  if (!sessionId) {
    throw new Error(`Cannot build ${kernel.id} terminal resume command without a native session id.`);
  }

  return kernel.cli.resumeArgs
    .map((arg) =>
      arg === BIRDCODER_CODE_ENGINE_RESUME_SESSION_ARG_TOKEN
        ? quoteWorkbenchCodeEngineTerminalArg(sessionId)
        : arg,
    )
    .join(' ');
}

export function listWorkbenchCodeEngineDescriptors(): ReadonlyArray<BirdCoderEngineDescriptor> {
  return WORKBENCH_ENGINE_KERNELS.map((engine) => engine.descriptor);
}

export function listWorkbenchModelCatalogEntries(): ReadonlyArray<BirdCoderModelCatalogEntry> {
  return WORKBENCH_ENGINE_KERNELS.flatMap((engine) => engine.modelCatalog);
}
