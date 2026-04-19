import path from 'node:path';
import process from 'node:process';

export function resolvePathKey(env = process.env, platform = process.platform) {
  return Object.keys(env).find((key) => key.toUpperCase() === 'PATH')
    ?? (platform === 'win32' ? 'Path' : 'PATH');
}

export function resolvePathDelimiter(platform = process.platform) {
  return platform === 'win32' ? ';' : ':';
}

export function normalizePathEntry(entry, platform = process.platform) {
  const pathModule = platform === 'win32' ? path.win32 : path.posix;
  const normalizedEntry = pathModule.normalize(String(entry ?? '').trim());

  return platform === 'win32'
    ? normalizedEntry.replace(/[\\/]+$/, '').toLowerCase()
    : normalizedEntry.replace(/\/+$/, '');
}

export function splitPathEntries(pathValue, platform = process.platform) {
  return String(pathValue ?? '')
    .split(resolvePathDelimiter(platform))
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

export function uniquePathEntries(entries, platform = process.platform) {
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

export function resolveNodeBinDir(execPath = process.execPath, platform = process.platform) {
  const pathModule = platform === 'win32' ? path.win32 : path.posix;
  return pathModule.dirname(String(execPath ?? '').trim());
}

export function ensureNodeExecPathOnPath({
  env = process.env,
  platform = process.platform,
  execPath = process.execPath,
} = {}) {
  const pathKey = resolvePathKey(env, platform);
  const nextEnv = {
    ...env,
  };
  const nodeBinDir = resolveNodeBinDir(execPath, platform);
  const pathEntries = splitPathEntries(
    nextEnv[pathKey] ?? nextEnv.PATH ?? nextEnv.Path ?? '',
    platform,
  );

  if (
    nodeBinDir
    && !pathEntries.some((entry) => normalizePathEntry(entry, platform) === normalizePathEntry(nodeBinDir, platform))
  ) {
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

  return nextEnv;
}
