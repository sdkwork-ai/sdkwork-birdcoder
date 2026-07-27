import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import * as esbuild from 'esbuild';

import {
  MINI_PROGRAM_ROOT,
  WORKSPACE_ROOT,
  parseBuildArgs,
  runtimeConfigPath,
} from './lib/build-context.mjs';
import { projectBirdCoderMiniProgramRoutes } from './project-routes.mjs';

const DIST_DIR = path.join(MINI_PROGRAM_ROOT, 'dist');
const SOURCE_DIR = path.join(MINI_PROGRAM_ROOT, 'src');
const RUNTIME_DIR = path.join(DIST_DIR, 'runtime');
const NATIVE_SOURCE_EXTENSIONS = new Set(['.js', '.json', '.wxml', '.wxss', '.wxs']);
const CRITICAL_SOURCE_FILES = [
  'src/app.ts',
  'src/app.json',
  'src/app.wxss',
  'src/sitemap.json',
  'src/bootstrap/runtimeBundle.ts',
  'packages/sdkwork-birdcoder-mp-workbench/src/routes/workbench.route.json',
];

function assertCriticalSource() {
  const missing = CRITICAL_SOURCE_FILES.filter(
    (relative) => !fs.existsSync(path.join(MINI_PROGRAM_ROOT, relative)),
  );
  if (missing.length > 0) {
    throw new Error(`Missing build-critical source files: ${missing.join(', ')}`);
  }
}

function copyNativeSource(directory, targetRoot) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    const relative = path.relative(SOURCE_DIR, source);
    const target = path.join(targetRoot, relative);
    if (entry.isDirectory()) {
      fs.mkdirSync(target, { recursive: true });
      copyNativeSource(source, targetRoot);
      continue;
    }
    if (!entry.isFile() || !NATIVE_SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

async function createBuild(options) {
  assertCriticalSource();
  projectBirdCoderMiniProgramRoutes();
  const configPath = runtimeConfigPath(options.deploymentProfile, options.environment);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `${path.relative(WORKSPACE_ROOT, configPath)} is missing. Run node scripts/birdcoder-client-env.mjs --surface miniProgram from the repository root.`,
    );
  }
  const runtimeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  copyNativeSource(SOURCE_DIR, DIST_DIR);
  fs.writeFileSync(
    path.join(RUNTIME_DIR, 'runtime-config.js'),
    `module.exports = Object.freeze(${JSON.stringify(runtimeConfig, null, 2)});\n`,
    'utf8',
  );
  await esbuild.build({
    entryPoints: [path.join(SOURCE_DIR, 'bootstrap', 'runtimeBundle.ts')],
    outfile: path.join(RUNTIME_DIR, 'birdcoder-app.js'),
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    target: 'es2020',
    minify: options.environment === 'production',
    legalComments: 'none',
    logLevel: 'silent',
  });
  await esbuild.build({
    entryPoints: [path.join(SOURCE_DIR, 'app.ts')],
    outfile: path.join(DIST_DIR, 'app.js'),
    bundle: false,
    platform: 'browser',
    format: 'cjs',
    target: 'es2020',
    minify: options.environment === 'production',
    legalComments: 'none',
    logLevel: 'silent',
  });
  const manifest = {
    schemaVersion: 1,
    kind: 'sdkwork.mini-program-build',
    platform: 'MP_WEIXIN',
    framework: 'weixin-mini-program',
    deploymentProfile: options.deploymentProfile,
    environment: options.environment,
    profileId: `${options.deploymentProfile}.${options.environment}`,
    runtimeTarget: 'mini-program',
    miniprogramRoot: 'dist/',
  };
  fs.writeFileSync(
    path.join(DIST_DIR, 'build-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `BirdCoder WeChat Mini Program built: ${options.deploymentProfile}.${options.environment} -> ${path.relative(WORKSPACE_ROOT, DIST_DIR)}`,
  );
}

const options = parseBuildArgs(process.argv.slice(2));
await createBuild(options);
if (options.watch) {
  const watchRoots = [
    path.join(MINI_PROGRAM_ROOT, 'src'),
    path.join(MINI_PROGRAM_ROOT, 'packages'),
    path.join(MINI_PROGRAM_ROOT, 'config', 'mini-program'),
  ];
  let timer;
  for (const watchRoot of watchRoots) {
    fs.watch(watchRoot, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        createBuild(options).catch((error) => {
          console.error(error instanceof Error ? error.message : String(error));
        });
      }, 120);
    });
  }
  console.log('Watching native mini program source and runtime config. Press Ctrl+C to stop.');
}
