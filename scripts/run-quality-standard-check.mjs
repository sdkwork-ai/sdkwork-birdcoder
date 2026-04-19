import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { runCommandSequence } from './run-command-sequence.mjs';

export const QUALITY_STANDARD_CHECK_COMMANDS = [
  'node scripts/run-workspace-package-script.mjs . check:desktop',
  'node scripts/run-workspace-package-script.mjs . check:server',
  'node scripts/run-workspace-package-script.mjs . check:web-vite-build',
  'node scripts/run-workspace-package-script.mjs . check:web-bundle-budget',
  'node scripts/run-workspace-package-script.mjs . server:build',
  'node scripts/run-workspace-package-script.mjs . docs:build',
];

export function runQualityStandardCheck({
  commands = QUALITY_STANDARD_CHECK_COMMANDS,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  return runCommandSequence({ commands, cwd, env });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runQualityStandardCheck());
}
