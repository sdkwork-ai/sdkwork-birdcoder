import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

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
  SettingsPage: LazySettingsPage,
};

export function resolveBirdCoderH5RouteComponent(componentKey: string) {
  const Component = ROUTE_COMPONENTS[componentKey];
  if (!Component) {
    throw new Error(`Unknown BirdCoder H5 route component: ${componentKey}`);
  }

  return <Component />;
}
