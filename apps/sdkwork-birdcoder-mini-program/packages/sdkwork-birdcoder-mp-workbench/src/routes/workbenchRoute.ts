import route from './workbench.route.json' with { type: 'json' };

export const BIRDCODER_MP_WORKBENCH_ROUTE = route as {
  readonly id: 'app.workbench.index';
  readonly titleKey: 'route.workbench';
  readonly auth: 'required';
  readonly permissionHint: 'birdcoder.system-descriptor.read';
  readonly placement: {
    readonly package: 'root';
    readonly pagePath: 'pages/__generated__/workbench/index';
    readonly navigationBarTitleText: 'BirdCoder';
  };
};

export type BirdCoderMiniProgramRouteContribution = typeof BIRDCODER_MP_WORKBENCH_ROUTE;
