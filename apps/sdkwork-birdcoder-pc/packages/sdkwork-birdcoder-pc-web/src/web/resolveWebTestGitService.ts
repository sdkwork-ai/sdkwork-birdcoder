import type { BootstrapShellRuntimeOptions } from '@sdkwork/birdcoder-pc-shell-runtime';

interface BirdCoderWebTestRuntimeHost {
  __SDKWORK_BIRDCODER_TEST_GIT_SERVICE__?: BootstrapShellRuntimeOptions['gitService'];
}

export function resolveWebTestGitService(): BootstrapShellRuntimeOptions['gitService'] {
  if (import.meta.env.MODE !== 'test') {
    return undefined;
  }
  return (globalThis as BirdCoderWebTestRuntimeHost).__SDKWORK_BIRDCODER_TEST_GIT_SERVICE__;
}
