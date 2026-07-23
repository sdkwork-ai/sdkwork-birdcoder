import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  BIRDCODER_WORKSPACE_ROOT_DIR,
  runCommandSequence,
} from './run-command-sequence.mjs';

export const QUALITY_FAST_CHECK_COMMANDS = Object.freeze([
  'node scripts/run-workspace-package-script.mjs . typecheck',
  'node scripts/run-workspace-package-script.mjs . check:package-script-entrypoints',
  'node scripts/run-workspace-package-script.mjs . check:source-parse',
  'node scripts/run-workspace-package-script.mjs . check:api-transport-standard',
  'node scripts/run-workspace-package-script.mjs . check:local-business-storage-boundary',
  'node scripts/run-workspace-package-script.mjs . check:domain-ownership',
  'node scripts/run-workspace-package-script.mjs . check:agents-birdcoder-alignment',
  'node scripts/run-workspace-package-script.mjs . check:kernel-birdcoder-alignment',
  'node scripts/run-workspace-package-script.mjs . test:agent-session-item-view-contract',
  'node scripts/run-workspace-package-script.mjs . test:agent-session-item-semantic-boundary-contract',
  'node scripts/run-workspace-package-script.mjs . check:sdk-family-standard',
  'node scripts/run-workspace-package-script.mjs . check:sdk-family-generated',
  'node scripts/run-workspace-package-script.mjs . check:package-governance',
  'node scripts/run-workspace-package-script.mjs . check:package-subpath-exports',
  'node scripts/run-workspace-package-script.mjs . check:app-composition',
  'node scripts/run-workspace-package-script.mjs . check:technical-debt',
  'node scripts/run-workspace-package-script.mjs . check:arch',
  'node scripts/run-workspace-package-script.mjs . check:sdkwork-birdcoder-structure',
]);

export function runQualityFastCheck({
  commands = QUALITY_FAST_CHECK_COMMANDS,
  cwd = BIRDCODER_WORKSPACE_ROOT_DIR,
  env = process.env,
  spawnSyncImpl,
} = {}) {
  return runCommandSequence({ commands, cwd, env, spawnSyncImpl });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runQualityFastCheck());
}
