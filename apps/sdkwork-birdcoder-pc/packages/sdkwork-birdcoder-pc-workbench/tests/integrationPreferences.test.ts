import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INTEGRATION_PREFERENCES,
  isCanonicalIntegrationPreferences,
  normalizeBrowserSiteOrigin,
  normalizeIntegrationPreferences,
} from '../src/settings/integrationPreferences.ts';

describe('integration preferences', () => {
  it('normalizes imported values without accepting unsafe site schemes', () => {
    const preferences = normalizeIntegrationPreferences({
      browserAllowedSites: [
        'https://example.com/path',
        'https://example.com/another',
        'javascript:alert(1)',
      ],
      browserApprovalPolicy: 'trusted-sites',
      browserDownloadLocation: '  Downloads  ',
      browserEnabled: false,
      computerAlwaysAllowedApps: ['Visual Studio Code', ' visual studio code ', 'Terminal'],
      computerAnyAppEnabled: true,
    });

    expect(preferences.browserAllowedSites).toEqual(['https://example.com']);
    expect(preferences.browserDownloadLocation).toBe('Downloads');
    expect(preferences.browserEnabled).toBe(false);
    expect(preferences.computerAlwaysAllowedApps).toEqual(['Visual Studio Code', 'Terminal']);
    expect(normalizeBrowserSiteOrigin('file:///tmp/index.html')).toBeNull();
  });

  it('recognizes only complete canonical records', () => {
    expect(isCanonicalIntegrationPreferences(DEFAULT_INTEGRATION_PREFERENCES)).toBe(true);
    expect(isCanonicalIntegrationPreferences({ browserEnabled: true })).toBe(false);
    expect(isCanonicalIntegrationPreferences({
      ...DEFAULT_INTEGRATION_PREFERENCES,
      browserAllowedSites: null,
    })).toBe(false);
  });
});
