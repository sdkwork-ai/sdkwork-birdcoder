import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IAM_H5_AUTH_ROUTES } from '@sdkwork/iam-h5-auth';
import { BirdCoderH5AuthLoginRoute } from '../auth/BirdCoderH5AuthLoginRoute.tsx';
import { useBirdCoderH5Auth } from '../auth/BirdCoderH5AuthContext.tsx';

const LazyChatPage = lazy(async () => {
  const module = await import('@sdkwork/birdcoder-h5-chat/screens/ChatPage');
  return { default: module.ChatPage };
});

const LazySettingsPage = lazy(async () => {
  const module = await import('@sdkwork/birdcoder-h5-chat/screens/SettingsPage');
  return { default: module.SettingsPage };
});

const ROUTE_COMPONENTS: Record<string, LazyExoticComponent<ComponentType>> = {
  ChatPage: LazyChatPage,
};

function BirdCoderH5SettingsRoute() {
  const navigate = useNavigate();
  const { logout } = useBirdCoderH5Auth();
  return (
    <LazySettingsPage
      onLogout={async () => {
        try {
          await logout();
        } finally {
          navigate(IAM_H5_AUTH_ROUTES.loginPath, { replace: true });
        }
      }}
    />
  );
}

export function resolveBirdCoderH5RouteComponent(componentKey: string) {
  if (componentKey === IAM_H5_AUTH_ROUTES.moduleId) {
    return <BirdCoderH5AuthLoginRoute />;
  }
  if (componentKey === 'SettingsPage') {
    return <BirdCoderH5SettingsRoute />;
  }

  const Component = ROUTE_COMPONENTS[componentKey];
  if (!Component) {
    throw new Error(`Unknown BirdCoder H5 route component: ${componentKey}`);
  }

  return <Component />;
}
