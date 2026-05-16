import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { runCommandSequence } from './run-command-sequence.mjs';

const DEFAULT_CLOUD_APP_API_BASE_URL = 'https://app-api.example.com';

export const SAMPLE_IAM_DEFAULT_COMMANDS = [
  'node scripts/run-workspace-package-script.mjs . iam:show:desktop:local',
  'node scripts/run-workspace-package-script.mjs . iam:show:desktop:private',
  'node scripts/run-workspace-package-script.mjs . iam:show:desktop:external',
  'node scripts/run-workspace-package-script.mjs . iam:show:web:private',
  'node scripts/run-workspace-package-script.mjs . iam:show:web:external',
  'node scripts/run-workspace-package-script.mjs . iam:show:server:private',
  'node scripts/run-workspace-package-script.mjs . iam:show:server:external',
  'node scripts/run-workspace-package-script.mjs . web:build:private',
  'node scripts/run-workspace-package-script.mjs . web:build:external',
  'node scripts/run-workspace-package-script.mjs . server:build:private',
  'node scripts/run-workspace-package-script.mjs . server:build:external',
];

export const SAMPLE_IAM_CLOUD_COMMANDS = [
  'node scripts/run-workspace-package-script.mjs . iam:show:desktop:cloud',
  'node scripts/run-workspace-package-script.mjs . iam:show:web:cloud',
  'node scripts/run-workspace-package-script.mjs . iam:show:server:cloud',
  'node scripts/run-workspace-package-script.mjs . web:build:cloud',
  'node scripts/run-workspace-package-script.mjs . server:build:cloud',
];

function createCloudIamEnv(env = process.env) {
  const configuredBaseUrl = String(env.SDKWORK_USER_CENTER_APP_API_BASE_URL ?? '').trim();

  return {
    ...env,
    SDKWORK_USER_CENTER_APP_API_BASE_URL:
      configuredBaseUrl || DEFAULT_CLOUD_APP_API_BASE_URL,
  };
}

export function runSampleIamCheck({
  cloudCommands = SAMPLE_IAM_CLOUD_COMMANDS,
  cloudEnv,
  commands = SAMPLE_IAM_DEFAULT_COMMANDS,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  const baseStatus = runCommandSequence({
    commands,
    cwd,
    env,
  });
  if (baseStatus !== 0) {
    return baseStatus;
  }

  return runCommandSequence({
    commands: cloudCommands,
    cwd,
    env: cloudEnv ?? createCloudIamEnv(env),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runSampleIamCheck());
}
