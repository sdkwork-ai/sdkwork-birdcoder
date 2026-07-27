import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MINI_PROGRAM_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
export const WORKSPACE_ROOT = path.resolve(MINI_PROGRAM_ROOT, '..', '..');

export const DEPLOYMENT_PROFILES = ['standalone', 'cloud'];
export const ENVIRONMENTS = ['development', 'test', 'staging', 'production'];

function requireAllowed(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

export function parseBuildArgs(argv) {
  let deploymentProfile = 'cloud';
  let environment = 'production';
  let watch = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--deployment-profile') {
      deploymentProfile = String(argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (token === '--environment') {
      environment = String(argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (token === '--watch') {
      watch = true;
      continue;
    }
    throw new Error(`Unsupported mini program build option: ${token}`);
  }
  return {
    deploymentProfile: requireAllowed(
      deploymentProfile,
      DEPLOYMENT_PROFILES,
      'Deployment profile',
    ),
    environment: requireAllowed(environment, ENVIRONMENTS, 'Environment'),
    watch,
  };
}

export function runtimeConfigPath(deploymentProfile, environment) {
  return path.join(
    MINI_PROGRAM_ROOT,
    'config',
    'mini-program',
    `runtime-env.${deploymentProfile}.${environment}.json`,
  );
}
