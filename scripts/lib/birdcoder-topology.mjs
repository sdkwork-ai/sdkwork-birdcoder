import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildProfileId,
  createTopologyRuntime,
  isTcpPortReachable,
  loadTopologySpec,
  normalizeText,
  waitForHttpHealthy,
} from '@sdkwork/app-topology';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const SPEC_PATH = path.join(REPO_ROOT, 'specs/topology.spec.json');
export const IAM_REPO_ROOT = path.resolve(REPO_ROOT, '..', 'sdkwork-iam');

export const IAM_APPLICATION_BOOTSTRAP_ENV = {
  SDKWORK_APP_ROOT: REPO_ROOT,
  SDKWORK_BIRDCODER_APP_ROOT: REPO_ROOT,
  SDKWORK_IAM_APP_ROOT: IAM_REPO_ROOT,
};

const spec = loadTopologySpec(SPEC_PATH);
const runtime = createTopologyRuntime(spec, REPO_ROOT);

export const DEFAULT_DEV_PROFILE_ID = runtime.defaults.developmentProfileId;
export const DEFAULT_PRODUCTION_PROFILE_ID = runtime.defaults.productionProfileId;

export function resolveDevProfileId(deploymentProfile, serviceLayout = 'split-services') {
  runtime.assertDeploymentProfile(deploymentProfile);
  runtime.assertServiceLayout(serviceLayout);
  return buildProfileId(deploymentProfile, serviceLayout, 'development');
}

export function resolveProfileIdFromIamMode(iamMode, environment = 'development') {
  if (iamMode === 'cloud-saas') {
    return buildProfileId('cloud', 'split-services', environment);
  }

  if (iamMode === 'desktop-local') {
    return buildProfileId('standalone', 'unified-process', environment);
  }

  return buildProfileId('standalone', 'split-services', environment);
}

export function resolveIamModeFromTopology(deploymentProfile, serviceLayout = 'split-services') {
  if (deploymentProfile === 'cloud') {
    return 'cloud-saas';
  }

  if (serviceLayout === 'unified-process') {
    return 'desktop-local';
  }

  return 'server-private';
}

function readTrimmedValue(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue || undefined;
}

export function bridgeLegacyApiEnv(profileEnv = {}) {
  const applicationHttpUrl =
    readTrimmedValue(profileEnv.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL)
    ?? readTrimmedValue(profileEnv.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL);
  const platformHttpUrl =
    readTrimmedValue(profileEnv.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL)
    ?? readTrimmedValue(profileEnv.VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL);
  const bridged = {};

  if (applicationHttpUrl) {
    bridged.BIRDCODER_API_BASE_URL = applicationHttpUrl;
    bridged.VITE_BIRDCODER_API_BASE_URL = applicationHttpUrl;
    bridged.VITE_SDKWORK_BIRDCODER_APP_API_BASE_URL = applicationHttpUrl;
    bridged.VITE_SDKWORK_BIRDCODER_BACKEND_API_BASE_URL = applicationHttpUrl;
  }

  if (platformHttpUrl) {
    bridged.SDKWORK_IAM_APP_API_BASE_URL = platformHttpUrl;
  }

  return bridged;
}

function isProductionTarget(target) {
  return target === 'desktop-build' || target === 'web-build' || target === 'server-build';
}

export function applyTopologyProfileToEnv({
  env = process.env,
  iamMode,
  target = 'desktop-dev',
  viteMode = 'development',
} = {}) {
  const environment = isProductionTarget(target) ? 'production' : 'development';
  const profileId = resolveProfileIdFromIamMode(iamMode, environment);
  const profile = loadProfile(profileId);

  return mergeRuntimeEnv(
    env,
    profile.env,
    bridgeLegacyApiEnv(profile.env),
    resolveIamDevEnv(env),
    {
      SDKWORK_BIRDCODER_PROFILE_ID: profileId,
      ...IAM_APPLICATION_BOOTSTRAP_ENV,
    },
  );
}

export const loadProfile = runtime.loadProfile;
export const applyProfileEnv = runtime.applyProfileEnv;
export const mergeRuntimeEnv = runtime.mergeRuntimeEnv;
export const loadEnvFile = runtime.loadEnvFile;
export const assertDeploymentProfile = runtime.assertDeploymentProfile;
export const assertServiceLayout = runtime.assertServiceLayout;
export const resolveSurfaceHttpUrl = runtime.resolveSurfaceHttpUrl.bind(runtime);
export const resolveSurfaceBind = runtime.resolveSurfaceBind.bind(runtime);
export const shouldAutostartGateway = runtime.shouldAutostartGateway;
export const resolveGatewayBind = runtime.resolveGatewayBind;
export const resolveGatewayBaseUrl = runtime.resolveGatewayBaseUrl;
export const resolveIamDevEnv = runtime.resolveIamDevEnv;
export const listHealthSurfaces = runtime.listHealthSurfaces;
export const listOrchestrationProcesses = runtime.listOrchestrationProcesses;

export { buildProfileId, normalizeText, isTcpPortReachable, waitForHttpHealthy, spec, runtime };
