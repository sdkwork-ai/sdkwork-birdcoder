#!/usr/bin/env node

import process from 'node:process';

import {
  DEFAULT_DEV_PROFILE_ID,
  listHealthSurfaces,
  loadProfile,
  mergeRuntimeEnv,
  REPO_ROOT,
  resolveDevProfileId,
  resolveGatewayBaseUrl,
  resolveIamDevEnv,
  resolveIamModeFromTopology,
  resolveSurfaceHttpUrl,
  bridgeLegacyApiEnv,
} from './lib/birdcoder-topology.mjs';
import { runBirdcoderDevStack } from './run-birdcoder-dev-stack.mjs';

function parseArgs(argv) {
  const settings = {
    hosting: 'self-hosted',
    serviceLayout: 'split-services',
    target: 'web',
    dryRun: false,
    help: false,
    passthrough: [],
    passthroughMode: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      settings.help = true;
      continue;
    }
    if (arg === '--hosting') {
      settings.hosting = argv[index + 1] ?? settings.hosting;
      index += 1;
      continue;
    }
    if (arg === '--service-layout') {
      settings.serviceLayout = argv[index + 1] ?? settings.serviceLayout;
      index += 1;
      continue;
    }
    if (arg === '--target') {
      settings.target = argv[index + 1] ?? settings.target;
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      settings.dryRun = true;
      continue;
    }
    if (arg === '--') {
      settings.passthroughMode = true;
      continue;
    }
    if (settings.passthroughMode) {
      settings.passthrough.push(arg);
      continue;
    }
    if (arg === 'web' || arg === 'desktop') {
      settings.target = arg;
    }
  }

  return settings;
}

function printHelp() {
  console.log(`Usage: node scripts/birdcoder-dev.mjs [web|desktop] [options] [-- <client args>]

Topology-aware BirdCoder dev entry. Loads configs/topology profile env via @sdkwork/app-topology.

Options:
  --hosting <self-hosted|cloud-hosted>              Default: self-hosted
  --service-layout <split-services|unified-process> Default: split-services
  --target <web|desktop>                            Default: web
  --dry-run                                         Print plan without executing
  --help, -h

Examples:
  pnpm birdcoder:dev
  pnpm birdcoder:dev:cloud
  pnpm birdcoder:dev:desktop
`);
}

async function main() {
  const settings = parseArgs(process.argv.slice(2));
  if (settings.help) {
    printHelp();
    return;
  }

  const profileId = resolveDevProfileId(settings.hosting, settings.serviceLayout);
  const profile = loadProfile(profileId);
  const mergedEnv = mergeRuntimeEnv(
    process.env,
    profile.env,
    bridgeLegacyApiEnv(profile.env),
    resolveIamDevEnv(process.env),
    {
      SDKWORK_BIRDCODER_PROFILE_ID: profileId,
    },
  );
  const iamMode = resolveIamModeFromTopology(settings.hosting, settings.serviceLayout);

  const summary = {
    repoRoot: REPO_ROOT,
    profileId,
    defaultDevProfileId: DEFAULT_DEV_PROFILE_ID,
    iamMode,
    target: settings.target,
    applicationPublicHttpUrl: resolveSurfaceHttpUrl(
      profileId,
      'application.public-ingress',
      mergedEnv,
    ),
    platformApiGatewayHttpUrl: resolveGatewayBaseUrl(mergedEnv, settings.hosting),
    healthSurfaces: listHealthSurfaces(profileId),
  };

  console.log('[sdkwork-birdcoder-dev] topology profile loaded');
  console.log(JSON.stringify(summary, null, 2));

  const stackArgv = [
    settings.target,
    '--iam-mode',
    iamMode,
    ...(settings.dryRun ? ['--dry-run'] : []),
    ...(settings.passthrough.length > 0 ? ['--', ...settings.passthrough] : []),
  ];

  const exitCode = await runBirdcoderDevStack({
    argv: stackArgv,
    env: mergedEnv,
  });
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
