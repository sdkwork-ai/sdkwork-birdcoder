const DEFAULT_PRESENTATION_INTERVAL_MS = 33;

export interface AgentTurnStreamPresentation {
  close: () => void;
  update: (content: string) => void;
}

export function createAgentTurnStreamPresentation(
  present: (content: string) => void,
  intervalMs: number = DEFAULT_PRESENTATION_INTERVAL_MS,
): AgentTurnStreamPresentation {
  const normalizedIntervalMs = Number.isFinite(intervalMs)
    ? Math.max(0, Math.floor(intervalMs))
    : DEFAULT_PRESENTATION_INTERVAL_MS;
  let active = true;
  let pendingContent = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    timer = undefined;
    if (!active || !pendingContent) {
      return;
    }
    try {
      present(pendingContent);
    } catch {
      // Presentation failures cannot change the result of an accepted turn command.
    }
  };

  return {
    close() {
      active = false;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    update(content) {
      if (!active) {
        return;
      }
      pendingContent = content;
      if (timer === undefined) {
        timer = setTimeout(flush, normalizedIntervalMs);
      }
    },
  };
}
