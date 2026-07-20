import type { WebRuntimeSessionIntent } from '@sdkwork/terminal-pc-shell/web-integration';
import type { TerminalCommandRequest } from './runtime.ts';
import type { DesktopTerminalLaunchPlan } from './contracts/sdkworkTerminalShell.d.ts';
import type { BirdcoderBrowserTerminalTarget } from './birdcoderTerminalRuntime.ts';

export function createBirdcoderWebRuntimeSessionIntent(
  plan: DesktopTerminalLaunchPlan,
  request: TerminalCommandRequest,
  target: BirdcoderBrowserTerminalTarget,
): WebRuntimeSessionIntent {
  const requestedCommand = request.command?.trim();
  const command = requestedCommand
    ? ['/bin/sh', '-lc', requestedCommand]
    : plan.kind === 'local-process'
      ? plan.localProcessRequest.command
      : plan.profile === 'bash' ? ['/bin/bash', '-l'] : ['/bin/sh'];
  return {
    requestId: `birdcoder-terminal:${request.timestamp}`,
    profile: plan.profile,
    title: plan.title,
    targetLabel: plan.targetLabel,
    request: {
      ...target,
      command,
      tags: [
        ...target.tags,
        `profile:${request.profileId ?? 'shell'}`,
        `title:${plan.title}`,
      ],
    },
  };
}
