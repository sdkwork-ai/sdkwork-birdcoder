import { buildTerminalExecutionPlan, getTerminalProfile, type TerminalProfileId } from './profiles.ts';
import {
  TERMINAL_CLI_PROFILE_REGISTRY,
  getTerminalCliProfileDefinition,
  type TerminalCliProfileId,
} from './registry.ts';
import { isBirdcoderTauriRuntime } from './runtimeTarget.ts';

export type TerminalCliProfileAvailabilityStatus = 'available' | 'missing' | 'unknown';

export interface TerminalCliProfileAvailability {
  profileId: TerminalCliProfileId;
  executable: string;
  aliases: string[];
  installHint: string;
  status: TerminalCliProfileAvailabilityStatus;
  resolvedExecutable: string | null;
  checkedAt: number;
  detectedVia: 'tauri' | 'browser';
}

export interface TerminalProfileLaunchState {
  canLaunch: boolean;
  reason: string | null;
}

export interface TerminalProfileLaunchPresentation extends TerminalProfileLaunchState {
  statusLabel: 'Ready' | 'Install' | 'Unknown' | null;
  detailLabel: string;
}

export interface TerminalProfileBlockedAction {
  actionId: 'open-settings' | null;
  actionLabel: 'Open Settings' | null;
}

export interface TerminalProfileBlockedMessageOptions {
  availability?: TerminalCliProfileAvailability | null;
  launchState?: TerminalProfileLaunchState | TerminalProfileLaunchPresentation | null;
  blockedAction?: TerminalProfileBlockedAction | null;
}

interface TauriTerminalCliProfileAvailabilityResponse {
  profileId: string;
  status: string;
  resolvedExecutable?: string | null;
}

const TERMINAL_CLI_PROFILE_AVAILABILITY_CONCURRENCY = 2;

async function resolveTauriInvoke() {
  if (!isBirdcoderTauriRuntime()) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

async function mapWithConcurrencyLimit<TItem, TResult>(
  items: readonly TItem[],
  limit: number,
  mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const resolvedLimit = Math.max(1, Math.floor(limit));
  const results: TResult[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(resolvedLimit, items.length) },
      () => worker(),
    ),
  );

  return results;
}

function normalizeTerminalCliProfileAvailability(
  profileId: TerminalCliProfileId | string,
  value: Partial<TerminalCliProfileAvailability>,
): TerminalCliProfileAvailability {
  const definition = getTerminalCliProfileDefinition(profileId);

  return {
    profileId: definition.profileId,
    executable: value.executable?.trim() || definition.executable,
    aliases: Array.isArray(value.aliases) ? [...value.aliases] : [...definition.aliases],
    installHint: value.installHint?.trim() || definition.installHint,
    status:
      value.status === 'available' || value.status === 'missing' || value.status === 'unknown'
        ? value.status
        : 'unknown',
    resolvedExecutable: value.resolvedExecutable?.trim() || null,
    checkedAt: typeof value.checkedAt === 'number' ? value.checkedAt : Date.now(),
    detectedVia: value.detectedVia === 'tauri' ? 'tauri' : 'browser',
  };
}

export async function listTerminalCliProfileAvailability(): Promise<
  TerminalCliProfileAvailability[]
> {
  const invoke = await resolveTauriInvoke();

  if (!invoke) {
    return TERMINAL_CLI_PROFILE_REGISTRY.map((profile) =>
      normalizeTerminalCliProfileAvailability(profile.profileId, {
        executable: profile.executable,
        aliases: [...profile.aliases],
        installHint: profile.installHint,
        status: 'unknown',
        resolvedExecutable: null,
        detectedVia: 'browser',
      }),
    );
  }

  const results = await mapWithConcurrencyLimit(
    TERMINAL_CLI_PROFILE_REGISTRY,
    TERMINAL_CLI_PROFILE_AVAILABILITY_CONCURRENCY,
    async (profile) => {
      try {
        const response = await invoke<TauriTerminalCliProfileAvailabilityResponse>(
          'terminal_cli_profile_detect',
          {
            request: {
              profileId: profile.profileId,
              executable: profile.executable,
              aliases: [...profile.aliases],
            },
          },
        );

        return normalizeTerminalCliProfileAvailability(profile.profileId, {
          executable: profile.executable,
          aliases: [...profile.aliases],
          installHint: profile.installHint,
          status:
            response.status === 'available' || response.status === 'missing'
              ? response.status
              : 'unknown',
          resolvedExecutable: response.resolvedExecutable ?? null,
          detectedVia: 'tauri',
        });
      } catch {
        return normalizeTerminalCliProfileAvailability(profile.profileId, {
          executable: profile.executable,
          aliases: [...profile.aliases],
          installHint: profile.installHint,
          status: 'unknown',
          resolvedExecutable: null,
          detectedVia: 'tauri',
        });
      }
    },
  );

  return results.sort(
    (left, right) =>
      TERMINAL_CLI_PROFILE_REGISTRY.findIndex((profile) => profile.profileId === left.profileId) -
      TERMINAL_CLI_PROFILE_REGISTRY.findIndex((profile) => profile.profileId === right.profileId),
  );
}

export function resolveTerminalProfileLaunchState(
  profileId: TerminalProfileId | string,
  availability?: TerminalCliProfileAvailability | null,
): TerminalProfileLaunchState {
  const profile = getTerminalProfile(profileId);

  if (profile.kind !== 'cli') {
    return { canLaunch: true, reason: null };
  }

  if (availability?.status === 'missing') {
    return {
      canLaunch: false,
      reason: availability.installHint || getTerminalCliProfileDefinition(profile.id).installHint,
    };
  }

  return { canLaunch: true, reason: null };
}

export function resolveTerminalProfileLaunchPresentation(
  profileId: TerminalProfileId | string,
  availability?: TerminalCliProfileAvailability | null,
): TerminalProfileLaunchPresentation {
  const profile = getTerminalProfile(profileId);
  const launchState = resolveTerminalProfileLaunchState(profile.id, availability);

  if (profile.kind !== 'cli') {
    return {
      ...launchState,
      statusLabel: null,
      detailLabel: buildTerminalExecutionPlan(profile.id, '', profile.defaultCwd).executable,
    };
  }

  if (availability?.status === 'available') {
    return {
      ...launchState,
      statusLabel: 'Ready',
      detailLabel: `${availability.resolvedExecutable ?? availability.executable} on PATH`,
    };
  }

  if (availability?.status === 'missing') {
    return {
      ...launchState,
      statusLabel: 'Install',
      detailLabel: launchState.reason ?? getTerminalCliProfileDefinition(profile.id).installHint,
    };
  }

  return {
    ...launchState,
    statusLabel: 'Unknown',
    detailLabel: `${getTerminalCliProfileDefinition(profile.id).executable} detection requires desktop host access`,
  };
}

export function resolveTerminalProfileBlockedAction(
  profileId: TerminalProfileId | string,
  availability?: TerminalCliProfileAvailability | null,
): TerminalProfileBlockedAction {
  return resolveTerminalProfileLaunchState(profileId, availability).canLaunch
    ? { actionId: null, actionLabel: null }
    : { actionId: 'open-settings', actionLabel: 'Open Settings' };
}

export function buildTerminalProfileBlockedMessage(
  profileId: TerminalProfileId | string,
  availabilityOrOptions?: TerminalCliProfileAvailability | TerminalProfileBlockedMessageOptions | null,
): string | null {
  const profile = getTerminalProfile(profileId);
  const options = availabilityOrOptions && 'status' in availabilityOrOptions
    ? { availability: availabilityOrOptions }
    : (availabilityOrOptions ?? {}) as TerminalProfileBlockedMessageOptions;
  const launchState =
    options.launchState ?? resolveTerminalProfileLaunchState(profile.id, options.availability);
  const blockedAction =
    options.blockedAction ?? resolveTerminalProfileBlockedAction(profile.id, options.availability);

  if (launchState.canLaunch) {
    return null;
  }

  return `${profile.title} is unavailable. ${launchState.reason ?? 'Install the CLI to continue.'} ${blockedAction.actionLabel ?? 'Open Settings'} to configure the environment.`;
}
