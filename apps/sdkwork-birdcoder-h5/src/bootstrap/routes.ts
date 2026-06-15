export interface RouteDefinition {
  id: string;
  path: string;
  component: string;
  auth: 'required' | 'optional' | 'public';
  titleKey: string;
}

export function createRoutes(): RouteDefinition[] {
  // Route assembly follows APP_H5_ARCHITECTURE_SPEC.md
  // Route id format: <surface>.<domain>.<capability>.<screen>
  // Route ids align with PC via APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md
  return [
    {
      id: 'app.iam.login.index',
      path: '/login',
      component: 'LoginPage',
      auth: 'public',
      titleKey: 'route.login',
    },
    {
      id: 'app.chat.index',
      path: '/',
      component: 'ChatPage',
      auth: 'required',
      titleKey: 'route.chat',
    },
  ];
}
