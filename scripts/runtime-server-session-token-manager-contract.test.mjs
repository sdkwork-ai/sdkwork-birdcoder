import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fs.readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeServerSession.ts',
  ),
  'utf8',
);

assert.match(
  source,
  /syncBirdCoderGlobalTokenManagerFromStorage\(\)/u,
  'Runtime server session headers must hydrate the global TokenManager before resolving auth headers.',
);

assert.match(
  source,
  /buildAuthHeaders\('dual-token', undefined, getBirdCoderGlobalTokenManager\(\)\)/u,
  'Runtime server session headers must use the shared dual-token header builder with the global TokenManager.',
);

const resolveHeadersSource =
  source.match(/export function resolveRuntimeServerSessionHeaders\(\)[\s\S]*?\n\}/u)?.[0] ?? '';

assert.doesNotMatch(
  resolveHeadersSource,
  /getStoredAppSessionAuthToken\(|getStoredAppSessionAccessToken\(|getStoredAppSessionRefreshToken\(/u,
  'resolveRuntimeServerSessionHeaders must not assemble auth headers directly from storage bypassing TokenManager.',
);

assert.doesNotMatch(
  resolveHeadersSource,
  /['"]?(?:Authorization|Access-Token)['"]?\s*:/u,
  'resolveRuntimeServerSessionHeaders must not duplicate shared auth header assembly.',
);

console.log('runtime server session token manager contract passed.');
