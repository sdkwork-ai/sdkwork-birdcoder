#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { mergeRepoDevBootstrapAccessTokenEnv } from "@sdkwork/iam-credential-entry/node-bootstrap";

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

const isDevelopmentRuntime = command === "run:android" || command === "run:ios";
const isReleaseBuild = command.startsWith("build:");
const childEnv = isDevelopmentRuntime
  ? mergeRepoDevBootstrapAccessTokenEnv({
      env: { ...process.env },
      manifestPath: flutterMobileManifestPath,
      repoRoot: rootDir,
      runtimeTarget: command === "run:ios" ? "flutter-ios" : "flutter-android",
    })
  : process.env;
const runtimeDefines = isDevelopmentRuntime
  ? [
      "--dart-define=FLUTTER_ENV=development",
      `--dart-define=SDKWORK_ACCESS_TOKEN=${childEnv.SDKWORK_ACCESS_TOKEN}`,
    ]
  : isReleaseBuild
    ? ["--dart-define=FLUTTER_ENV=production"]
    : [];

const result = spawnSync(
  "flutter",
  [...configuredFlutterArgs, ...args, ...runtimeDefines],
  {
    cwd: flutterMobileRoot,
    env: childEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
