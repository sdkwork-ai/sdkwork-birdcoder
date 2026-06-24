import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  resolveBirdCoderH5RouteTitle,
  resolveBirdCoderH5TabRoutes,
} from '../navigation/tabNavigation.ts';

function tabClassName(isActive: boolean): string {
  return [
    'flex flex-col items-center justify-center flex-1 text-xs transition-colors',
    isActive ? 'text-primary font-medium' : 'text-muted-foreground',
  ].join(' ');
}

const ROUTE_TAB_LABEL_FALLBACK: Record<string, string> = {
  'route.chat': 'Chat',
  'route.settings': 'Settings',
};

export function MobileShellLayout() {
  const location = useLocation();
  const tabRoutes = resolveBirdCoderH5TabRoutes();
  const title = resolveBirdCoderH5RouteTitle(location.pathname);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="flex h-12 items-center justify-between px-4">
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <nav className="sticky bottom-0 border-t bg-background">
        <div className="flex h-14">
          {tabRoutes.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.path}
              end={tab.path === '/'}
              className={({ isActive }) => tabClassName(isActive)}
            >
              {ROUTE_TAB_LABEL_FALLBACK[tab.labelKey] ?? tab.labelKey}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
