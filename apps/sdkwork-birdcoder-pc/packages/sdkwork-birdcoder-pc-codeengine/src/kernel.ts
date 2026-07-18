import type {
  BirdCoderEngineDescriptor,
  BirdCoderEngineTransportKind,
  BirdCoderModelCatalogEntry,
} from '@sdkwork/birdcoder-pc-contracts-commons';

/**
 * Workbench engine kernel metadata for BirdCoder programming-tool surfaces.
 *
 * Agent runtime execution is migrating to `sdkwork-kernel` via
 * `sdkwork-birdcoder-kernel-bridge`. This module keeps BirdCoder-owned
 * CLI topology, terminal resume commands, and descriptor assembly only.
 */

import {
  BIRDCODER_CODE_ENGINE_DESCRIPTORS,
  BIRDCODER_CODE_ENGINE_MODELS,
  normalizeBirdCoderCodeEngineNativeSessionId,
  type WorkbenchCodeEngineId,
  WORKBENCH_CODE_ENGINE_IDS,
} from './catalog.ts';
import {
  findWorkbenchCodeEngineDefinition,
  normalizeWorkbenchCodeEngineId,
} from './preferences.ts';

export interface WorkbenchCodeEngineCliDefinition {
  executable: string;
  packageName: string;
  aliases: readonly string[];
  startupArgs: readonly string[];
  resumeArgs: readonly string[];
  installHint: string;
}

export interface WorkbenchCodeEngineSourceDefinition {
  externalPath: string;
  sdkPath: string | null;
  sourceKind: 'repository' | 'package';
  sourceStatus: 'mirrored' | 'sdk-only' | 'missing';
}

export interface WorkbenchCodeEngineExecutionTopology {
  authorityPath: string;
  bridgeRequired: boolean;
  officialSdkPackageName: string;
  transportKind: BirdCoderEngineTransportKind;
}

export type { WorkbenchCodeEngineId } from './catalog.ts';

export interface WorkbenchCodeEngineKernel {
  id: WorkbenchCodeEngineId;
  label: string;
  aliases: readonly string[];
  defaultModelId: string;
  terminalProfileId: WorkbenchCodeEngineId;
  cli: WorkbenchCodeEngineCliDefinition;
  source: WorkbenchCodeEngineSourceDefinition;
  executionTopology: WorkbenchCodeEngineExecutionTopology;
  descriptor: BirdCoderEngineDescriptor;
  modelCatalog: readonly BirdCoderModelCatalogEntry[];
}

const KERNEL_INPUTS: Record<
  WorkbenchCodeEngineId,
  Pick<WorkbenchCodeEngineKernel, 'cli' | 'source' | 'executionTopology'>
> = {
  codex: {
    cli: {
      executable: 'codex',
      packageName: '@openai/codex',
      aliases: ['codex', 'codex.cmd'],
      startupArgs: [],
      resumeArgs: ['resume', '{sessionId}'],
      installHint: 'Install the OpenAI Codex CLI package.',
    },
    source: {
      externalPath: 'external/codex',
      sdkPath: 'external/codex/sdk/typescript',
      sourceKind: 'repository',
      sourceStatus: 'mirrored',
    },
    executionTopology: {
      authorityPath: 'rust-rpc-bridge',
      bridgeRequired: true,
      officialSdkPackageName: '@openai/codex-sdk',
      transportKind: 'cli-jsonl',
    },
  },
  'claude-code': {
    cli: {
      executable: 'claude',
      packageName: 'claude-code',
      aliases: ['claude', 'claude-code'],
      startupArgs: [],
      resumeArgs: ['--resume', '{sessionId}'],
      installHint: 'Install the Claude Code CLI package.',
    },
    source: {
      externalPath: 'external/claude-code',
      sdkPath: null,
      sourceKind: 'repository',
      sourceStatus: 'mirrored',
    },
    executionTopology: {
      authorityPath: 'typescript-rpc-bridge',
      bridgeRequired: true,
      officialSdkPackageName: '@anthropic-ai/claude-agent-sdk',
      transportKind: 'cli-jsonl',
    },
  },
  gemini: {
    cli: {
      executable: 'gemini',
      packageName: '@google/gemini-cli',
      aliases: ['gemini', 'gemini-cli'],
      startupArgs: [],
      resumeArgs: ['--resume', '{sessionId}'],
      installHint: 'Install the Google Gemini CLI package.',
    },
    source: {
      externalPath: 'external/gemini',
      sdkPath: 'external/gemini/packages/sdk',
      sourceKind: 'repository',
      sourceStatus: 'mirrored',
    },
    executionTopology: {
      authorityPath: 'typescript-rpc-bridge',
      bridgeRequired: true,
      officialSdkPackageName: '@google/gemini-cli-sdk',
      transportKind: 'cli-jsonl',
    },
  },
  opencode: {
    cli: {
      executable: 'opencode',
      packageName: 'opencode-ai',
      aliases: ['opencode', 'open-code'],
      startupArgs: [],
      resumeArgs: ['--session', '{sessionId}'],
      installHint: 'Install the OpenCode CLI package.',
    },
    source: {
      externalPath: 'external/opencode',
      sdkPath: 'external/opencode/packages/sdk/js',
      sourceKind: 'repository',
      sourceStatus: 'mirrored',
    },
    executionTopology: {
      authorityPath: 'rust-rpc-bridge',
      bridgeRequired: true,
      officialSdkPackageName: '@opencode-ai/sdk',
      transportKind: 'cli-jsonl',
    },
  },
};

export const WORKBENCH_ENGINE_KERNELS: readonly WorkbenchCodeEngineKernel[] =
  WORKBENCH_CODE_ENGINE_IDS.map((engineId) => {
    const descriptor = BIRDCODER_CODE_ENGINE_DESCRIPTORS.find(
      (candidate) => candidate.engineKey === engineId,
    );

    if (!descriptor) {
      throw new Error(`Missing workbench code engine descriptor: ${engineId}`);
    }

    const workbenchDefinition = findWorkbenchCodeEngineDefinition(engineId);

    return {
      id: engineId,
      label: workbenchDefinition?.label ?? descriptor.displayName,
      aliases: workbenchDefinition?.aliases ?? [engineId],
      defaultModelId: descriptor.defaultModelId,
      terminalProfileId: engineId,
      descriptor,
      modelCatalog: BIRDCODER_CODE_ENGINE_MODELS.filter(
        (model) => model.engineKey === engineId,
      ),
      ...KERNEL_INPUTS[engineId],
    };
  });

export const ENGINE_TERMINAL_PROFILE_IDS: readonly WorkbenchCodeEngineId[] =
  WORKBENCH_ENGINE_KERNELS.map((engine) => engine.id);

export function listWorkbenchCliEngines(): readonly WorkbenchCodeEngineKernel[] {
  return WORKBENCH_ENGINE_KERNELS;
}

export function findWorkbenchCodeEngineKernel(value: unknown): WorkbenchCodeEngineKernel | null {
  const engineId = normalizeWorkbenchCodeEngineId(value);

  if (!engineId) {
    return null;
  }

  return WORKBENCH_ENGINE_KERNELS.find((engine) => engine.id === engineId) ?? null;
}

export function getWorkbenchCodeEngineKernel(value: unknown): WorkbenchCodeEngineKernel {
  const kernel = findWorkbenchCodeEngineKernel(value);

  if (!kernel) {
    throw new Error(`Unknown workbench code engine: ${String(value)}`);
  }

  return kernel;
}

export function listWorkbenchCodeEngineDescriptors(): readonly BirdCoderEngineDescriptor[] {
  return WORKBENCH_ENGINE_KERNELS.map((engine) => engine.descriptor);
}

export function listWorkbenchModelCatalogEntries(): readonly BirdCoderModelCatalogEntry[] {
  return WORKBENCH_ENGINE_KERNELS.flatMap((engine) => [...engine.modelCatalog]);
}

export function buildWorkbenchCodeEngineTerminalResumeCommand(input: {
  engineId: unknown;
  nativeSessionId: unknown;
}): string {
  const kernel = getWorkbenchCodeEngineKernel(input.engineId);
  const nativeSessionId = normalizeBirdCoderCodeEngineNativeSessionId(
    input.nativeSessionId,
    kernel.id,
  );

  return kernel.cli.resumeArgs
    .map((argument) => argument.replace('{sessionId}', nativeSessionId))
    .join(' ');
}

export function buildWorkbenchCodeEngineCliResumeCommand(input: {
  engineId: unknown;
  nativeSessionId: unknown;
}): string {
  return buildWorkbenchCodeEngineTerminalResumeCommand(input);
}
