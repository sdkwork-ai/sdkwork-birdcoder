import route from './workbench.route.json' with { type: 'json' };

export const BIRDCODER_MP_WORKBENCH_ROUTE = route as {
  readonly id: 'app.im.chat.index';
  readonly titleKey: 'route.chat';
  readonly auth: 'required';
  readonly permissionHint: 'birdcoder.system-descriptor.read';
  readonly placement: {
    readonly package: 'root';
    readonly pagePath: 'pages/__generated__/workbench/index';
    readonly navigationBarTitleText: 'BirdCoder';
  };
};

export type BirdCoderMiniProgramRouteContribution = typeof BIRDCODER_MP_WORKBENCH_ROUTE;
