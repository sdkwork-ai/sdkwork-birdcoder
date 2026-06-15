import { createBrowserRouter } from 'react-router-dom';

export function createAppRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: 'Chat Page',
    },
    {
      path: '/login',
      element: 'Login Page',
    },
    {
      path: '/settings',
      element: 'Settings Page',
    },
  ]);
}
