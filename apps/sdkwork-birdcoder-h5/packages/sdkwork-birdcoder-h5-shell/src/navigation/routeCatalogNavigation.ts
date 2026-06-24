import {
  createBirdCoderH5RouteCatalog,
  type BirdCoderH5RouteDefinition,
} from '../routes/routeCatalog.ts';

export interface BirdCoderH5TabRoute {
  id: string;
  path: string;
  labelKey: string;
}

const ROUTE_TITLE_FALLBACK: Record<string, string> = {
  'route.chat': 'Chat',
  'route.settings': 'Settings',
};

function isTabRoute(route: BirdCoderH5RouteDefinition): boolean {
  return route.presentation === 'tab';
}

function isAppSurfaceRoute(route: BirdCoderH5RouteDefinition): boolean {
  return route.auth === 'required' || route.auth === 'optional';
}

export function resolveBirdCoderH5AppRouteCatalog(): BirdCoderH5RouteDefinition[] {
  return createBirdCoderH5RouteCatalog().filter(isAppSurfaceRoute);
}

export function resolveBirdCoderH5TabRoutes(): BirdCoderH5TabRoute[] {
  return createBirdCoderH5RouteCatalog()
    .filter(isTabRoute)
    .map((route) => ({
      id: route.id,
      path: route.path,
      labelKey: route.tabLabelKey ?? route.titleKey ?? route.id,
    }));
}

export function resolveBirdCoderH5RouteTitle(pathname: string): string {
  const normalizedPath = pathname === '' ? '/' : pathname;
  const route = resolveBirdCoderH5AppRouteCatalog().find((entry) => entry.path === normalizedPath);
  if (!route?.titleKey) {
    return 'BirdCoder';
  }

  return ROUTE_TITLE_FALLBACK[route.titleKey] ?? route.titleKey;
}
