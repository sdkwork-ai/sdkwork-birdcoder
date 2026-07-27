const runtime = require('../../../runtime/birdcoder-app');

Page(runtime.createBirdCoderWorkbenchPageDefinition({
  getRuntime() {
    const app = getApp();
    if (!app.globalData.runtime) {
      throw new Error(app.globalData.bootstrapError || 'BirdCoder runtime is unavailable.');
    }
    return app.globalData.runtime;
  },
}));
