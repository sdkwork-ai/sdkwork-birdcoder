import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { runCommandSequence } from './run-command-sequence.mjs';

export const QUALITY_RELEASE_CHECK_COMMANDS = [
  'node scripts/run-workspace-package-script.mjs . check:quality:fast',
  'node scripts/run-workspace-package-script.mjs . check:quality:standard',
  'node scripts/run-workspace-package-script.mjs . check:quality-matrix',
  'node scripts/run-workspace-package-script.mjs . check:release-flow',
  'node scripts/run-workspace-package-script.mjs . check:ci-flow',
  'node scripts/run-workspace-package-script.mjs . check:governance-regression',
];

export function runQualityReleaseCheck({
  commands = QUALITY_RELEASE_CHECK_COMMANDS,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  return runCommandSequence({ commands, cwd, env });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runQualityReleaseCheck());
}
