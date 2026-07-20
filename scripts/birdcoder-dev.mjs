#!/usr/bin/env node

import process from 'node:process';

import {
  DEFAULT_DEV_PROFILE_ID,
  IAM_APPLICATION_BOOTSTRAP_ENV,
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
    clientArchitecture: null,
    deploymentProfile: 'standalone',
    runtimeTarget: 'browser',
    serviceLayout: 'split-services',
    target: null,
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
    if (arg === '--deployment-profile') {
      settings.deploymentProfile = argv[index + 1] ?? settings.deploymentProfile;
      index += 1;
      continue;
    }
    if (arg === '--runtime-target') {
      settings.runtimeTarget = argv[index + 1] ?? settings.runtimeTarget;
      index += 1;
      continue;
    }
    if (arg === '--client-architecture') {
      settings.clientArchitecture = argv[index + 1] ?? settings.clientArchitecture;
      index += 1;
      continue;
    }
    if (arg === '--environment') {
      index += 1;
      continue;
    }
    if (arg === '--hosting') {
      throw new Error(
        '--hosting is retired; use --deployment-profile (standalone or cloud)',
      );
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
    if (arg === 'web' || arg === 'desktop' || arg === 'h5') {
      settings.target = arg;
    }
  }

  settings.target ??= settings.runtimeTarget === 'desktop'
    ? 'desktop'
    : settings.clientArchitecture === 'h5'
      ? 'h5'
      : 'web';

  return settings;
}

function printHelp() {
  console.log(`Usage: node scripts/birdcoder-dev.mjs [web|desktop|h5] [options] [-- <client args>]

Topology-aware BirdCoder dev entry. Loads etc/topology profile env via @sdkwork/app-topology.

Options:
  --deployment-profile <standalone|cloud>             Default: standalone
  --service-layout <split-services|unified-process> Default: split-services
  --target <web|desktop|h5>                         Derived from runtime target and client architecture
  --dry-run                                         Print plan without executing
  --help, -h

Examples:
  pnpm dev:browser:postgres:standalone
  pnpm dev:browser:cloud
  pnpm dev:desktop:postgres:standalone
`);
}

async function main() {
  const settings = parseArgs(process.argv.slice(2));
  if (settings.help) {
    printHelp();
    return;
  }

  const profileId = resolveDevProfileId(settings.deploymentProfile, settings.serviceLayout);
  const profileEnv = loadProfile(profileId);
  const mergedEnv = mergeRuntimeEnv(
    process.env,
    profileEnv,
    bridgeLegacyApiEnv(profileEnv),
    resolveIamDevEnv(process.env),
    {
      SDKWORK_BIRDCODER_PROFILE_ID: profileId,
      SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: settings.deploymentProfile,
      ...IAM_APPLICATION_BOOTSTRAP_ENV,
    },
  );
  const iamMode = resolveIamModeFromTopology(settings.deploymentProfile, settings.serviceLayout);

  const summary = {
    repoRoot: REPO_ROOT,
    profileId,
    defaultDevProfileId: DEFAULT_DEV_PROFILE_ID,
    iamMode,
    target: settings.target,
    applicationPublicHttpUrl: resolveSurfaceHttpUrl(mergedEnv, 'application.public-ingress'),
    platformApiGatewayHttpUrl: resolveGatewayBaseUrl(mergedEnv, settings.deploymentProfile),
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
