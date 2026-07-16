#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GENERATOR_PACKAGE_NAME = '@sdkwork/sdk-generator';
const GENERATOR_CLI_NAME = 'sdkgen';
const STANDARD_PROFILE = 'sdkwork-v3';
const FLUTTER_MOBILE_ROOT = 'apps/sdkwork-birdcoder-flutter-mobile';
const PC_SDK_ROOT = 'apps/sdkwork-birdcoder-pc/sdks';
const DEFAULT_WORKSPACE_GENERATOR_ENTRYPOINT = '../sdkwork-sdk-generator/bin/sdkgen.js';
const CANONICAL_GENERATOR_ENTRYPOINT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '.sdkwork',
  'dependencies',
  'sdkwork-sdk-generator',
  'bin',
  'sdkgen.js',
);
const SUPPORTED_LANGUAGES = new Set(['flutter', 'dart']);

const SURFACE_PLAN = {
  app: {
    apiPrefix: '/app/v3/api',
    pcFamily: 'sdkwork-birdcoder-app-sdk',
    pcApiAuthority: 'sdkwork-birdcoder-app-api',
    consumerPackage: 'sdkwork_birdcoder_flutter_mobile_app_sdk_consumer',
    dartPackageName: 'sdkwork_birdcoder_app_sdk',
    surface: 'app',
    sdkgenType: 'app',
  },
  'backend-admin': {
    apiPrefix: '/backend/v3/api',
    pcFamily: 'sdkwork-birdcoder-backend-sdk',
    pcApiAuthority: 'sdkwork-birdcoder-backend-api',
    consumerPackage: 'sdkwork_birdcoder_flutter_mobile_backend_sdk_consumer',
    dartPackageName: 'sdkwork_birdcoder_backend_sdk',
    surface: 'backend-admin',
    sdkgenType: 'backend',
  },
};

function normalizeRelativePath(value) {
  return String(value ?? '').replace(/\\/gu, '/');
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  if (!next || String(next).startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return String(next);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    language: 'flutter',
    surface: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (token === '--surface') {
      options.surface = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--language') {
      options.language = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}.`);
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveSdkgenEntrypoint(rootDir) {
  const explicit = String(process.env.SDKWORK_SDKGEN_PATH ?? '').trim();
  if (explicit) {
    return path.resolve(rootDir, explicit);
  }

  const workspaceEntrypoint = path.resolve(rootDir, DEFAULT_WORKSPACE_GENERATOR_ENTRYPOINT);
  if (fs.existsSync(workspaceEntrypoint)) {
    return workspaceEntrypoint;
  }

  return CANONICAL_GENERATOR_ENTRYPOINT;
}

function assertSdkgenEntrypoint(sdkgenEntrypoint) {
  if (!fs.existsSync(sdkgenEntrypoint)) {
    throw new Error(
      `Missing ${GENERATOR_PACKAGE_NAME} ${GENERATOR_CLI_NAME} entrypoint: ${sdkgenEntrypoint}. ` +
        'Install or check out the canonical SDK generator before running Flutter mobile SDK generation.',
    );
  }

  const packageRoot = path.resolve(path.dirname(sdkgenEntrypoint), '..');
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const packageJson = fs.existsSync(packageJsonPath) ? readJson(packageJsonPath) : null;
  if (packageJson?.name !== GENERATOR_PACKAGE_NAME) {
    throw new Error(
      `The resolved ${GENERATOR_CLI_NAME} entrypoint is not ${GENERATOR_PACKAGE_NAME}: ${sdkgenEntrypoint}.`,
    );
  }
}

function createGenerationPlans(rootDir, options) {
  if (!SUPPORTED_LANGUAGES.has(options.language)) {
    throw new Error(`Unsupported Flutter mobile SDK language: ${options.language}.`);
  }

  return Object.values(SURFACE_PLAN)
    .filter((plan) => !options.surface || plan.surface === options.surface)
    .map((plan) => {
      const familyManifest = readJson(path.join(rootDir, PC_SDK_ROOT, plan.pcFamily, 'sdk-manifest.json'));
      assert.equal(familyManifest.sdkOwner, 'sdkwork-birdcoder');
      assert.equal(familyManifest.standardProfile, STANDARD_PROFILE);
      assert.equal(familyManifest.apiAuthority, plan.pcApiAuthority);

      const input = path.join(
        rootDir,
        PC_SDK_ROOT,
        plan.pcFamily,
        ...familyManifest.generationInputSpec.split('/'),
      );
      const output = path.join(
        rootDir,
        FLUTTER_MOBILE_ROOT,
        'sdks',
        plan.consumerPackage,
        'generated',
        'server-openapi',
      );

      return {
        apiPrefix: plan.apiPrefix,
        fixedSdkVersion: String(familyManifest.apiVersion ?? '0.1.0'),
        input,
        language: options.language,
        output,
        packageName: plan.dartPackageName,
        sdkName: plan.pcFamily,
        surface: plan.surface,
        sdkgenType: plan.sdkgenType,
      };
    });
}

function renderCommand(sdkgenEntrypoint, plan, options) {
  return [
    sdkgenEntrypoint,
    'generate',
    '--input',
    plan.input,
    '--output',
    plan.output,
    '--name',
    plan.sdkName,
    '--type',
    plan.sdkgenType,
    '--language',
    plan.language,
    '--api-prefix',
    plan.apiPrefix,
    '--sdk-name',
    plan.sdkName,
    '--package-name',
    plan.packageName,
    '--fixed-sdk-version',
    plan.fixedSdkVersion,
    '--standard-profile',
    STANDARD_PROFILE,
    ...(options.dryRun ? ['--dry-run'] : []),
  ];
}

function runPlan(sdkgenEntrypoint, plan, options) {
  const args = renderCommand(sdkgenEntrypoint, plan, options);
  console.log(`${GENERATOR_CLI_NAME} ${args.slice(1).join(' ')}`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${GENERATOR_CLI_NAME} failed for ${ plan.sdkName} ${ plan.language} with exit code ${result.status}.`,
    );
  }
}

export function generateBirdcoderFlutterMobileSdkFamily(options = {}, rootDir = process.cwd()) {
  const sdkgenEntrypoint = resolveSdkgenEntrypoint(rootDir);
  assertSdkgenEntrypoint(sdkgenEntrypoint);
  const plans = createGenerationPlans(rootDir, options);
  if (plans.length === 0) {
    throw new Error(`No Flutter mobile SDK surfaces matched${options.surface ? `: ${options.surface}` : '.'}`);
  }

  for (const plan of plans) {
    assert.ok(fs.existsSync(plan.input), `Missing canonical OpenAPI sdkgen input: ${normalizeRelativePath(path.relative(rootDir, plan.input))}.`);
    runPlan(sdkgenEntrypoint, plan, options);
  }

  return plans.map(( plan) => ({
    language: plan.language,
    output: normalizeRelativePath(path.relative(rootDir, plan.output)),
    sdkName: plan.sdkName,
    surface: plan.surface,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = generateBirdcoderFlutterMobileSdkFamily(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
