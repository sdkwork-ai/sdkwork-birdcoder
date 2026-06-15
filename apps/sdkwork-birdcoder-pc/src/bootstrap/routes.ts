export interface RouteDefinition {
  id: string;
  path: string;
  component: string;
  auth: 'required' | 'optional' | 'public';
}

export function createRoutes(): RouteDefinition[] {
  // Route assembly follows APP_PC_ARCHITECTURE_SPEC.md
  // Routes are contributed by capability packages
  // Route id format: <surface>.<domain>.<capability>.<screen>
  return [
    {
      id: 'app.iam.login.index',
      path: '/login',
      component: 'LoginPage',
      auth: 'public',
    },
    {
      id: 'app.chat.index',
      path: '/',
      component: 'ChatPage',
      auth: 'required',
    },
  ];
}
