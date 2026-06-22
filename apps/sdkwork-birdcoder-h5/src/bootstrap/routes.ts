import {
  BIRDCODER_AUTH_BASE_PATH,
  createBirdCoderAuthRouteCatalog,
  type BirdCoderAuthRouteDefinition,
} from '@sdkwork/birdcoder-auth';

export interface RouteDefinition {
  id: string;
  path: string;
  component: string;
  auth: 'required' | 'optional' | 'public';
  titleKey?: string;
}

const BIRDCODER_H5_ROUTE_CATALOG: RouteDefinition[] = [
  {
    id: 'app.chat.index',
    path: '/',
    component: 'ChatPage',
    auth: 'required',
    titleKey: 'route.chat',
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
    ...BIRDCODER_H5_ROUTE_CATALOG,
  ];
}
