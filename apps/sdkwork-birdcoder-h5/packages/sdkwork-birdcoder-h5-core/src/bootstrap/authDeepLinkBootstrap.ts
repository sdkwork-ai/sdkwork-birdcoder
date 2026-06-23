import { getBirdCoderDeepLinkAdapter } from '../host/deepLinkAdapter.ts';

function navigateToAuthPath(authPath: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const target = authPath.startsWith('/') ? authPath : `/${authPath}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === target) {
    return;
  }

  window.history.replaceState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function startBirdCoderAuthDeepLinkRouting(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const deepLinks = getBirdCoderDeepLinkAdapter();
  if (!deepLinks.available) {
    return;
  }

  void deepLinks.readInitialAuthPath().then((path) => {
    if (!path?.startsWith('/auth')) {
      return;
    }

    navigateToAuthPath(path);
  });

  deepLinks.subscribe((path) => {
    if (!path.startsWith('/auth')) {
      return;
    }

    navigateToAuthPath(path);
  });
}
