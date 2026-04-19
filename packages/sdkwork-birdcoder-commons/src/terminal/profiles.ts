import {
  getTerminalCliProfileDefinition,
  isTerminalCliProfileId,
  normalizeTerminalCliExecutable,
} from './registry.ts';
import { listWorkbenchCliEngines, type WorkbenchCodeEngineId } from '@sdkwork/birdcoder-codeengine';

export type TerminalShellProfileId =
  | 'powershell'
  | 'cmd'
  | 'ubuntu'
  | 'bash'
  | 'node';

export type TerminalCliProfileId = WorkbenchCodeEngineId;
export type TerminalProfileId = TerminalShellProfileId | TerminalCliProfileId;

export type TerminalProfileKind = 'shell' | 'cli';

export interface TerminalProfileDefinition {
  id: TerminalProfileId;
  title: string;
  shortcut: string;
  defaultCwd: string;
  kind: TerminalProfileKind;
}

export interface TerminalExecutionPlan {
  profileId: TerminalProfileId;
  kind: TerminalProfileKind;
  executable: string;
  args: string[];
  cwd: string;
}

export interface TerminalLaunchProfileOption extends TerminalProfileDefinition {
  executable: string;
  aliases: readonly string[];
  startupArgs: readonly string[];
  installHint?: string;
}

const BUILTIN_TERMINAL_SHELL_PROFILES: ReadonlyArray<TerminalProfileDefinition> = [
  {
    id: 'powershell',
    title: 'Windows PowerShell',
    shortcut: 'Ctrl+Shift+1',
    defaultCwd: 'C:\\Users\\Developer\\sdkwork-birdcoder',
    kind: 'shell',
  },
  {
    id: 'cmd',
    title: 'Command Prompt',
    shortcut: 'Ctrl+Shift+2',
    defaultCwd: 'C:\\Users\\Developer\\sdkwork-birdcoder',
    kind: 'shell',
  },
  {
    id: 'ubuntu',
    title: 'Ubuntu-22.04',
    shortcut: 'Ctrl+Shift+3',
    defaultCwd: '~/sdkwork-birdcoder',
    kind: 'shell',
  },
  {
    id: 'bash',
    title: 'Git Bash',
    shortcut: 'Ctrl+Shift+4',
    defaultCwd: '~/sdkwork-birdcoder',
    kind: 'shell',
  },
  {
    id: 'node',
    title: 'Node.js',
    shortcut: 'Ctrl+Shift+5',
    defaultCwd: '',
    kind: 'shell',
  },
] as const;

const TERMINAL_CLI_SHORTCUTS: Readonly<Record<TerminalCliProfileId, string>> = {
  codex: 'Ctrl+Shift+6',
  'claude-code': 'Ctrl+Shift+7',
  gemini: 'Ctrl+Shift+8',
  opencode: 'Ctrl+Shift+9',
};

const BUILTIN_TERMINAL_CLI_PROFILES: ReadonlyArray<TerminalProfileDefinition> =
  listWorkbenchCliEngines().map((engine) => ({
    id: engine.terminalProfileId,
    title: engine.label,
    shortcut: TERMINAL_CLI_SHORTCUTS[engine.terminalProfileId],
    defaultCwd: '~/sdkwork-birdcoder',
    kind: 'cli',
  }));

export const BUILTIN_TERMINAL_PROFILES: ReadonlyArray<TerminalProfileDefinition> = [
  ...BUILTIN_TERMINAL_SHELL_PROFILES,
  ...BUILTIN_TERMINAL_CLI_PROFILES,
];

export const TERMINAL_PROFILE_IDS = BUILTIN_TERMINAL_PROFILES.map((profile) => profile.id);

export function getTerminalProfile(profileId: TerminalProfileId): TerminalProfileDefinition;
export function getTerminalProfile(profileId: string): TerminalProfileDefinition;
export function getTerminalProfile(profileId: string): TerminalProfileDefinition {
  return (
    BUILTIN_TERMINAL_PROFILES.find((profile) => profile.id === profileId) ??
    BUILTIN_TERMINAL_PROFILES[0]
  );
}

export function tokenizeTerminalCommand(command: string): string[] {
  const trimmed = command.trim();
  if (!trimmed) {
    return [];
  }

  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if ((char === '"' || char === "'") && quote === null) {
      quote = char;
      continue;
    }

    if (quote !== null && char === quote) {
      quote = null;
      continue;
    }

    if (quote === null && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function buildTerminalExecutionPlan(
  profileId: TerminalProfileId | string,
  command: string,
  cwd: string,
): TerminalExecutionPlan {
  const profile = getTerminalProfile(profileId);
  const targetCwd = cwd || profile.defaultCwd;

  switch (profile.id) {
    case 'powershell':
      return {
        profileId: profile.id,
        kind: profile.kind,
        executable: 'powershell',
        args: ['-NoLogo', '-Command', command],
        cwd: targetCwd,
      };
    case 'cmd':
      return {
        profileId: profile.id,
        kind: profile.kind,
        executable: 'cmd',
        args: ['/C', command],
        cwd: targetCwd,
      };
    case 'ubuntu':
      return {
        profileId: profile.id,
        kind: profile.kind,
        executable: 'wsl',
        args: ['-d', 'Ubuntu-22.04', '--', 'bash', '-lc', command],
        cwd: targetCwd,
      };
    case 'bash':
      return {
        profileId: profile.id,
        kind: profile.kind,
        executable: 'bash',
        args: ['-lc', command],
        cwd: targetCwd,
      };
    case 'node':
      return {
        profileId: profile.id,
        kind: profile.kind,
        executable: 'node',
        args: ['-e', command],
        cwd: targetCwd,
      };
    default: {
      if (!isTerminalCliProfileId(profile.id)) {
        return {
          profileId: profile.id,
          kind: profile.kind,
          executable: 'powershell',
          args: ['-NoLogo', '-Command', command],
          cwd: targetCwd,
        };
      }

      const cliProfile = getTerminalCliProfileDefinition(profile.id);
      return {
        profileId: profile.id,
        kind: profile.kind,
        executable: normalizeTerminalCliExecutable(profile.id, cliProfile.executable),
        args: [...cliProfile.startupArgs, ...tokenizeTerminalCommand(command)],
        cwd: targetCwd,
      };
    }
  }
}

function resolveShellExecutable(profileId: TerminalProfileId): string {
  switch (profileId) {
    case 'powershell':
      return 'powershell';
    case 'cmd':
      return 'cmd';
    case 'ubuntu':
      return 'wsl';
    case 'bash':
      return 'bash';
    case 'node':
      return 'node';
    default:
      return 'powershell';
  }
}

export function resolveTerminalLaunchProfileOption(
  profileId: TerminalProfileId | string,
): TerminalLaunchProfileOption {
  const profile = getTerminalProfile(profileId);

  if (profile.kind === 'cli' && isTerminalCliProfileId(profile.id)) {
    const cliProfile = getTerminalCliProfileDefinition(profile.id);
    return {
      ...profile,
      executable: normalizeTerminalCliExecutable(profile.id, cliProfile.executable),
      aliases: [...cliProfile.aliases],
      startupArgs: [...cliProfile.startupArgs],
      installHint: cliProfile.installHint,
    };
  }

  return {
    ...profile,
    executable: resolveShellExecutable(profile.id),
    aliases: [],
    startupArgs: [],
  };
}

export function listTerminalLaunchProfileOptions(): ReadonlyArray<TerminalLaunchProfileOption> {
  return BUILTIN_TERMINAL_PROFILES.map((profile) => resolveTerminalLaunchProfileOption(profile.id));
}
