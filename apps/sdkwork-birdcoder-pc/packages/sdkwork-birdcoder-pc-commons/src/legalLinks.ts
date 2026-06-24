export interface BirdCoderLegalLinks {
  officialWebsiteUrl: string;
  privacyPolicyUrl: string;
  supportUrl: string;
  termsOfServiceUrl: string;
}

const DEFAULT_BIRDCODER_LEGAL_LINKS: BirdCoderLegalLinks = {
  officialWebsiteUrl: 'https://sdkwork.com/apps/sdkwork-birdcoder',
  privacyPolicyUrl: 'https://sdkwork.com/privacy',
  supportUrl: 'https://sdkwork.com/support',
  termsOfServiceUrl: 'https://sdkwork.com/terms',
};

function readPublicEnv(key: string): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  };
  const value = String(meta.env?.[key] ?? '').trim();
  return value || undefined;
}

export function resolveBirdCoderLegalLinks(): BirdCoderLegalLinks {
  return {
    officialWebsiteUrl:
      readPublicEnv('VITE_SDKWORK_BIRDCODER_OFFICIAL_WEBSITE_URL')
      ?? readPublicEnv('VITE_BIRDCODER_OFFICIAL_WEBSITE_URL')
      ?? DEFAULT_BIRDCODER_LEGAL_LINKS.officialWebsiteUrl,
    privacyPolicyUrl:
      readPublicEnv('VITE_SDKWORK_BIRDCODER_PRIVACY_POLICY_URL')
      ?? readPublicEnv('VITE_BIRDCODER_PRIVACY_POLICY_URL')
      ?? DEFAULT_BIRDCODER_LEGAL_LINKS.privacyPolicyUrl,
    supportUrl:
      readPublicEnv('VITE_SDKWORK_BIRDCODER_SUPPORT_URL')
      ?? readPublicEnv('VITE_BIRDCODER_SUPPORT_URL')
      ?? DEFAULT_BIRDCODER_LEGAL_LINKS.supportUrl,
    termsOfServiceUrl:
      readPublicEnv('VITE_SDKWORK_BIRDCODER_TERMS_OF_SERVICE_URL')
      ?? readPublicEnv('VITE_BIRDCODER_TERMS_OF_SERVICE_URL')
      ?? DEFAULT_BIRDCODER_LEGAL_LINKS.termsOfServiceUrl,
  };
}
