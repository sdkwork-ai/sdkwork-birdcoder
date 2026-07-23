export * from './iamIntegration.ts';
export { BirdCoderAuthGate } from './BirdCoderAuthGate.tsx';
export { getBirdCoderIamRuntime } from '@sdkwork/birdcoder-pc-infrastructure/services/iamRuntime';
export { AuthShell } from '@sdkwork/birdcoder-pc-auth';
export {
  AUTH_SURFACE_DEFAULT_ROUTE,
  isAuthSurfaceLocationPath,
  normalizeAuthSurfaceLocationPath,
  readAuthSurfaceHashPath,
  replaceAuthSurfaceHashPath,
  shouldBootIntoAuthSurface,
} from '@sdkwork/birdcoder-pc-auth';
