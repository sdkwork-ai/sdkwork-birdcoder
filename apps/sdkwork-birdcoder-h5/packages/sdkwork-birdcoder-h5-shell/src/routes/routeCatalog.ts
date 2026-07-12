import {
  BIRDCODER_AUTH_BASE_PATH,
  createBirdCoderAuthRouteCatalog,
  type BirdCoderAuthRouteDefinition,
} from '@sdkwork/birdcoder-pc-auth/auth';
import { BIRDCODER_H5_CHAT_ROUTE_CONTRIBUTIONS } from '@sdkwork/birdcoder-h5-chat/routes';

export interface BirdCoderH5RouteDefinition {
  id: string;
  path: string;
  component: string;
  auth: 'required' | 'optional' | 'public';
  titleKey?: string;
  presentation?: 'screen' | 'tab';
  tabLabelKey?: string;
}

const BIRDCODER_H5_CAPABILITY_ROUTE_CONTRIBUTIONS: BirdCoderH5RouteDefinition[] =
  BIRDCODER_H5_CHAT_ROUTE_CONTRIBUTIONS.map((route) => ({
    id: route.id,
    path: route.path,
    component: route.component,
    auth: route.auth as BirdCoderH5RouteDefinition['auth'],
    titleKey: route.titleKey,
    presentation: route.presentation as BirdCoderH5RouteDefinition['presentation'],
    tabLabelKey: route.tabLabelKey,
  }));

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
    ...BIRDCODER_H5_CAPABILITY_ROUTE_CONTRIBUTIONS,
  ];
}

export { BIRDCODER_AUTH_BASE_PATH, createBirdCoderAuthRouteCatalog };
