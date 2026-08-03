import { describe, expect, it } from 'vitest';

import {
  BIRDCODER_OFFICIAL_MODEL_RELAY_BASE_URL,
  isKnownBirdCoderModelVendor,
  resolveBirdCoderModelRelayBaseUrl,
  resolveBirdCoderVendorProtocol,
  type BirdCoderModelVendorProtocol,
} from './agentModelRelayConfig.ts';

describe('agentModelRelayConfig', () => {
  it('keeps the official BirdCoder relay as the default recommended domain', () => {
    expect(BIRDCODER_OFFICIAL_MODEL_RELAY_BASE_URL).toBe('https://api.birdcoder.com');
    expect(resolveBirdCoderModelRelayBaseUrl()).toBe('https://api.birdcoder.com/v1');
  });

  it('appends the vendor protocol path convention to the relay root', () => {
    const cases: Array<[BirdCoderModelVendorProtocol | null, string]> = [
      ['openai_compatible', 'https://api.birdcoder.com/v1'],
      [null, 'https://api.birdcoder.com/v1'],
      ['anthropic_messages', 'https://api.birdcoder.com'],
      // The gemini-cli gateway convention uses a root URL: the SDK appends
      // its own /v1beta API version path.
      ['google_gemini', 'https://api.birdcoder.com'],
    ];
    for (const [protocol, expected] of cases) {
      expect(resolveBirdCoderModelRelayBaseUrl(protocol)).toBe(expected);
    }
  });

  it('maps vendor codes to their wire protocols', () => {
    expect(resolveBirdCoderVendorProtocol('openai')).toBe('openai_compatible');
    expect(resolveBirdCoderVendorProtocol('anthropic')).toBe('anthropic_messages');
    expect(resolveBirdCoderVendorProtocol('google')).toBe('google_gemini');
    expect(resolveBirdCoderVendorProtocol('deepseek')).toBe('openai_compatible');
    expect(resolveBirdCoderVendorProtocol('')).toBe('openai_compatible');
    expect(isKnownBirdCoderModelVendor('openai')).toBe(true);
    expect(isKnownBirdCoderModelVendor('ANTHROPIC')).toBe(true);
    expect(isKnownBirdCoderModelVendor('deepseek')).toBe(false);
    expect(isKnownBirdCoderModelVendor(null)).toBe(false);
  });
});
