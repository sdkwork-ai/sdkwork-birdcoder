export const BIRDCODER_DEPLOYMENT_PROFILES = ['standalone', 'cloud'] as const;
export const BIRDCODER_ENVIRONMENTS = [
  'development',
  'test',
  'staging',
  'production',
] as const;

export type BirdCoderDeploymentProfile = typeof BIRDCODER_DEPLOYMENT_PROFILES[number];
export type BirdCoderEnvironment = typeof BIRDCODER_ENVIRONMENTS[number];

export interface BirdCoderMiniProgramRuntimeConfig {
  readonly environment: BirdCoderEnvironment;
  readonly deploymentProfile: BirdCoderDeploymentProfile;
  readonly runtimeTarget: 'mini-program';
  readonly profileId: `${BirdCoderDeploymentProfile}.${BirdCoderEnvironment}`;
  readonly applicationApiBaseUrl: string;
  readonly platformApiGatewayBaseUrl?: string;
}

interface BirdCoderMiniProgramRuntimeInput {
  readonly SDKWORK_ENVIRONMENT?: string;
  readonly SDKWORK_DEPLOYMENT_PROFILE?: string;
  readonly SDKWORK_RUNTIME_TARGET?: string;
  readonly SDKWORK_BIRDCODER_ENVIRONMENT?: string;
  readonly SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE?: string;
  readonly SDKWORK_BIRDCODER_PROFILE_ID?: string;
  readonly SDKWORK_BIRDCODER_RUNTIME_TARGET?: string;
  readonly SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL?: string;
  readonly SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL?: string;
}

function requireAllowedValue<TValue extends string>(
  value: string | undefined,
  allowed: readonly TValue[],
  label: string,
): TValue {
  if (!value || !allowed.includes(value as TValue)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value as TValue;
}

function requireHttpUrl(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  if (!/^https?:\/\/[^\s]+$/u.test(value)) {
    throw new Error(`${label} must be an HTTP(S) URL.`);
  }
  return value.replace(/\/$/u, '');
}

export function parseBirdCoderMiniProgramRuntimeConfig(
  input: BirdCoderMiniProgramRuntimeInput,
): BirdCoderMiniProgramRuntimeConfig {
  const deploymentProfile = requireAllowedValue(
    input.SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE ?? input.SDKWORK_DEPLOYMENT_PROFILE,
    BIRDCODER_DEPLOYMENT_PROFILES,
    'BirdCoder deployment profile',
  );
  const environment = requireAllowedValue(
    input.SDKWORK_BIRDCODER_ENVIRONMENT ?? input.SDKWORK_ENVIRONMENT,
    BIRDCODER_ENVIRONMENTS,
    'BirdCoder environment',
  );
  const runtimeTarget = input.SDKWORK_BIRDCODER_RUNTIME_TARGET ?? input.SDKWORK_RUNTIME_TARGET;
  if (runtimeTarget !== 'mini-program') {
    throw new Error('BirdCoder runtime target must be mini-program.');
  }
  const profileId = `${deploymentProfile}.${environment}` as const;
  if (input.SDKWORK_BIRDCODER_PROFILE_ID !== profileId) {
    throw new Error(`BirdCoder profile id must be ${profileId}.`);
  }
  const platformApiGatewayBaseUrl = input.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL
    ? requireHttpUrl(
        input.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
        'SDKWork platform API gateway URL',
      )
    : undefined;
  if (deploymentProfile === 'cloud' && !platformApiGatewayBaseUrl) {
    throw new Error('Cloud profiles require the SDKWork platform API gateway URL.');
  }

  return {
    environment,
    deploymentProfile,
    runtimeTarget,
    profileId,
    applicationApiBaseUrl: requireHttpUrl(
      input.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL,
      'BirdCoder application API URL',
    ),
    ...(platformApiGatewayBaseUrl ? { platformApiGatewayBaseUrl } : {}),
  };
}
