import type {
  ApplicationPublishErrorCode,
  ApplicationPublishFramework,
  ApplicationPublishOutputType,
  ApplicationPublishPreflightCheck,
  ApplicationPublishProgress,
  ApplicationPublishStage,
  ApplicationPublishTarget,
  PublishableApplication,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export const APPLICATION_PUBLISH_STAGE_ORDER: readonly ApplicationPublishStage[] = [
  'building',
  'packaging',
  'uploading',
  'registering',
  'releasing',
  'deploying',
  'completed',
];

const APPLICATION_FRAMEWORK_TRANSLATION_KEYS: Record<ApplicationPublishFramework, string> = {
  flutter: 'code.publish.frameworkFlutter',
  'mini-program': 'code.publish.frameworkMiniProgram',
  react: 'code.publish.frameworkReact',
  sdkwork: 'code.publish.frameworkSdkwork',
  'static-web': 'code.publish.frameworkStaticWeb',
  unknown: 'code.publish.frameworkUnknown',
  vue: 'code.publish.frameworkVue',
};

const PREFLIGHT_CHECK_TRANSLATION_KEYS: Readonly<Record<
  string,
  Partial<Record<ApplicationPublishPreflightCheck['status'], string>>
>> = {
  application_identity: {
    passed: 'code.publish.checkApplicationIdentityStable',
    warning: 'code.publish.checkApplicationIdentityLegacy',
  },
  manifest_valid: {
    passed: 'code.publish.checkManifestValid',
  },
  single_release_artifact: {
    failed: 'code.publish.checkSingleReleaseArtifactRequired',
    passed: 'code.publish.checkSingleReleaseArtifactReady',
  },
  target_ready: {
    failed: 'code.publish.checkTargetNotReady',
    passed: 'code.publish.checkTargetReady',
  },
};

const PUBLISH_ERROR_TRANSLATION_KEYS: Readonly<
  Record<ApplicationPublishErrorCode, string>
> = {
  artifact_unavailable: 'code.publish.errorArtifactUnavailable',
  build_failed: 'code.publish.errorBuildFailed',
  cloud_publish_failed: 'code.publish.errorCloudPublishFailed',
  desktop_runtime_required: 'code.publish.errorDesktopRuntimeRequired',
  discovery_failed: 'code.publish.errorDiscoveryFailed',
  invalid_host_response: 'code.publish.errorInvalidHostResponse',
  preflight_failed: 'code.publish.errorPreflightFailed',
  project_required: 'code.publish.errorProjectRequired',
};

const SEMANTIC_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;

const MOBILE_OUTPUT_TYPES: ReadonlySet<ApplicationPublishOutputType> = new Set([
  'android-aab',
  'android-apk',
  'ios-ipa',
  'mini-program',
]);

export function getApplicationFrameworkTranslationKey(
  framework: ApplicationPublishFramework,
): string {
  return APPLICATION_FRAMEWORK_TRANSLATION_KEYS[framework];
}

export function getApplicationPublishPreflightCheckTranslationKey(
  code: string,
  status: ApplicationPublishPreflightCheck['status'],
): string | undefined {
  return PREFLIGHT_CHECK_TRANSLATION_KEYS[code]?.[status];
}

export function getApplicationPublishErrorTranslationKey(
  code: string,
): string | undefined {
  return PUBLISH_ERROR_TRANSLATION_KEYS[code as ApplicationPublishErrorCode];
}

export function isValidApplicationPublishVersion(value: string): boolean {
  const normalized = value.trim();
  return normalized.length <= 100 && SEMANTIC_VERSION_PATTERN.test(normalized);
}

export function supportsAutomaticDeployment(
  application: PublishableApplication,
  target: ApplicationPublishTarget | undefined,
): boolean {
  if (!target || application.framework === 'mini-program' || application.framework === 'unknown') {
    return false;
  }
  return !target.outputs.some((output) => MOBILE_OUTPUT_TYPES.has(output.type));
}

export function shouldDeployAfterReleaseByDefault(
  application: PublishableApplication,
  target: ApplicationPublishTarget | undefined,
): boolean {
  return application.framework !== 'flutter'
    && supportsAutomaticDeployment(application, target);
}

export function selectInitialPublishApplication(
  applications: readonly PublishableApplication[],
): PublishableApplication | undefined {
  return applications.find((application) => application.readiness === 'ready')
    ?? applications[0];
}

export function resolveApplicationPublishPercent(
  progress: readonly ApplicationPublishProgress[],
  stageOrder: readonly ApplicationPublishStage[] = APPLICATION_PUBLISH_STAGE_ORDER,
): number {
  const latest = progress.at(-1);
  if (!latest) {
    return 0;
  }
  const stageIndex = stageOrder.indexOf(latest.stage);
  if (stageIndex < 0) {
    return 0;
  }
  const terminalStageIndex = stageOrder.length - 1;
  if (terminalStageIndex <= 0 || stageIndex >= terminalStageIndex) {
    return 100;
  }
  const stagePercent = typeof latest.percent === 'number'
    ? Math.max(0, Math.min(100, latest.percent))
    : 0;
  return Math.round(((stageIndex + stagePercent / 100) / terminalStageIndex) * 100);
}
