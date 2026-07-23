import { IAM_H5_AUTH_ROUTES } from '@sdkwork/iam-h5-auth';
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

const LOGIN_PATH_SEPARATOR_INDEX = IAM_H5_AUTH_ROUTES.loginPath.lastIndexOf('/');

export const BIRDCODER_AUTH_BASE_PATH = LOGIN_PATH_SEPARATOR_INDEX > 0
  ? IAM_H5_AUTH_ROUTES.loginPath.slice(0, LOGIN_PATH_SEPARATOR_INDEX)
  : '/auth';

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

function normalizeBasePath(basePath: string): string {
  const normalized = `/${basePath}`.replace(/\/{2,}/gu, '/').replace(/\/$/u, '');
  return normalized || BIRDCODER_AUTH_BASE_PATH;
}

export function createBirdCoderAuthRouteCatalog(
  basePath: string = BIRDCODER_AUTH_BASE_PATH,
): BirdCoderH5RouteDefinition[] {
  const normalizedBasePath = normalizeBasePath(basePath);
  const loginLeaf = IAM_H5_AUTH_ROUTES.loginPath.slice(LOGIN_PATH_SEPARATOR_INDEX);
  return [{
    auth: 'public',
    component: IAM_H5_AUTH_ROUTES.moduleId,
    id: IAM_H5_AUTH_ROUTES.moduleId,
    path: `${normalizedBasePath}${loginLeaf}`,
    presentation: 'screen',
  }];
}

export function createBirdCoderH5RouteCatalog(
  basePath: string = BIRDCODER_AUTH_BASE_PATH,
): BirdCoderH5RouteDefinition[] {
  return [
    ...createBirdCoderAuthRouteCatalog(basePath),
    ...BIRDCODER_H5_CAPABILITY_ROUTE_CONTRIBUTIONS,
  ];
}
