import { createBirdCoderMiniProgramRuntime } from './runtime.ts';
import { parseBirdCoderMiniProgramRuntimeConfig } from './environment.ts';
import { BirdCoderWorkbenchController } from '@sdkwork/birdcoder-mp-workbench';
import { createBirdCoderWorkbenchPageDefinition as createWorkbenchPageDefinition } from '@sdkwork/birdcoder-mp-workbench';

export function bootstrapBirdCoderMiniProgram(runtimeInput: Parameters<typeof parseBirdCoderMiniProgramRuntimeConfig>[0], api?: Parameters<typeof createBirdCoderMiniProgramRuntime>[1]) {
  const runtime = createBirdCoderMiniProgramRuntime(
    parseBirdCoderMiniProgramRuntimeConfig(runtimeInput),
    api,
  );
  return runtime;
}

export function createBirdCoderWorkbenchPageDefinition(options: {
  getRuntime(): ReturnType<typeof bootstrapBirdCoderMiniProgram>;
}) {
  return createWorkbenchPageDefinition(options);
}

export function createBirdCoderWorkbenchController(runtime: ReturnType<typeof bootstrapBirdCoderMiniProgram>) {
  return new BirdCoderWorkbenchController(runtime.config, runtime.sdkPorts.birdCoder);
}
