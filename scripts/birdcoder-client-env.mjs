#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const BIRDCODER_DEPLOYMENT_PROFILES = ['standalone', 'cloud'];
export const BIRDCODER_ENVIRONMENTS = [
  'development',
  'test',
  'staging',
  'production',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultWorkspaceRootDir = path.resolve(__dirname, '..');

const surfaceDefinitions = {
  pc: {
    appRoot: 'apps/sdkwork-birdcoder-pc',
    format: 'dotenv',
    runtimeTarget: 'browser',
    devBind: '127.0.0.1:5173',
  },
  h5: {
    appRoot: 'apps/sdkwork-birdcoder-h5',
    format: 'dotenv',
    runtimeTarget: 'browser',
    devBind: '127.0.0.1:3001',
  },
  flutter: {
    appRoot: 'apps/sdkwork-birdcoder-flutter-mobile',
    format: 'dart-define-json',
    runtimeTarget: 'flutter-android',
  },
};

function normalizeFromAllowed(value, allowed, label) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!allowed.includes(normalized)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`);
  }
  return normalized;
}

export function normalizeBirdcoderDeploymentProfile(value) {
  return normalizeFromAllowed(
    value,
    BIRDCODER_DEPLOYMENT_PROFILES,
    'BirdCoder deployment profile',
  );
}

export function normalizeBirdcoderEnvironment(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'dev') {
    return 'development';
  }
  if (normalized === 'prod') {
    return 'production';
  }
  return normalizeFromAllowed(
    normalized,
    BIRDCODER_ENVIRONMENTS,
    'BirdCoder environment',
  );
}

export function createBirdcoderProfileId(deploymentProfile, environment) {
  return `${normalizeBirdcoderDeploymentProfile(deploymentProfile)}.${normalizeBirdcoderEnvironment(environment)}`;
}

export function parseBirdcoderDotenv(source) {
  const values = {};
  for (const rawLine of String(source ?? '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      throw new Error(`Invalid BirdCoder dotenv line: ${rawLine}`);
    }
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function ensurePathInsideRoot(rootDir, candidatePath, label) {
  const relativePath = path.relative(rootDir, candidatePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside ${rootDir}.`);
  }
  return candidatePath;
}

export function loadBirdcoderTopologyProfile({
  workspaceRootDir = defaultWorkspaceRootDir,
  deploymentProfile,
  environment,
} = {}) {
  const profileId = createBirdcoderProfileId(deploymentProfile, environment);
  const etcDir = path.join(workspaceRootDir, 'etc');
  const deploymentIndexPath = path.join(etcDir, 'sdkwork.deployment.config.json');
  const deploymentIndex = JSON.parse(readFileSync(deploymentIndexPath, 'utf8'));
  const profileEntry = deploymentIndex.profiles?.[profileId];
  const configuredPath = String(profileEntry?.config ?? '').trim();
  if (!configuredPath) {
    throw new Error(`BirdCoder deployment profile ${profileId} is not configured.`);
  }

  const sourcePath = ensurePathInsideRoot(
    etcDir,
    path.resolve(etcDir, configuredPath),
    `BirdCoder deployment profile ${profileId}`,
  );
  const values = parseBirdcoderDotenv(readFileSync(sourcePath, 'utf8'));
  const declaredProfile = values.SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE;
  const declaredEnvironment = values.SDKWORK_BIRDCODER_ENVIRONMENT;
  const declaredProfileId = values.SDKWORK_BIRDCODER_PROFILE_ID;
  if (declaredProfile !== deploymentProfile) {
    throw new Error(`${profileId} declares an inconsistent deployment profile.`);
  }
  if (declaredEnvironment !== environment) {
    throw new Error(`${profileId} declares an inconsistent environment.`);
  }
  if (declaredProfileId !== profileId) {
    throw new Error(`${profileId} declares an inconsistent profile id.`);
  }

  const applicationUrl = String(
    values.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL ?? '',
  ).trim();
  if (!applicationUrl) {
    throw new Error(`${profileId} must declare the BirdCoder application URL.`);
  }
  if (deploymentProfile === 'cloud') {
    const platformUrl = String(
      values.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL ?? '',
    ).trim();
    if (!platformUrl) {
      throw new Error(`${profileId} must declare the SDKWork platform API URL.`);
    }
  }

  return {
    profileId,
    sourcePath,
    values,
  };
}

function createCommonProfileValues({
  deploymentProfile,
  environment,
  runtimeTarget,
  topologyValues,
}) {
  const profileId = createBirdcoderProfileId(deploymentProfile, environment);
  const applicationUrl = topologyValues.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL;
  const platformUrl = topologyValues.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL;
  return {
    SDKWORK_ENVIRONMENT: environment,
    SDKWORK_DEPLOYMENT_PROFILE: deploymentProfile,
    SDKWORK_RUNTIME_TARGET: runtimeTarget,
    SDKWORK_BIRDCODER_ENVIRONMENT: environment,
    SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: deploymentProfile,
    SDKWORK_BIRDCODER_PROFILE_ID: profileId,
    SDKWORK_BIRDCODER_RUNTIME_TARGET: runtimeTarget,
    SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: applicationUrl,
    ...(platformUrl
      ? { SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL: platformUrl }
      : {}),
  };
}

export function createBirdcoderViteProfileValues({
  deploymentProfile,
  environment,
  runtimeTarget = 'browser',
  devBind,
  topologyValues,
}) {
  const commonValues = createCommonProfileValues({
    deploymentProfile,
    environment,
    runtimeTarget,
    topologyValues,
  });
  const applicationUrl = commonValues.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL;
  const platformUrl = commonValues.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL;
  return {
    ...commonValues,
    ...(devBind ? { SDKWORK_BIRDCODER_PC_DEV_BIND: devBind } : {}),
    VITE_SDKWORK_ENVIRONMENT: environment,
    VITE_SDKWORK_DEPLOYMENT_PROFILE: deploymentProfile,
    VITE_SDKWORK_RUNTIME_TARGET: runtimeTarget,
    VITE_SDKWORK_BIRDCODER_ENVIRONMENT: environment,
    VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: deploymentProfile,
    VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET: runtimeTarget,
    VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: applicationUrl,
    ...(platformUrl
      ? { VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL: platformUrl }
      : {}),
    SDKWORK_ACCESS_TOKEN: '',
  };
}

export function createBirdcoderFlutterProfileValues({
  deploymentProfile,
  environment,
  runtimeTarget = 'flutter-android',
  topologyValues,
}) {
  const commonValues = createCommonProfileValues({
    deploymentProfile,
    environment,
    runtimeTarget,
    topologyValues,
  });
  return {
    FLUTTER_ENV: environment,
    ...commonValues,
    API_BASE_URL: commonValues.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL,
    SDKWORK_ACCESS_TOKEN: '',
  };
}

function serializeDotenv({ profileId, sourcePath, workspaceRootDir, values }) {
  const relativeSourcePath = path.relative(workspaceRootDir, sourcePath).replaceAll('\\', '/');
  const lines = [
    `# Generated from ${relativeSourcePath} (${profileId}).`,
    '# Regenerate with: pnpm config:materialize',
  ];
  for (const [key, value] of Object.entries(values)) {
    lines.push(`${key}=${value}`);
  }
  return `${lines.join('\n')}\n`;
}

function serializeJson({ profileId, sourcePath, workspaceRootDir, values }) {
  const relativeSourcePath = path.relative(workspaceRootDir, sourcePath).replaceAll('\\', '/');
  return `${JSON.stringify({
    _generated: {
      command: 'pnpm config:materialize',
      profileId,
      source: relativeSourcePath,
    },
    ...values,
  }, null, 2)}\n`;
}

export function resolveBirdcoderSurfaceProfilePath({
  workspaceRootDir = defaultWorkspaceRootDir,
  surface,
  deploymentProfile,
  environment,
} = {}) {
  const definition = surfaceDefinitions[surface];
  if (!definition) {
    throw new Error(`Unsupported BirdCoder client surface: ${surface}`);
  }
  const profileId = createBirdcoderProfileId(deploymentProfile, environment);
  const appRootDir = path.join(workspaceRootDir, definition.appRoot);
  if (definition.format === 'dotenv') {
    return path.join(appRootDir, `.env.${profileId}`);
  }
  return path.join(appRootDir, 'env', `sdkwork.${profileId}.json`);
}

export function materializeBirdcoderClientEnv({
  workspaceRootDir = defaultWorkspaceRootDir,
  surfaces = Object.keys(surfaceDefinitions),
  check = false,
} = {}) {
  const results = [];
  for (const surface of surfaces) {
    const definition = surfaceDefinitions[surface];
    if (!definition) {
      throw new Error(`Unsupported BirdCoder client surface: ${surface}`);
    }
    for (const deploymentProfile of BIRDCODER_DEPLOYMENT_PROFILES) {
      for (const environment of BIRDCODER_ENVIRONMENTS) {
        const topologyProfile = loadBirdcoderTopologyProfile({
          workspaceRootDir,
          deploymentProfile,
          environment,
        });
        const outputPath = resolveBirdcoderSurfaceProfilePath({
          workspaceRootDir,
          surface,
          deploymentProfile,
          environment,
        });
        const values = definition.format === 'dotenv'
          ? createBirdcoderViteProfileValues({
              deploymentProfile,
              environment,
              runtimeTarget: definition.runtimeTarget,
              devBind: definition.devBind,
              topologyValues: topologyProfile.values,
            })
          : createBirdcoderFlutterProfileValues({
              deploymentProfile,
              environment,
              runtimeTarget: definition.runtimeTarget,
              topologyValues: topologyProfile.values,
            });
        const content = definition.format === 'dotenv'
          ? serializeDotenv({
              profileId: topologyProfile.profileId,
              sourcePath: topologyProfile.sourcePath,
              workspaceRootDir,
              values,
            })
          : serializeJson({
              profileId: topologyProfile.profileId,
              sourcePath: topologyProfile.sourcePath,
              workspaceRootDir,
              values,
            });

        if (check) {
          const actual = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
          if (actual !== content) {
            throw new Error(
              `${path.relative(workspaceRootDir, outputPath)} is missing or stale. Run pnpm config:materialize.`,
            );
          }
        } else {
          mkdirSync(path.dirname(outputPath), { recursive: true });
          writeFileSync(outputPath, content, 'utf8');
        }
        results.push(outputPath);
      }
    }
  }
  return results;
}

export function loadBirdcoderViteProfileFile({
  workspaceRootDir = defaultWorkspaceRootDir,
  appRootDir,
  deploymentProfile,
  environment,
  runtimeTarget,
} = {}) {
  const normalizedAppRoot = path.resolve(appRootDir);
  const pcRoot = path.join(workspaceRootDir, surfaceDefinitions.pc.appRoot);
  const h5Root = path.join(workspaceRootDir, surfaceDefinitions.h5.appRoot);
  const surface = normalizedAppRoot === pcRoot
    ? 'pc'
    : normalizedAppRoot === h5Root
      ? 'h5'
      : null;
  if (!surface) {
    return {};
  }
  const profilePath = resolveBirdcoderSurfaceProfilePath({
    workspaceRootDir,
    surface,
    deploymentProfile,
    environment,
  });
  if (!existsSync(profilePath)) {
    throw new Error(
      `BirdCoder client profile is missing: ${path.relative(workspaceRootDir, profilePath)}. Run pnpm config:materialize.`,
    );
  }
  const values = parseBirdcoderDotenv(readFileSync(profilePath, 'utf8'));
  if (runtimeTarget) {
    values.SDKWORK_RUNTIME_TARGET = runtimeTarget;
    values.SDKWORK_BIRDCODER_RUNTIME_TARGET = runtimeTarget;
    values.VITE_SDKWORK_RUNTIME_TARGET = runtimeTarget;
    values.VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET = runtimeTarget;
  }
  return values;
}

export function resolveBirdcoderAppRootFromPath({
  workspaceRootDir = defaultWorkspaceRootDir,
  startDir,
} = {}) {
  let currentDir = path.resolve(startDir);
  const workspaceRoot = path.resolve(workspaceRootDir);
  while (currentDir === workspaceRoot || currentDir.startsWith(`${workspaceRoot}${path.sep}`)) {
    if (
      currentDir === path.join(workspaceRoot, surfaceDefinitions.pc.appRoot)
      || currentDir === path.join(workspaceRoot, surfaceDefinitions.h5.appRoot)
    ) {
      return currentDir;
    }
    if (currentDir === workspaceRoot) {
      break;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

function parseCliArgs(argv) {
  const surfaces = [];
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--check') {
      check = true;
      continue;
    }
    if (token === '--surface') {
      const surface = String(argv[index + 1] ?? '').trim();
      if (!surface) {
        throw new Error('Missing value for --surface.');
      }
      surfaces.push(surface);
      index += 1;
      continue;
    }
    throw new Error(`Unsupported BirdCoder client env option: ${token}`);
  }
  return {
    check,
    surfaces: surfaces.length > 0 ? surfaces : Object.keys(surfaceDefinitions),
  };
}

function runCli() {
  const options = parseCliArgs(process.argv.slice(2));
  const results = materializeBirdcoderClientEnv({
    check: options.check,
    surfaces: options.surfaces,
  });
  const action = options.check ? 'verified' : 'materialized';
  console.log(`BirdCoder client env profiles ${action}: ${results.length} files.`);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
