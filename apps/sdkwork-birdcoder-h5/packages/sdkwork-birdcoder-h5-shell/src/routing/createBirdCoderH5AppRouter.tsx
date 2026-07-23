import { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import {
  createBirdCoderH5RouteCatalog,
  type BirdCoderH5RouteDefinition,
} from '../routes/routeCatalog.ts';
import { MobileShellLayout } from '../layout/MobileShellLayout.tsx';
import { BirdCoderH5ProtectedRoute } from './BirdCoderH5ProtectedRoute.tsx';
import { resolveBirdCoderH5RouteComponent } from './routeComponents.tsx';

function isAppSurfaceRoute(route: BirdCoderH5RouteDefinition): boolean {
  return route.auth === 'required' || route.auth === 'optional';
}

function buildRouteElement(route: BirdCoderH5RouteDefinition) {
  return (
    <BirdCoderH5ProtectedRoute required={route.auth === 'required'}>
      <Suspense fallback={<div className="px-4 py-6 text-sm text-muted-foreground">Loading route...</div>}>
        {resolveBirdCoderH5RouteComponent(route.component)}
      </Suspense>
    </BirdCoderH5ProtectedRoute>
  );
}

function buildPublicRouteElement(route: BirdCoderH5RouteDefinition) {
  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-muted-foreground">Loading route...</div>}>
      {resolveBirdCoderH5RouteComponent(route.component)}
    </Suspense>
  );
}

export function createBirdCoderH5AppRouter() {
  const routeCatalog = createBirdCoderH5RouteCatalog();
  const appRoutes = routeCatalog.filter(isAppSurfaceRoute);
  const publicRoutes = routeCatalog.filter((route) => route.auth === 'public');

  return createBrowserRouter([
    ...publicRoutes.map((route) => ({
      path: route.path,
      element: buildPublicRouteElement(route),
    })),
    {
      path: '/',
      element: <MobileShellLayout />,
      children: appRoutes.map((route) => {
        if (route.path === '/') {
          return {
            index: true,
            element: buildRouteElement(route),
          };
        }

        return {
          path: route.path.replace(/^\//u, ''),
          element: buildRouteElement(route),
        };
      }),
    },
    {
      path: '*',
      element: <Navigate to="/" replace />,
    },
  ]);
}
