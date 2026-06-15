import type { BirdCoderEngineAccessLane } from './bird-coder-engine-access-lane';

export interface BirdCoderEngineAccessPlan {
  primaryLaneId: string;
  fallbackLaneIds: string[];
  lanes: BirdCoderEngineAccessLane[];
}
