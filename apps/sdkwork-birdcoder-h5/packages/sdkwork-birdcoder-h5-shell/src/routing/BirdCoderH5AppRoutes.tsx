import { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { createBirdCoderH5AppRouter } from './createBirdCoderH5AppRouter.tsx';

export function BirdCoderH5AppRoutes() {
  const router = useMemo(() => createBirdCoderH5AppRouter(), []);
  return <RouterProvider router={router} />;
}
