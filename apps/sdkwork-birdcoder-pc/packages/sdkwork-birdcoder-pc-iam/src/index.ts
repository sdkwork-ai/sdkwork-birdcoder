export * from './iamIntegration.ts';
export { BirdCoderAuthGate } from './BirdCoderAuthGate.tsx';
export { getBirdCoderIamRuntime } from '@sdkwork/birdcoder-pc-infrastructure';
export { AuthShell } from '@sdkwork/birdcoder-pc-auth';
export {
  AUTH_SURFACE_DEFAULT_ROUTE,
  isAuthSurfaceLocationPath,
  normalizeAuthSurfaceLocationPath,
  readAuthSurfaceHashPath,
  replaceAuthSurfaceHashPath,
  shouldBootIntoAuthSurface,
} from '@sdkwork/birdcoder-pc-auth';
export {
  buildProtectedRouteLoginPath,
  requiresAuthenticatedProductAccess,
  resolveBirdCoderAuthDeploymentMode,
} from '@sdkwork/birdcoder-pc-auth';
