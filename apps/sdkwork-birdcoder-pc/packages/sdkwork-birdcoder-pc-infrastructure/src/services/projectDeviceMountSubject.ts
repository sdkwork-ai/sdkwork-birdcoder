import type { ProjectDeviceMountSubjectProvider } from './ProjectDeviceMountRegistry.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { getBirdCoderIamRuntime } from './iamRuntime.ts';

function resolveDeviceMountRealm(): string {
  const iamRuntime = getBirdCoderIamRuntime();
  const configuredApiBaseUrl = getDefaultBirdCoderIdeServicesRuntimeConfig().apiBaseUrl?.trim();
  if (configuredApiBaseUrl) {
    return [
      iamRuntime.config.appId,
      iamRuntime.config.deploymentMode,
      iamRuntime.config.environment,
      configuredApiBaseUrl.replace(/\/+$/u, ''),
    ].join('\u0001');
  }

  if (typeof location !== 'undefined' && location.origin) {
    return [
      iamRuntime.config.appId,
      iamRuntime.config.deploymentMode,
      iamRuntime.config.environment,
      location.origin,
    ].join('\u0001');
  }

  return [
    iamRuntime.config.appId,
    iamRuntime.config.deploymentMode,
    iamRuntime.config.environment,
    'sdkwork-birdcoder-device-local',
  ].join('\u0001');
}

export function createProjectDeviceMountSubjectProvider(): ProjectDeviceMountSubjectProvider {
  const realm = resolveDeviceMountRealm();
  return async () => {
    const context = await getBirdCoderIamRuntime().contextStore.getAppContext();
    const tenantId = context?.tenantId?.trim();
    const userId = context?.userId?.trim();
    if (!tenantId || !userId) {
      return null;
    }

    const organizationId = context?.organizationId?.trim() || '0';
    return {
      realm,
      subjectId: [tenantId, organizationId, userId].join('\u0001'),
    };
  };
}
