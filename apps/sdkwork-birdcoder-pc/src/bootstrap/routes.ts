import {
  BIRDCODER_AUTH_BASE_PATH,
  createBirdCoderAuthRouteCatalog,
  type BirdCoderAuthRouteDefinition,
} from '@sdkwork/birdcoder-pc-auth';

export interface RouteDefinition {
  id: string;
  path: string;
  component: string;
  auth: 'required' | 'optional' | 'public';
}

const BIRDCODER_PRODUCT_ROUTE_CATALOG: RouteDefinition[] = [
  {
    id: 'app.code.index',
    path: '/',
    component: 'CodePage',
    auth: 'required',
  },
  {
    id: 'app.studio.index',
    path: '/studio',
    component: 'StudioPage',
    auth: 'required',
  },
  {
    id: 'app.settings.index',
    path: '/settings',
    component: 'SettingsPage',
    auth: 'required',
  },
];

function mapAuthRoute(route: BirdCoderAuthRouteDefinition): RouteDefinition {
  return {
    id: route.id,
    path: route.path,
    component: route.id,
    auth: 'public',
  };
}

export function createRoutes(basePath: string = BIRDCODER_AUTH_BASE_PATH): RouteDefinition[] {
  return [
    ...createBirdCoderAuthRouteCatalog(basePath).map(mapAuthRoute),
    ...BIRDCODER_PRODUCT_ROUTE_CATALOG,
  ];
}
