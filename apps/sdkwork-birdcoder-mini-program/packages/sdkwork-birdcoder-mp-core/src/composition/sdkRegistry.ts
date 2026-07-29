import {
  createUnconfiguredBirdCoderSdkPorts,
  type BirdCoderSdkPorts,
} from '../sdk/ports.ts';

export interface BirdCoderMiniProgramSdkRegistry {
  readonly ports: BirdCoderSdkPorts;
}

export function createBirdCoderMiniProgramSdkRegistry(
  ports: BirdCoderSdkPorts = createUnconfiguredBirdCoderSdkPorts(),
): BirdCoderMiniProgramSdkRegistry {
  return { ports };
}
