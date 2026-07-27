#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { mergeRepoDevBootstrapAccessTokenEnv } from "@sdkwork/iam-credential-entry/node-bootstrap";
import {
  normalizeBirdcoderDeploymentProfile,
  normalizeBirdcoderEnvironment,
  resolveBirdcoderSurfaceProfilePath,
} from "./birdcoder-client-env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const flutterMobileRoot = path.join(
  rootDir,
  "apps/sdkwork-birdcoder-flutter-mobile",
);
const flutterMobileManifestPath =
  "apps/sdkwork-birdcoder-flutter-mobile/sdkwork.app.config.json";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error(
    "Usage: node scripts/run-flutter-mobile-command.mjs <command> [args...]",
  );
  process.exit(1);
}

const commandMap = {
  "pub-get": ["pub", "get"],
  analyze: ["analyze", "lib", "test", "packages"],
  test: ["test"],
  "run:android": ["run", "-d", "android"],
  "run:ios": ["run", "-d", "ios"],
  "build:android": ["build", "apk", "--release"],
  "build:android:prod": ["build", "appbundle", "--release"],
  "build:ios": ["build", "ios", "--release", "--no-codesign"],
  "build:ios:prod": ["build", "ipa", "--release", "--no-codesign"],
};

const configuredFlutterArgs = commandMap[command];
if (!configuredFlutterArgs) {
  console.error(`Unsupported flutter mobile command: ${command}`);
  process.exit(1);
}

function readOptionValue(argv, index, flag) {
  const next = String(argv[index + 1] ?? "").trim();
  if (!next || next.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return next;
}

function stripRuntimeProfileArgs(argv) {
  const forwardedArgs = [];
  let deploymentProfile = "";
  let environment = "";
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--deployment-profile") {
      deploymentProfile = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--environment") {
      environment = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    forwardedArgs.push(token);
  }
  return { deploymentProfile, environment, forwardedArgs };
}

const runtimeOptions = stripRuntimeProfileArgs(args);
const isDevelopmentRuntime = command === "run:android" || command === "run:ios";
const isReleaseBuild = command.startsWith("build:");
const environment = normalizeBirdcoderEnvironment(
  runtimeOptions.environment
  || process.env.SDKWORK_ENVIRONMENT
  || (isDevelopmentRuntime ? "development" : isReleaseBuild ? "production" : "development"),
);
const deploymentProfile = normalizeBirdcoderDeploymentProfile(
  runtimeOptions.deploymentProfile
  || process.env.SDKWORK_DEPLOYMENT_PROFILE
  || "standalone",
);
const runtimeTarget = command === "run:ios" || command.startsWith("build:ios")
  ? "flutter-ios"
  : "flutter-android";
const childEnv = isDevelopmentRuntime
  ? mergeRepoDevBootstrapAccessTokenEnv({
      env: { ...process.env },
      manifestPath: flutterMobileManifestPath,
      repoRoot: rootDir,
      runtimeTarget,
    })
  : process.env;
const profilePath = resolveBirdcoderSurfaceProfilePath({
  workspaceRootDir: rootDir,
  surface: "flutter",
  deploymentProfile,
  environment,
});
const runtimeDefines = isDevelopmentRuntime || isReleaseBuild
  ? [
      `--dart-define-from-file=${profilePath}`,
      `--dart-define=FLUTTER_ENV=${environment}`,
      `--dart-define=SDKWORK_DEPLOYMENT_PROFILE=${deploymentProfile}`,
      `--dart-define=SDKWORK_RUNTIME_TARGET=${runtimeTarget}`,
      ...(isDevelopmentRuntime
        ? [`--dart-define=SDKWORK_ACCESS_TOKEN=${childEnv.SDKWORK_ACCESS_TOKEN}`]
        : []),
    ]
  : [];

const result = spawnSync(
  "flutter",
  [...configuredFlutterArgs, ...runtimeOptions.forwardedArgs, ...runtimeDefines],
  {
    cwd: flutterMobileRoot,
    env: childEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
