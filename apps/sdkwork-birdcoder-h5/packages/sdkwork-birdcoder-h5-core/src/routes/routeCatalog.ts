import {
  BIRDCODER_AUTH_BASE_PATH,
  createBirdCoderAuthRouteCatalog,
  type BirdCoderAuthRouteDefinition,
} from '@sdkwork/birdcoder-pc-auth';

export interface BirdCoderH5RouteDefinition {
  id: string;
  path: string;
  component: string;
  auth: 'required' | 'optional' | 'public';
  titleKey?: string;
}

const BIRDCODER_H5_ROUTE_CATALOG: BirdCoderH5RouteDefinition[] = [
  {
    id: 'app.chat.index',
    path: '/',
    component: 'ChatPage',
    auth: 'required',
    titleKey: 'route.chat',
  },
];

function mapAuthRoute(route: BirdCoderAuthRouteDefinition): BirdCoderH5RouteDefinition {
  return {
    id: route.id,
    path: route.path,
    component: route.id,
    auth: 'public',
  };
}

export function createBirdCoderH5RouteCatalog(
  basePath: string = BIRDCODER_AUTH_BASE_PATH,
): BirdCoderH5RouteDefinition[] {
  return [
    ...createBirdCoderAuthRouteCatalog(basePath).map(mapAuthRoute),
    ...BIRDCODER_H5_ROUTE_CATALOG,
  ];
}

export { BIRDCODER_AUTH_BASE_PATH, createBirdCoderAuthRouteCatalog };
