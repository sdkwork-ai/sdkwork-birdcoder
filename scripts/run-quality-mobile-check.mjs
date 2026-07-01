import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { runCommandSequence } from './run-command-sequence.mjs';

export const QUALITY_MOBILE_CHECK_COMMANDS = [
  'node scripts/h5-architecture-boundary-contract.test.mjs',
  'node scripts/h5-sdk-assembly-contract.test.mjs',
  'node scripts/h5-route-assembly-contract.test.mjs',
  'node scripts/h5-app-session-persistence-contract.test.mjs',
  'node scripts/flutter-sdk-assembly-contract.test.mjs',
  'node scripts/flutter-mobile-product-parity-contract.test.mjs',
  'node scripts/flutter-mobile-chat-api-contract.test.mjs',
  'node scripts/flutter-mobile-auth-surface-contract.test.mjs',
  'node scripts/flutter-iam-session-storage-contract.test.mjs',
];

export function runQualityMobileCheck({
  commands = QUALITY_MOBILE_CHECK_COMMANDS,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  return runCommandSequence({ commands, cwd, env });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runQualityMobileCheck());
}
