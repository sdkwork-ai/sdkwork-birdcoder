declare function require(moduleId: string): Record<string, unknown>;
declare function App(definition: Record<string, unknown>): void;

const runtimeConfig = require('./runtime/runtime-config');
const runtime = require('./runtime/birdcoder-app') as {
  bootstrapBirdCoderMiniProgram(input: Record<string, unknown>): unknown;
};

App({
  globalData: {
    runtime: null,
    bootstrapError: '',
  },
  onLaunch(this: {
    globalData: { runtime: unknown; bootstrapError: string };
  }) {
    try {
      this.globalData.runtime = runtime.bootstrapBirdCoderMiniProgram(runtimeConfig);
    } catch (error) {
      this.globalData.bootstrapError = error instanceof Error
        ? error.message
        : 'BirdCoder runtime initialization failed.';
    }
  },
});
