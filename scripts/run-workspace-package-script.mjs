#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function resolvePathKey(env = process.env, platform = process.platform) {
  return Object.keys(env).find((key) => key.toUpperCase() === 'PATH')
    ?? (platform === 'win32' ? 'Path' : 'PATH');
}

function resolvePathDelimiter(platform = process.platform) {
  return platform === 'win32' ? ';' : ':';
}

function normalizePathEntry(entry, platform = process.platform) {
  const pathModule = platform === 'win32' ? path.win32 : path.posix;
  const normalizedEntry = pathModule.normalize(String(entry ?? '').trim());

  return platform === 'win32'
    ? normalizedEntry.replace(/[\\/]+$/, '').toLowerCase()
    : normalizedEntry.replace(/\/+$/, '');
}

function splitPathEntries(pathValue, platform = process.platform) {
  return String(pathValue ?? '')
    .split(resolvePathDelimiter(platform))
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function uniquePathEntries(entries, platform = process.platform) {
  const dedupedEntries = [];
  const seen = new Set();

  for (const entry of entries) {
    const normalizedEntry = normalizePathEntry(entry, platform);
    if (!normalizedEntry || seen.has(normalizedEntry)) {
      continue;
    }

    seen.add(normalizedEntry);
    dedupedEntries.push(entry);
  }

  return dedupedEntries;
}

function ensureWorkspaceRelativePath(targetPath, workspaceRootDir = rootDir) {
  const absoluteTargetPath = path.resolve(workspaceRootDir, targetPath);
  const relativeTargetPath = path.relative(workspaceRootDir, absoluteTargetPath);
  if (
    !relativeTargetPath
    || relativeTargetPath.startsWith('..')
    || path.isAbsolute(relativeTargetPath)
  ) {
    throw new Error(`Package path must stay inside the workspace root: ${targetPath}`);
  }

  return absoluteTargetPath;
}

function readWorkspacePackageScript({
  packageDir,
  scriptName,
  workspaceRootDir = rootDir,
} = {}) {
  const absolutePackageDir = ensureWorkspaceRelativePath(packageDir, workspaceRootDir);
  const packageJsonPath = path.join(absolutePackageDir, 'package.json');

  if (!existsSync(packageJsonPath)) {
    throw new Error(`Unable to resolve workspace package.json at ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const script = String(packageJson.scripts?.[scriptName] ?? '').trim();
  if (!script) {
    throw new Error(`Package script ${scriptName} is not defined in ${packageJsonPath}`);
  }

  return {
    absolutePackageDir,
    packageJsonPath,
    packageJson,
    script,
  };
}

export function createWorkspacePackageScriptPlan({
  packageDir,
  scriptName,
  workspaceRootDir = rootDir,
  env = process.env,
  platform = process.platform,
  execPath = process.execPath,
} = {}) {
  const packageScript = readWorkspacePackageScript({
    packageDir,
    scriptName,
    workspaceRootDir,
  });
  const pathKey = resolvePathKey(env, platform);
  const nextEnv = {
    ...env,
  };
  const nodeBinDir = path.dirname(execPath);
  const pathEntries = splitPathEntries(nextEnv[pathKey] ?? nextEnv.PATH ?? nextEnv.Path ?? '', platform);
  if (!pathEntries.some((entry) => normalizePathEntry(entry, platform) === normalizePathEntry(nodeBinDir, platform))) {
    pathEntries.unshift(nodeBinDir);
  }
  for (const key of Object.keys(nextEnv)) {
    if (key !== pathKey && key.toUpperCase() === 'PATH') {
      delete nextEnv[key];
    }
  }
  nextEnv[pathKey] = uniquePathEntries(pathEntries, platform).join(resolvePathDelimiter(platform));
  nextEnv.NODE = execPath;
  nextEnv.npm_node_execpath = execPath;
  nextEnv.npm_lifecycle_event = scriptName;
  nextEnv.npm_lifecycle_script = packageScript.script;
  nextEnv.npm_package_json = packageScript.packageJsonPath;
  if (typeof packageScript.packageJson.name === 'string' && packageScript.packageJson.name.trim()) {
    nextEnv.npm_package_name = packageScript.packageJson.name.trim();
  }
  if (typeof packageScript.packageJson.version === 'string' && packageScript.packageJson.version.trim()) {
    nextEnv.npm_package_version = packageScript.packageJson.version.trim();
  }

  if (platform === 'win32') {
    return {
      command: String(env.ComSpec ?? env.COMSPEC ?? 'cmd.exe').trim() || 'cmd.exe',
      args: ['/d', '/s', '/c', packageScript.script],
      cwd: packageScript.absolutePackageDir,
      env: nextEnv,
      shell: false,
    };
  }

  return {
    command: String(env.SHELL ?? '/bin/sh').trim() || '/bin/sh',
    args: ['-lc', packageScript.script],
    cwd: packageScript.absolutePackageDir,
    env: nextEnv,
    shell: false,
  };
}

function parseArgs(argv = []) {
  if (!Array.isArray(argv) || argv.length !== 2) {
    throw new Error(
      'run-workspace-package-script requires exactly two arguments: <package-dir> <script-name>.',
    );
  }

  return {
    packageDir: String(argv[0] ?? '').trim(),
    scriptName: String(argv[1] ?? '').trim(),
  };
}

export function runWorkspacePackageScriptCli({
  argv = process.argv.slice(2),
} = {}) {
  const options = parseArgs(argv);
  const plan = createWorkspacePackageScriptPlan(options);
  const result = spawnSync(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: 'inherit',
    shell: plan.shell,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.signal) {
    console.error(`[run-workspace-package-script] process exited with signal ${result.signal}`);
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runWorkspacePackageScriptCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
