import {
  ENGINE_TERMINAL_PROFILE_IDS,
  WORKBENCH_ENGINE_KERNELS,
  getWorkbenchCodeEngineKernel,
  type WorkbenchCodeEngineId,
} from '../workbench/kernel.ts';

export type TerminalCliProfileId = WorkbenchCodeEngineId;

export interface TerminalCliProfileDefinition {
  profileId: TerminalCliProfileId;
  executable: string;
  aliases: readonly string[];
  startupArgs: readonly string[];
  installHint: string;
}

export const TERMINAL_CLI_PROFILE_IDS = [...ENGINE_TERMINAL_PROFILE_IDS] as const;

export const TERMINAL_CLI_PROFILE_REGISTRY: ReadonlyArray<TerminalCliProfileDefinition> =
  WORKBENCH_ENGINE_KERNELS.map((engine) => ({
    profileId: engine.id,
    executable: engine.cli.executable,
    aliases: [...engine.cli.aliases],
    startupArgs: [...engine.cli.startupArgs],
    installHint: engine.cli.installHint,
  }));

const TERMINAL_CLI_PROFILE_ID_SET = new Set<string>(TERMINAL_CLI_PROFILE_IDS);

interface TerminalRuntimeProcess {
  platform?: string;
}

function getRuntimePlatform(): string | null {
  const runtime = globalThis as typeof globalThis & {
    process?: TerminalRuntimeProcess;
  };
  return runtime.process?.platform ?? null;
}

export function isTerminalCliProfileId(
  profileId: string | null | undefined,
): profileId is TerminalCliProfileId {
  const normalizedValue = profileId?.trim().toLowerCase();
  return normalizedValue !== undefined && TERMINAL_CLI_PROFILE_ID_SET.has(normalizedValue);
}

export function getTerminalCliProfileDefinition(
  profileId: TerminalCliProfileId | string,
): TerminalCliProfileDefinition {
  const normalizedProfileId = getWorkbenchCodeEngineKernel(profileId).id;
  return (
    TERMINAL_CLI_PROFILE_REGISTRY.find((entry) => entry.profileId === normalizedProfileId) ??
    TERMINAL_CLI_PROFILE_REGISTRY[0]
  );
}

function resolveTerminalCliPreferredExecutable(
  profileId: TerminalCliProfileId,
  executable: string,
): string {
  const normalizedExecutable = executable.trim();
  if (getRuntimePlatform() === 'win32' && profileId === 'codex') {
    return 'codex.cmd';
  }

  return normalizedExecutable;
}

export function normalizeTerminalCliExecutable(
  profileId: TerminalCliProfileId | string,
  executable: string | null | undefined,
): string {
  const definition = getTerminalCliProfileDefinition(profileId);
  const normalizedExecutable = executable?.trim().toLowerCase();
  if (!normalizedExecutable) {
    return resolveTerminalCliPreferredExecutable(definition.profileId, definition.executable);
  }

  return definition.aliases.includes(normalizedExecutable)
    ? resolveTerminalCliPreferredExecutable(definition.profileId, definition.executable)
    : executable!.trim();
}
