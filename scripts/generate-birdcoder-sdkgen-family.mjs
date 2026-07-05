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
const SUPPORTED_LANGUAGES = new Set(['typescript', 'rust']);

function resolveTransportPackageName(sdkFamilyStem) {
  return `${sdkFamilyStem}-generated-typescript`;
}

function resolveConsumerPackageName(sdkFamilyStem) {
  const token = sdkFamilyStem.startsWith('sdkwork-')
    ? sdkFamilyStem.slice('sdkwork-'.length)
    : sdkFamilyStem;
  return `@sdkwork/${token}`;
}

function resolveSurfacePackageNames(surface) {
  const sdkFamilyStem = String(surface.sdkFamily ?? '').trim();
  return {
    consumerPackageName: String(surface.consumerPackageName ?? surface.packageName ?? '').trim()
      || resolveConsumerPackageName(sdkFamilyStem),
    transportPackageName: String(surface.transportPackageName ?? '').trim()
      || resolveTransportPackageName(sdkFamilyStem),
  };
}

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
    languages: [],
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
      options.languages.push(readOptionValue(argv, index, token));
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
        'Install or check out the canonical SDK generator before running standard SDK generation.',
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

  const commanderPath = path.join(packageRoot, 'node_modules', 'commander');
  if (!fs.existsSync(commanderPath)) {
    throw new Error(
      `${GENERATOR_PACKAGE_NAME} dependencies are not installed at ${packageRoot}. ` +
        'Run the generator repository install before running standard SDK generation.',
    );
  }
}

function resolveFamilyRoot(surface) {
  const declaredRoot = normalizeRelativePath(surface.rootDir ?? '');
  if (declaredRoot) {
    return declaredRoot;
  }
  assert.ok(surface.sdkFamily, `Surface ${surface.id ?? surface.surface} must declare sdkFamily.`);
  return `sdks/${surface.sdkFamily}`;
}

function resolveLanguageOutput(familyRoot, sdkFamily, language) {
  return `${familyRoot}/${sdkFamily}-${language}/generated/server-openapi`;
}

function createGenerationPlans(rootDir, options) {
  const assembly = readJson(path.join(rootDir, 'sdks', '.sdkwork-assembly.json'));
  assert.equal(assembly.standardProfile, STANDARD_PROFILE);

  const requestedLanguages = new Set(options.languages.length > 0 ? options.languages : SUPPORTED_LANGUAGES);
  for (const language of requestedLanguages) {
    if (!SUPPORTED_LANGUAGES.has(language)) {
      throw new Error(`Unsupported BirdCoder standard SDK language: ${language}.`);
    }
  }

  return (assembly.surfaces ?? [])
    .filter((surface) => !options.surface || surface.surface === options.surface)
    .flatMap((surface) => {
      const familyRoot = resolveFamilyRoot(surface);
      const familyAssemblyPath = path.join(rootDir, ...familyRoot.split('/'), '.sdkwork-assembly.json');
      const familyAssembly = readJson(familyAssemblyPath);
      assert.equal(familyAssembly.sdkOwner, 'sdkwork-birdcoder');
      assert.equal(familyAssembly.workspace, surface.sdkFamily);
      assert.equal(familyAssembly.apiAuthority, surface.apiAuthority);
      assert.equal(familyAssembly.generationInputSpec, `openapi/${surface.apiAuthority}.sdkgen.json`);

      const languages = new Map((familyAssembly.languages ?? []).map((entry) => [entry.language, entry]));
      return [...requestedLanguages].map((language) => {
        const languageEntry = languages.get(language);
        assert.ok(languageEntry, `${surface.sdkFamily} must declare ${language} in .sdkwork-assembly.json.`);
        const names = resolveSurfacePackageNames(surface);
        return {
          apiPrefix: surface.apiPrefix,
          fixedSdkVersion: String(languageEntry.version ?? familyAssembly.apiVersion ?? surface.version ?? '0.1.0'),
          input: path.join(rootDir, ...familyRoot.split('/'), familyAssembly.generationInputSpec),
          language,
          output: path.join(rootDir, ...resolveLanguageOutput(familyRoot, surface.sdkFamily, language).split('/')),
          packageName: names.consumerPackageName,
          consumerPackageName: names.consumerPackageName,
          transportPackageName: names.transportPackageName,
          sdkName: surface.sdkFamily,
          surface: surface.surface,
        };
      });
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
    plan.surface,
    '--language',
    plan.language,
    '--api-prefix',
    plan.apiPrefix,
    '--sdk-name',
    plan.sdkName,
    '--package-name',
    plan.consumerPackageName ?? plan.packageName,
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
    throw new Error(`${GENERATOR_CLI_NAME} failed for ${plan.sdkName} ${plan.language} with exit code ${result.status}.`);
  }
}

export function generateBirdcoderSdkgenFamily(options = {}, rootDir = process.cwd()) {
  const sdkgenEntrypoint = resolveSdkgenEntrypoint(rootDir);
  assertSdkgenEntrypoint(sdkgenEntrypoint);
  const plans = createGenerationPlans(rootDir, options);
  if (plans.length === 0) {
    throw new Error(`No BirdCoder SDK surfaces matched${options.surface ? `: ${options.surface}` : '.'}`);
  }
  for (const plan of plans) {
    runPlan(sdkgenEntrypoint, plan, options);
  }
  return plans.map((plan) => ({
    language: plan.language,
    output: normalizeRelativePath(path.relative(rootDir, plan.output)),
    sdkName: plan.sdkName,
    surface: plan.surface,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = generateBirdcoderSdkgenFamily(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
