import type {
  AgentProjectView,
  AgentSessionActivityView,
  AgentSessionRuntimeDisplayStatus,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function hasExpiredFreshness(
  activity: AgentSessionActivityView,
  now: number,
): boolean {
  const freshUntil = parseTimestamp(activity.freshUntil);
  return freshUntil !== null && freshUntil <= now;
}

export function resolveAgentSessionActivityRuntimeStatus(
  activity: AgentSessionActivityView,
  now: number = Date.now(),
): AgentSessionRuntimeDisplayStatus {
  if (hasExpiredFreshness(activity, now) || activity.freshness === 'stale') {
    return 'stale';
  }

  switch (activity.phase) {
    case 'queued':
      return 'initializing';
    case 'running':
      return 'streaming';
    case 'waiting':
    case 'awaiting_input':
      if (
        activity.pendingInteraction?.kind === 'approval'
        || activity.provider?.interactionHint === 'approval_required'
      ) {
        return 'awaiting_approval';
      }
      if (
        activity.pendingInteraction?.kind === 'user_question'
        || activity.provider?.interactionHint === 'user_input_required'
      ) {
        return 'awaiting_user';
      }
      return 'awaiting_tool';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'deleted':
      return 'terminated';
    case 'completed':
    case 'closed':
    case 'archived':
      return 'completed';
    case 'unknown':
      return 'unknown';
    case 'ready':
    case 'idle':
      return 'ready';
  }
}

export function resolveEffectiveAgentSessionRuntimeStatus(
  session: Pick<AgentSessionView, 'activity' | 'runtimeStatus'>,
  now: number = Date.now(),
): AgentSessionRuntimeDisplayStatus | undefined {
  return session.activity
    ? resolveAgentSessionActivityRuntimeStatus(session.activity, now)
    : session.runtimeStatus;
}

function expireAgentSessionRuntimeStatus(
  session: AgentSessionView,
  now: number,
): AgentSessionView {
  const activity = session.activity;
  if (!activity || !hasExpiredFreshness(activity, now)) {
    return session;
  }
  const runtimeStatus = resolveAgentSessionActivityRuntimeStatus(activity, now);
  if (runtimeStatus === session.runtimeStatus && activity.freshness === 'stale') {
    return session;
  }
  return {
    ...session,
    activity: {
      ...activity,
      freshness: 'stale',
      phase: 'unknown',
    },
    runtimeStatus,
  };
}

export function expireAgentSessionRuntimeStatuses(
  projects: readonly AgentProjectView[],
  now: number = Date.now(),
): AgentProjectView[] {
  let nextProjects: AgentProjectView[] | null = null;
  for (let projectIndex = 0; projectIndex < projects.length; projectIndex += 1) {
    const project = projects[projectIndex]!;
    let nextSessions: AgentSessionView[] | null = null;
    for (let sessionIndex = 0; sessionIndex < project.agentSessions.length; sessionIndex += 1) {
      const session = project.agentSessions[sessionIndex]!;
      const nextSession = expireAgentSessionRuntimeStatus(session, now);
      if (nextSession === session) {
        continue;
      }
      nextSessions ??= [...project.agentSessions];
      nextSessions[sessionIndex] = nextSession;
    }
    if (!nextSessions) {
      continue;
    }
    nextProjects ??= [...projects];
    nextProjects[projectIndex] = {
      ...project,
      agentSessions: nextSessions,
    };
  }
  return nextProjects ?? (projects as AgentProjectView[]);
}

export function resolveNextAgentSessionActivityExpiryAt(
  projects: readonly AgentProjectView[],
  now: number = Date.now(),
): number | null {
  let nextExpiry: number | null = null;
  for (const project of projects) {
    for (const session of project.agentSessions) {
      const freshUntil = parseTimestamp(session.activity?.freshUntil);
      if (freshUntil === null || freshUntil <= now || session.activity?.freshness === 'stale') {
        continue;
      }
      nextExpiry = nextExpiry === null ? freshUntil : Math.min(nextExpiry, freshUntil);
    }
  }
  return nextExpiry;
}
