import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
);
const runnerSource = fs.readFileSync(
  path.join(rootDir, "scripts/run-flutter-mobile-command.mjs"),
  "utf8",
);

const requiredScripts = [
  "install:flutter-android",
  "check:flutter-android",
  "test:flutter-android",
  "build:flutter-android",
  "build:flutter-android:full",
  "build:flutter-ios",
  "build:flutter-ios:full",
];

for (const scriptName of requiredScripts) {
  assert.ok(
    packageJson.scripts[scriptName],
    `Root package.json must expose ${scriptName}.`,
  );
  assert.match(
    packageJson.scripts[scriptName],
    /run-flutter-mobile-command\.mjs/u,
    `${scriptName} must route through the flutter mobile command runner.`,
  );
}

for (const [scriptName, runtimeTarget] of [
  ["dev:flutter-android", "flutter-android"],
  ["dev:flutter-ios", "flutter-ios"],
]) {
  const script = packageJson.scripts[scriptName];
  assert.ok(script, `Root package.json must expose ${scriptName}.`);
  assert.match(script, /sdkwork-app dev/u);
  assert.match(script, new RegExp(`--runtime-target ${runtimeTarget}`, "u"));
  assert.match(script, /--client-architecture flutter/u);
}

assert.match(
  runnerSource,
  /mergeRepoDevBootstrapAccessTokenEnv/u,
  "Flutter development runner must use the canonical IAM bootstrap token helper.",
);
assert.match(
  runnerSource,
  /apps\/sdkwork-birdcoder-flutter-mobile\/sdkwork\.app\.config\.json/u,
  "Flutter development runner must select the Flutter surface manifest explicitly.",
);

assert.match(
  runnerSource,
  /apps\/sdkwork-birdcoder-flutter-mobile/u,
  "Flutter mobile command runner must target the BirdCoder Flutter app root.",
);
assert.match(
  runnerSource,
  /const isReleaseBuild = command\.startsWith\(["']build:["']\)/u,
  "Flutter mobile command runner must classify every build variant as a release artifact.",
);
assert.match(
  runnerSource,
  /isReleaseBuild[\s\S]*--dart-define=FLUTTER_ENV=production/u,
  "Flutter release builds must compile with production credential-entry policy.",
);
assert.match(
  runnerSource,
  /\[\.\.\.configuredFlutterArgs, \.\.\.args, \.\.\.runtimeDefines\]/u,
  "Flutter runner-owned environment defines must follow caller arguments so they cannot be overridden.",
);

console.log("flutter mobile command runner contract passed.");
