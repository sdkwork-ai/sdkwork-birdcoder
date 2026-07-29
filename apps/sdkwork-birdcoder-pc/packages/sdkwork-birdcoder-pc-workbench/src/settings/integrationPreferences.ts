export const BROWSER_LINK_OPEN_TARGETS = ['system', 'birdcoder'] as const;
export type BrowserLinkOpenTarget = (typeof BROWSER_LINK_OPEN_TARGETS)[number];

export const BROWSER_SCREENSHOT_POLICIES = ['always', 'ask', 'never'] as const;
export type BrowserScreenshotPolicy = (typeof BROWSER_SCREENSHOT_POLICIES)[number];

export const BROWSER_APPROVAL_POLICIES = ['always-ask', 'trusted-sites', 'never-ask'] as const;
export type BrowserApprovalPolicy = (typeof BROWSER_APPROVAL_POLICIES)[number];

export interface IntegrationPreferences {
  browserAllowedSites: string[];
  browserApprovalPolicy: BrowserApprovalPolicy;
  browserAskDownloadLocation: boolean;
  browserDownloadLocation: string;
  browserEnabled: boolean;
  browserLocalLinkOpenTarget: BrowserLinkOpenTarget;
  browserScreenshotPolicy: BrowserScreenshotPolicy;
  browserWebLinkOpenTarget: BrowserLinkOpenTarget;
  computerAlwaysAllowedApps: string[];
  computerAnyAppEnabled: boolean;
  computerChromeEnabled: boolean;
}

export const DEFAULT_INTEGRATION_PREFERENCES: IntegrationPreferences = {
  browserAllowedSites: [],
  browserApprovalPolicy: 'always-ask',
  browserAskDownloadLocation: false,
  browserDownloadLocation: '',
  browserEnabled: true,
  browserLocalLinkOpenTarget: 'birdcoder',
  browserScreenshotPolicy: 'always',
  browserWebLinkOpenTarget: 'system',
  computerAlwaysAllowedApps: [],
  computerAnyAppEnabled: false,
  computerChromeEnabled: false,
};

const MAX_ALLOWED_SITES = 50;
const MAX_ALLOWED_APPS = 50;
const MAX_DOWNLOAD_LOCATION_LENGTH = 512;
const MAX_APP_NAME_LENGTH = 160;

function normalizeEnum<TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[],
  fallback: TValue,
): TValue {
  return typeof value === 'string' && allowedValues.includes(value as TValue)
    ? value as TValue
    : fallback;
}

export function normalizeBrowserSiteOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2_048) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeBrowserAllowedSites(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const origins: string[] = [];
  const seenOrigins = new Set<string>();
  for (const entry of value) {
    const origin = normalizeBrowserSiteOrigin(entry);
    if (!origin || seenOrigins.has(origin)) {
      continue;
    }
    seenOrigins.add(origin);
    origins.push(origin);
    if (origins.length >= MAX_ALLOWED_SITES) {
      break;
    }
  }
  return origins;
}

function normalizeComputerAllowedApps(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const apps: string[] = [];
  const seenApps = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    const app = entry.trim().slice(0, MAX_APP_NAME_LENGTH);
    const normalizedApp = app.toLocaleLowerCase();
    if (!app || seenApps.has(normalizedApp)) {
      continue;
    }
    seenApps.add(normalizedApp);
    apps.push(app);
    if (apps.length >= MAX_ALLOWED_APPS) {
      break;
    }
  }
  return apps;
}

export function normalizeIntegrationPreferences(
  value: Partial<IntegrationPreferences> | null | undefined,
): IntegrationPreferences {
  return {
    browserAllowedSites: normalizeBrowserAllowedSites(value?.browserAllowedSites),
    browserApprovalPolicy: normalizeEnum(
      value?.browserApprovalPolicy,
      BROWSER_APPROVAL_POLICIES,
      DEFAULT_INTEGRATION_PREFERENCES.browserApprovalPolicy,
    ),
    browserAskDownloadLocation: value?.browserAskDownloadLocation === true,
    browserDownloadLocation: typeof value?.browserDownloadLocation === 'string'
      ? value.browserDownloadLocation.trim().slice(0, MAX_DOWNLOAD_LOCATION_LENGTH)
      : '',
    browserEnabled: value?.browserEnabled !== false,
    browserLocalLinkOpenTarget: normalizeEnum(
      value?.browserLocalLinkOpenTarget,
      BROWSER_LINK_OPEN_TARGETS,
      DEFAULT_INTEGRATION_PREFERENCES.browserLocalLinkOpenTarget,
    ),
    browserScreenshotPolicy: normalizeEnum(
      value?.browserScreenshotPolicy,
      BROWSER_SCREENSHOT_POLICIES,
      DEFAULT_INTEGRATION_PREFERENCES.browserScreenshotPolicy,
    ),
    browserWebLinkOpenTarget: normalizeEnum(
      value?.browserWebLinkOpenTarget,
      BROWSER_LINK_OPEN_TARGETS,
      DEFAULT_INTEGRATION_PREFERENCES.browserWebLinkOpenTarget,
    ),
    computerAlwaysAllowedApps: normalizeComputerAllowedApps(value?.computerAlwaysAllowedApps),
    computerAnyAppEnabled: value?.computerAnyAppEnabled === true,
    computerChromeEnabled: value?.computerChromeEnabled === true,
  };
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function integrationPreferencesEqual(
  left: IntegrationPreferences,
  right: IntegrationPreferences,
): boolean {
  return (
    stringArraysEqual(left.browserAllowedSites, right.browserAllowedSites)
    && left.browserApprovalPolicy === right.browserApprovalPolicy
    && left.browserAskDownloadLocation === right.browserAskDownloadLocation
    && left.browserDownloadLocation === right.browserDownloadLocation
    && left.browserEnabled === right.browserEnabled
    && left.browserLocalLinkOpenTarget === right.browserLocalLinkOpenTarget
    && left.browserScreenshotPolicy === right.browserScreenshotPolicy
    && left.browserWebLinkOpenTarget === right.browserWebLinkOpenTarget
    && stringArraysEqual(left.computerAlwaysAllowedApps, right.computerAlwaysAllowedApps)
    && left.computerAnyAppEnabled === right.computerAnyAppEnabled
    && left.computerChromeEnabled === right.computerChromeEnabled
  );
}

export function isCanonicalIntegrationPreferences(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const rawValue = value as Record<string, unknown>;
  const canonicalKeys = Object.keys(DEFAULT_INTEGRATION_PREFERENCES);
  if (
    Object.keys(rawValue).length !== canonicalKeys.length
    || canonicalKeys.some((key) => !(key in rawValue))
    || !Array.isArray(rawValue.browserAllowedSites)
    || !Array.isArray(rawValue.computerAlwaysAllowedApps)
  ) {
    return false;
  }
  const normalized = normalizeIntegrationPreferences(value as Partial<IntegrationPreferences>);
  return integrationPreferencesEqual(value as IntegrationPreferences, normalized);
}
