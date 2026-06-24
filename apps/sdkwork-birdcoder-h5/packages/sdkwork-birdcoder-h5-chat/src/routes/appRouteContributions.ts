export const BIRDCODER_H5_CHAT_ROUTE_CONTRIBUTIONS = [
  {
    id: 'app.chat.index',
    path: '/',
    component: 'ChatPage',
    auth: 'required',
    titleKey: 'route.chat',
    presentation: 'tab',
    tabLabelKey: 'route.chat',
  },
  {
    id: 'app.settings.index',
    path: '/settings',
    component: 'SettingsPage',
    auth: 'required',
    titleKey: 'route.settings',
    presentation: 'tab',
    tabLabelKey: 'route.settings',
  },
] as const;
