import {
  getTerminalProfile,
  type TerminalCommandRequest,
} from '@sdkwork/birdcoder-commons';
import {
  buildWorkbenchCodeEngineTerminalResumeCommand,
  getWorkbenchCodeEngineKernel,
} from '@sdkwork/birdcoder-codeengine';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-types';

export interface CodingSessionTerminalLaunchPlan {
  request: TerminalCommandRequest;
  terminalProfileTitle: string;
}

export function buildCodingSessionTerminalLaunchPlan(input: {
  codingSession: Pick<BirdCoderCodingSession, 'engineId' | 'nativeSessionId'>;
  projectPath: string;
  timestamp?: number;
}): CodingSessionTerminalLaunchPlan {
  const terminalProfileId =
    getWorkbenchCodeEngineKernel(input.codingSession.engineId).terminalProfileId;
  const terminalProfile = getTerminalProfile(terminalProfileId);
  const resumeCommand = buildWorkbenchCodeEngineTerminalResumeCommand({
    engineId: input.codingSession.engineId,
    nativeSessionId: input.codingSession.nativeSessionId,
  });

  return {
    request: {
      surface: 'workspace',
      path: input.projectPath,
      command: resumeCommand,
      profileId: terminalProfile.id,
      timestamp: input.timestamp ?? Date.now(),
    },
    terminalProfileTitle: terminalProfile.title,
  };
}
