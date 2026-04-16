import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');
const allowedAdapterDirs = new Set([
  'sdkwork-birdcoder-chat-claude',
  'sdkwork-birdcoder-chat-codex',
  'sdkwork-birdcoder-chat-gemini',
  'sdkwork-birdcoder-chat-opencode',
]);
const officialSdkPackages = [
  '@anthropic-ai/claude-agent-sdk',
  '@google/gemini-cli-sdk',
  '@openai/codex-sdk',
  '@opencode-ai/sdk',
];
const dependencySections = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
const codeExtensions = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);
const ignoredDirNames = new Set([
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'build',
  'node_modules',
  'target',
]);
const errors = [];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function scanCodeFile(absolutePath, packageName) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  for (const sdkPackageName of officialSdkPackages) {
    const importPattern = new RegExp(
      `(?:from\\s*['"]${escapeRegExp(sdkPackageName)}['"]|import\\(\\s*['"]${escapeRegExp(sdkPackageName)}['"]\\s*\\)|require\\(\\s*['"]${escapeRegExp(sdkPackageName)}['"]\\s*\\))`,
      'u',
    );
    if (importPattern.test(source)) {
      errors.push(
        `${packageName} must not import official provider SDK ${sdkPackageName} in ${path.relative(rootDir, absolutePath)}`,
      );
    }
  }
}

function scanPackageSources(packageDir, packageName) {
  const queue = [packageDir];
  while (queue.length > 0) {
    const currentDir = queue.pop();
    if (!currentDir) {
      continue;
    }

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.storybook') {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirNames.has(entry.name)) {
          continue;
        }
        queue.push(absolutePath);
        continue;
      }

      if (!codeExtensions.has(path.extname(entry.name))) {
        continue;
      }

      scanCodeFile(absolutePath, packageName);
    }
  }
}

assert.ok(fs.existsSync(packagesDir), 'packages directory must exist');

for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('sdkwork-birdcoder-')) {
    continue;
  }

  if (allowedAdapterDirs.has(entry.name)) {
    continue;
  }

  const packageDir = path.join(packagesDir, entry.name);
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    continue;
  }

  const packageJson = readJson(packageJsonPath);
  const packageName = String(packageJson.name ?? entry.name);

  for (const section of dependencySections) {
    const dependencies = packageJson[section];
    if (!dependencies || typeof dependencies !== 'object') {
      continue;
    }

    for (const sdkPackageName of officialSdkPackages) {
      if (sdkPackageName in dependencies) {
        errors.push(
          `${packageName} must not declare official provider SDK dependency ${sdkPackageName} in ${path.relative(rootDir, packageJsonPath)}`,
        );
      }
    }
  }

  scanPackageSources(packageDir, packageName);
}

assert.deepEqual(
  errors,
  [],
  `Product-layer workspace packages must not import or depend on provider official SDKs directly:\n${errors.map((error) => `- ${error}`).join('\n')}`,
);

console.log('provider SDK import governance contract passed.');
