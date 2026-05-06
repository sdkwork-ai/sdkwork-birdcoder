import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  RELEASE_ASSET_MANIFEST_FILE_NAME,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import {
  createPendingDesktopInstallerSignatureEvidence,
} from './desktop-installer-trust-evidence.mjs';

const DEFAULT_KUBERNETES_IMAGE_REPOSITORY = 'ghcr.io/sdkwork-cloud/sdkwork-birdcoder-server';

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      options[key] = 'true';
      continue;
    }

    options[key] = value;
    index += 1;
  }
  return options;
}

function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function normalizeRelativePath(targetPath) {
  return String(targetPath ?? '').split(path.sep).join('/');
}

function writeJson(targetPath, value) {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(targetPath, value) {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, value, 'utf8');
}

function copyIfExists(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
  return true;
}

function copyRequiredBuildOutput({
  sourcePath,
  targetPath,
  label,
  command,
  releaseAssetsLabel = 'release assets',
  requiredEntries = [],
}) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required ${label}: ${sourcePath}. Run \`${command}\` before packaging ${releaseAssetsLabel}.`);
  }

  const sourceStat = fs.statSync(sourcePath);
  if (!sourceStat.isDirectory()) {
    throw new Error(`Required ${label} must be a directory: ${sourcePath}. Run \`${command}\` before packaging ${releaseAssetsLabel}.`);
  }

  for (const requiredEntry of requiredEntries) {
    const requiredEntryPath = path.join(sourcePath, requiredEntry);
    if (!fs.existsSync(requiredEntryPath)) {
      throw new Error(
        `Missing required ${label} entry: ${requiredEntryPath}. Run \`${command}\` before packaging ${releaseAssetsLabel}.`,
      );
    }
  }

  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function copyRequiredFile({
  sourcePath,
  targetPath,
  label,
  command,
  releaseAssetsLabel = 'release assets',
}) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required ${label}: ${sourcePath}. Run \`${command}\` before packaging ${releaseAssetsLabel}.`);
  }
  if (!fs.statSync(sourcePath).isFile()) {
    throw new Error(`Required ${label} must be a file: ${sourcePath}. Run \`${command}\` before packaging ${releaseAssetsLabel}.`);
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function resolveServerBinaryFileName(binaryName, {
  targetTriple = '',
  platform = '',
} = {}) {
  const normalizedBinaryName = String(binaryName ?? '').trim();
  const normalizedTargetTriple = String(targetTriple ?? '').trim().toLowerCase();
  const normalizedPlatform = String(platform ?? '').trim().toLowerCase();
  if (
    (normalizedTargetTriple.includes('windows')
      || normalizedPlatform === 'windows'
      || normalizedPlatform === 'win32')
    && !normalizedBinaryName.toLowerCase().endsWith('.exe')
  ) {
    return `${normalizedBinaryName}.exe`;
  }

  return normalizedBinaryName;
}

function resolveRequiredServerBinaryPath({
  rootDir,
  descriptor,
  profile,
}) {
  const binaryName = String(profile?.server?.binaryName ?? '').trim() || 'sdkwork-birdcoder-server';
  const binaryFileName = resolveServerBinaryFileName(binaryName, {
    targetTriple: descriptor.target,
    platform: descriptor.platform,
  });
  const serverTargetRoot = path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-server',
    'src-host',
    'target',
  );
  const candidatePaths = [];
  const normalizedTarget = String(descriptor.target ?? '').trim();
  if (normalizedTarget) {
    candidatePaths.push(path.join(serverTargetRoot, normalizedTarget, 'release', binaryFileName));
  }
  candidatePaths.push(path.join(serverTargetRoot, 'release', binaryFileName));

  const binaryPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath)) ?? '';
  if (!binaryPath) {
    throw new Error(
      `Missing required server binary build output: ${candidatePaths[0]}. Run \`pnpm server:build\` before packaging ${descriptor.family} release assets.`,
    );
  }
  if (!fs.statSync(binaryPath).isFile()) {
    throw new Error(
      `Required server binary build output must be a file: ${binaryPath}. Run \`pnpm server:build\` before packaging ${descriptor.family} release assets.`,
    );
  }

  return {
    binaryFileName,
    binaryPath,
  };
}

function copyRequiredServerBinary({
  bundleRoot,
  descriptor,
  rootDir,
  profile,
}) {
  const { binaryFileName, binaryPath } = resolveRequiredServerBinaryPath({
    rootDir,
    descriptor,
    profile,
  });
  copyIfExists(
    binaryPath,
    path.join(bundleRoot, 'server', 'bin', binaryFileName),
  );
}

function resolveDesktopBundleOutputRoot({
  rootDir,
  target,
} = {}) {
  const targetRoot = path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-desktop',
    'src-tauri',
    'target',
  );
  const normalizedTarget = String(target ?? '').trim();
  if (normalizedTarget) {
    return path.join(targetRoot, normalizedTarget, 'release', 'bundle');
  }

  return path.join(targetRoot, 'release', 'bundle');
}

function isDesktopInstallerArtifact(filePath) {
  const normalizedPath = String(filePath ?? '').trim().replaceAll('\\', '/').toLowerCase();
  return (
    normalizedPath.endsWith('.exe')
    || normalizedPath.endsWith('.msi')
    || normalizedPath.endsWith('.deb')
    || normalizedPath.endsWith('.rpm')
    || normalizedPath.endsWith('.appimage')
    || normalizedPath.endsWith('.dmg')
    || normalizedPath.endsWith('.app.tar.gz')
    || normalizedPath.endsWith('.app.zip')
  );
}

function resolveDesktopReleaseTarget({
  profile,
  descriptor,
} = {}) {
  const normalizedPlatform = String(descriptor?.platform ?? '').trim();
  const normalizedArch = String(descriptor?.arch ?? '').trim();
  const normalizedTarget = String(descriptor?.target ?? '').trim();
  const matchingTargets = (profile?.desktop?.matrix ?? [])
    .filter((entry) => (
      String(entry.platform ?? '').trim() === normalizedPlatform
      && String(entry.arch ?? '').trim() === normalizedArch
      && (!normalizedTarget || String(entry.target ?? '').trim() === normalizedTarget)
    ));

  if (matchingTargets.length === 0) {
    throw new Error(
      `Unsupported desktop release target for profile ${profile?.id ?? descriptor?.profileId ?? 'unknown'}: ${normalizedPlatform}/${normalizedArch}/${normalizedTarget || 'default'}.`,
    );
  }
  if (matchingTargets.length > 1) {
    throw new Error(
      `Ambiguous desktop release target for profile ${profile?.id ?? descriptor?.profileId ?? 'unknown'}: ${normalizedPlatform}/${normalizedArch}/${normalizedTarget || 'default'}. Pass --target before packaging desktop release assets.`,
    );
  }

  return matchingTargets[0];
}

function resolveRequiredDesktopBundles({
  profile,
  descriptor,
  desktopReleaseTarget,
} = {}) {
  const resolvedDesktopReleaseTarget = desktopReleaseTarget ?? resolveDesktopReleaseTarget({
    profile,
    descriptor,
  });
  const normalizedPlatform = String(descriptor?.platform ?? '').trim();
  const normalizedArch = String(descriptor?.arch ?? '').trim();
  const normalizedTarget = String(descriptor?.target ?? '').trim();
  const requiredBundles = resolvedDesktopReleaseTarget.bundles ?? [];
  if (!Array.isArray(requiredBundles) || requiredBundles.length === 0) {
    throw new Error(
      `Desktop release target for profile ${profile?.id ?? descriptor?.profileId ?? 'unknown'} has no required installer bundles: ${normalizedPlatform}/${normalizedArch}/${normalizedTarget || String(resolvedDesktopReleaseTarget.target ?? '').trim() || 'default'}.`,
    );
  }

  return requiredBundles.map((bundle) => String(bundle ?? '').trim()).filter(Boolean);
}

function desktopInstallerSatisfiesBundle({
  bundleOutputRoot,
  installerPath,
  bundle,
} = {}) {
  const relativePath = normalizeRelativePath(path.relative(bundleOutputRoot, installerPath)).toLowerCase();
  const firstSegment = relativePath.split('/')[0] ?? '';
  const normalizedBundle = String(bundle ?? '').trim().toLowerCase();

  if (firstSegment !== normalizedBundle) {
    return false;
  }
  if (normalizedBundle === 'nsis') {
    return relativePath.endsWith('.exe');
  }
  if (normalizedBundle === 'msi') {
    return relativePath.endsWith('.msi');
  }
  if (normalizedBundle === 'deb') {
    return relativePath.endsWith('.deb');
  }
  if (normalizedBundle === 'rpm') {
    return relativePath.endsWith('.rpm');
  }
  if (normalizedBundle === 'appimage') {
    return relativePath.endsWith('.appimage');
  }
  if (normalizedBundle === 'app') {
    return relativePath.endsWith('.app.zip') || relativePath.endsWith('.app.tar.gz');
  }
  if (normalizedBundle === 'dmg') {
    return relativePath.endsWith('.dmg');
  }

  return false;
}

function assertRequiredDesktopInstallerBundles({
  bundleOutputRoot,
  descriptor,
  installerPaths,
  profile,
  desktopReleaseTarget,
} = {}) {
  const requiredBundles = resolveRequiredDesktopBundles({
    profile,
    descriptor,
    desktopReleaseTarget,
  });
  const missingBundles = requiredBundles.filter((bundle) => !installerPaths.some((installerPath) => desktopInstallerSatisfiesBundle({
    bundleOutputRoot,
    installerPath,
    bundle,
  })));

  if (missingBundles.length > 0) {
    throw new Error(
      [
        `Missing required desktop installer bundle artifacts for profile ${profile?.id ?? descriptor.profileId}: ${descriptor.platform}/${descriptor.arch}/${descriptor.target || 'default'}`,
        `bundleOutputRoot: ${bundleOutputRoot}`,
        `missing: ${missingBundles.join(', ')}`,
        'Run `pnpm tauri:build` before packaging desktop release assets.',
      ].join('. '),
    );
  }
}

function resolveDesktopInstallerArtifacts({
  descriptor,
  rootDir,
} = {}) {
  const bundleOutputRoot = resolveDesktopBundleOutputRoot({
    rootDir,
    target: descriptor.target,
  });
  if (!fs.existsSync(bundleOutputRoot)) {
    throw new Error(
      `Missing required desktop installer bundle output: ${bundleOutputRoot}. Run \`pnpm tauri:build\` before packaging desktop release assets.`,
    );
  }
  if (!fs.statSync(bundleOutputRoot).isDirectory()) {
    throw new Error(
      `Required desktop installer bundle output must be a directory: ${bundleOutputRoot}. Run \`pnpm tauri:build\` before packaging desktop release assets.`,
    );
  }

  const installerPaths = listFiles(bundleOutputRoot)
    .filter(isDesktopInstallerArtifact);
  if (installerPaths.length === 0) {
    throw new Error(
      `Missing native desktop installer artifacts under ${bundleOutputRoot}. Run \`pnpm tauri:build\` before packaging desktop release assets.`,
    );
  }

  return {
    bundleOutputRoot,
    installerPaths,
  };
}

function resolveDesktopInstallerArtifactRelativePath({
  bundleOutputRoot,
  installerPath,
} = {}) {
  const relativePath = normalizeRelativePath(path.relative(bundleOutputRoot, installerPath));
  if (
    !relativePath
    || relativePath === '.'
    || path.posix.isAbsolute(relativePath)
    || path.win32.isAbsolute(relativePath)
    || relativePath.split('/').includes('..')
  ) {
    throw new Error(`Unsafe desktop installer artifact path under Tauri bundle output: ${installerPath}`);
  }

  return path.posix.join('installers', relativePath);
}

function resolveDesktopInstallerManifestMetadata({
  descriptor,
  outputFamilyDir,
  filePath,
} = {}) {
  if (descriptor.family !== 'desktop') {
    return {};
  }

  const familyRelativePath = normalizeRelativePath(path.relative(outputFamilyDir, filePath));
  const pathSegments = familyRelativePath.split('/');
  if (pathSegments[0] !== 'installers' || pathSegments.length < 3) {
    return {};
  }
  if (!isDesktopInstallerArtifact(filePath)) {
    return {};
  }

  const bundle = String(pathSegments[1] ?? '').trim().toLowerCase();
  if (!bundle) {
    return {};
  }

  return {
    kind: 'installer',
    bundle,
    installerFormat: bundle,
    target: String(descriptor.target ?? '').trim(),
    signatureEvidence: createPendingDesktopInstallerSignatureEvidence({
      platform: descriptor.platform,
      bundle,
    }),
  };
}

function copyDesktopInstallerArtifacts({
  descriptor,
  profile,
  rootDir,
  outputFamilyDir,
  desktopInstallerArtifacts,
  desktopReleaseTarget,
} = {}) {
  const resolvedDesktopInstallerArtifacts = desktopInstallerArtifacts ?? resolveDesktopInstallerArtifacts({
    descriptor,
    rootDir,
  });
  const { bundleOutputRoot, installerPaths } = resolvedDesktopInstallerArtifacts;
  assertRequiredDesktopInstallerBundles({
    bundleOutputRoot,
    descriptor,
    installerPaths,
    profile,
    desktopReleaseTarget,
  });

  const seenOutputRelativePaths = new Set();
  for (const installerPath of installerPaths) {
    const installerRelativePath = resolveDesktopInstallerArtifactRelativePath({
      bundleOutputRoot,
      installerPath,
    });
    const normalizedOutputKey = installerRelativePath.toLowerCase();
    if (seenOutputRelativePaths.has(normalizedOutputKey)) {
      throw new Error(
        `Duplicate desktop installer artifact output path after normalization: ${installerRelativePath}`,
      );
    }

    seenOutputRelativePaths.add(normalizedOutputKey);
    copyIfExists(
      installerPath,
      path.join(outputFamilyDir, ...installerRelativePath.split('/')),
    );
  }
}

function listFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const files = [];
  const stack = [directoryPath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      files.push(absolutePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function writeTarHeader({
  name,
  mode,
  size,
  mtime,
  type = '0',
}) {
  const header = Buffer.alloc(512, 0);
  const normalizedName = String(name ?? '').replaceAll('\\', '/');
  const { headerName, headerPrefix } = splitTarPath(normalizedName);

  header.write(headerName, 0, 100, 'utf8');
  header.write((mode & 0o777).toString(8).padStart(7, '0') + '\0', 100, 8, 'ascii');
  header.write('0000000\0', 108, 8, 'ascii');
  header.write('0000000\0', 116, 8, 'ascii');
  header.write((size ?? 0).toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  header.write(Math.floor((mtime ?? Date.now()) / 1000).toString(8).padStart(11, '0') + '\0', 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write(String(type ?? '0').slice(0, 1), 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  if (headerPrefix) {
    header.write(headerPrefix, 345, 155, 'utf8');
  }

  let checksum = 0;
  for (const byte of header.values()) {
    checksum += byte;
  }
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');

  return header;
}

function splitTarPath(normalizedName) {
  const nameBuffer = Buffer.from(normalizedName, 'utf8');
  if (nameBuffer.length <= 100) {
    return {
      headerName: normalizedName,
      headerPrefix: '',
    };
  }

  const segments = normalizedName.split('/');
  for (let index = segments.length - 1; index > 0; index -= 1) {
    const prefix = segments.slice(0, index).join('/');
    const suffix = segments.slice(index).join('/');
    if (Buffer.byteLength(prefix, 'utf8') <= 155 && Buffer.byteLength(suffix, 'utf8') <= 100) {
      return {
        headerName: suffix,
        headerPrefix: prefix,
      };
    }
  }

  throw new Error(`Tar entry path is too long for the BirdCoder packager: ${normalizedName}`);
}

function createTarGzArchive({
  sourceDir,
  archivePath,
} = {}) {
  const sourceRoot = path.resolve(sourceDir);
  const tarChunks = [];
  const stack = [sourceRoot];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    const stat = fs.statSync(currentPath);
    const relativePath = path.relative(path.dirname(sourceRoot), currentPath);
    const archiveEntryPath = normalizeRelativePath(relativePath);

    if (stat.isDirectory()) {
      const directoryName = archiveEntryPath.endsWith('/') ? archiveEntryPath : `${archiveEntryPath}/`;
      tarChunks.push(writeTarHeader({
        name: directoryName,
        mode: stat.mode,
        size: 0,
        mtime: stat.mtimeMs,
        type: '5',
      }));

      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        stack.push(path.join(currentPath, entries[index].name));
      }
      continue;
    }

    const fileContents = fs.readFileSync(currentPath);
    tarChunks.push(writeTarHeader({
      name: archiveEntryPath,
      mode: stat.mode,
      size: fileContents.length,
      mtime: stat.mtimeMs,
      type: '0',
    }));
    tarChunks.push(fileContents);

    const remainder = fileContents.length % 512;
    if (remainder > 0) {
      tarChunks.push(Buffer.alloc(512 - remainder, 0));
    }
  }

  tarChunks.push(Buffer.alloc(1024, 0));
  const tarBuffer = Buffer.concat(tarChunks);
  const gzipBuffer = zlib.gzipSync(tarBuffer);
  ensureDir(path.dirname(archivePath));
  fs.writeFileSync(archivePath, gzipBuffer);
}

function createArchive({
  sourceDir,
  archivePath,
  archiveFormat,
} = {}) {
  ensureDir(path.dirname(archivePath));
  fs.rmSync(archivePath, { force: true });

  if (String(archiveFormat ?? '').trim().toLowerCase() !== 'tar.gz') {
    throw new Error(`Unsupported archive format for the BirdCoder packager: ${archiveFormat}`);
  }

  createTarGzArchive({
    sourceDir,
    archivePath,
  });
}

function resolveArchiveFormat(family, descriptor) {
  return 'tar.gz';
}

function buildBundleBaseName(descriptor) {
  return [
    'sdkwork-birdcoder',
    descriptor.family,
    descriptor.releaseTag,
    descriptor.platform,
    descriptor.arch,
    descriptor.accelerator,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join('-');
}

function resolveOutputFamilyDir(outputDir, descriptor) {
  if (descriptor.family === 'web') {
    return path.join(outputDir, 'web');
  }

  if (descriptor.family === 'container' || descriptor.family === 'kubernetes') {
    return path.join(
      outputDir,
      descriptor.family,
      descriptor.platform || 'linux',
      descriptor.arch || 'x64',
      descriptor.accelerator || 'cpu',
    );
  }

  return path.join(
    outputDir,
    descriptor.family,
    descriptor.platform || process.platform,
    descriptor.arch || process.arch,
  );
}

function createReleaseDescriptor(family, options = {}) {
  const normalizedHostPlatform = process.platform === 'win32'
    ? 'windows'
    : process.platform === 'darwin'
      ? 'macos'
      : process.platform;
  const defaultReleaseTag = family === 'desktop' ? '' : 'release-local';

  return {
    family,
    releaseTag: options['release-tag'] ?? defaultReleaseTag,
    profileId: options.profile ?? DEFAULT_RELEASE_PROFILE_ID,
    platform: options.platform ?? (
      family === 'web'
        ? ''
        : family === 'container' || family === 'kubernetes'
          ? 'linux'
          : normalizedHostPlatform
    ),
    arch: options.arch ?? (family === 'web' ? '' : process.arch),
    target: options.target ?? '',
    accelerator: options.accelerator ?? (family === 'container' || family === 'kubernetes' ? 'cpu' : ''),
    imageRepository: options['image-repository'] ?? '',
    imageTag: options['image-tag'] ?? '',
    imageDigest: options['image-digest'] ?? '',
    createdAt: new Date().toISOString(),
  };
}

function writeKubernetesReleaseSidecars(bundleRoot, descriptor) {
  const normalizedImageRepository =
    String(descriptor.imageRepository ?? '').trim() || DEFAULT_KUBERNETES_IMAGE_REPOSITORY;
  const normalizedImageTag =
    String(descriptor.imageTag ?? '').trim() || String(descriptor.releaseTag ?? '').trim() || 'release-local';
  const normalizedImageDigest = String(descriptor.imageDigest ?? '').trim();

  writeText(
    path.join(bundleRoot, 'values.release.yaml'),
    [
      `targetArchitecture: ${descriptor.arch || 'x64'}`,
      `acceleratorProfile: ${descriptor.accelerator || 'cpu'}`,
      'image:',
      `  repository: ${normalizedImageRepository}`,
      `  tag: ${normalizedImageTag}`,
      `  digest: ${normalizedImageDigest}`,
      '',
    ].join('\n'),
  );

  writeJson(path.join(bundleRoot, 'release-metadata.json'), {
    family: descriptor.family,
    releaseTag: descriptor.releaseTag,
    platform: descriptor.platform,
    arch: descriptor.arch,
    accelerator: descriptor.accelerator || 'cpu',
    imageRepository: normalizedImageRepository,
    imageTag: normalizedImageTag,
    imageDigest: normalizedImageDigest || null,
  });

  return {
    imageRepository: normalizedImageRepository,
    imageTag: normalizedImageTag,
    imageDigest: normalizedImageDigest,
  };
}

function writeContainerReleaseSidecars(bundleRoot, descriptor) {
  writeJson(path.join(bundleRoot, 'release-metadata.json'), {
    family: descriptor.family,
    releaseTag: descriptor.releaseTag,
    platform: descriptor.platform,
    arch: descriptor.arch,
    accelerator: descriptor.accelerator || 'cpu',
  });
}

function stageFamilyPayload(bundleRoot, family, descriptor, rootDir, profile) {
  writeJson(path.join(bundleRoot, 'release-descriptor.json'), descriptor);

  if (family === 'desktop') {
    copyIfExists(
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop', 'src-tauri'),
      path.join(bundleRoot, 'desktop'),
    );
    copyRequiredBuildOutput({
      sourcePath: path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop', 'dist'),
      targetPath: path.join(bundleRoot, 'app'),
      label: 'desktop app build output',
      command: 'pnpm tauri:build',
      releaseAssetsLabel: 'desktop release assets',
      requiredEntries: ['index.html'],
    });
    return;
  }

  if (family === 'server') {
    copyRequiredServerBinary({
      bundleRoot,
      descriptor,
      rootDir,
      profile,
    });
    copyRequiredFile({
      sourcePath: path.join(rootDir, 'artifacts', 'openapi', 'coding-server-v1.json'),
      targetPath: path.join(bundleRoot, 'openapi', 'coding-server-v1.json'),
      label: 'coding-server OpenAPI snapshot',
      command: 'pnpm generate:openapi:coding-server',
      releaseAssetsLabel: 'server release assets',
    });
    copyRequiredBuildOutput({
      sourcePath: path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'dist'),
      targetPath: path.join(bundleRoot, 'web'),
      label: 'server web build output',
      command: 'pnpm build',
      releaseAssetsLabel: 'server release assets',
      requiredEntries: ['index.html'],
    });
    return;
  }

  if (family === 'container') {
    copyIfExists(path.join(rootDir, 'deploy', 'docker'), path.join(bundleRoot, 'deploy', 'docker'));
    copyRequiredServerBinary({
      bundleRoot,
      descriptor,
      rootDir,
      profile,
    });
    copyRequiredBuildOutput({
      sourcePath: path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'dist'),
      targetPath: path.join(bundleRoot, 'web'),
      label: 'container web build output',
      command: 'pnpm build',
      releaseAssetsLabel: 'container release assets',
      requiredEntries: ['index.html'],
    });
    writeContainerReleaseSidecars(bundleRoot, descriptor);
    return;
  }

  if (family === 'kubernetes') {
    copyIfExists(path.join(rootDir, 'deploy', 'kubernetes'), path.join(bundleRoot, 'chart'));
    writeKubernetesReleaseSidecars(bundleRoot, descriptor);
    return;
  }

  if (family === 'web') {
    copyRequiredBuildOutput({
      sourcePath: path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'dist'),
      targetPath: path.join(bundleRoot, 'app'),
      label: 'web app build output',
      command: 'pnpm build',
      releaseAssetsLabel: 'web release assets',
      requiredEntries: ['index.html'],
    });
    copyRequiredBuildOutput({
      sourcePath: path.join(rootDir, 'docs', '.vitepress', 'dist'),
      targetPath: path.join(bundleRoot, 'docs'),
      label: 'public docs build output',
      command: 'pnpm docs:build',
      releaseAssetsLabel: 'web release assets',
      requiredEntries: ['index.html', '404.html', 'search-index.json'],
    });
    return;
  }

  throw new Error(`Unsupported release family: ${family}`);
}

function copyFamilySidecars(bundleRoot, outputFamilyDir, family) {
  if (family === 'desktop') {
    return;
  }

  if (family === 'server') {
    copyIfExists(
      path.join(bundleRoot, 'openapi', 'coding-server-v1.json'),
      path.join(outputFamilyDir, 'openapi', 'coding-server-v1.json'),
    );
  }

  if (family === 'container') {
    copyIfExists(
      path.join(bundleRoot, 'release-metadata.json'),
      path.join(outputFamilyDir, 'release-metadata.json'),
    );
  }

  if (family === 'kubernetes') {
    copyIfExists(
      path.join(bundleRoot, 'release-metadata.json'),
      path.join(outputFamilyDir, 'release-metadata.json'),
    );
    copyIfExists(
      path.join(bundleRoot, 'values.release.yaml'),
      path.join(outputFamilyDir, 'values.release.yaml'),
    );
  }
}

function createReleaseAssetManifest({
  descriptor,
  profile,
  outputDir,
  outputFamilyDir,
  archivePath,
  archiveFormat,
}) {
  const artifacts = listFiles(outputFamilyDir)
    .filter((filePath) => path.resolve(filePath) !== path.resolve(path.join(outputFamilyDir, RELEASE_ASSET_MANIFEST_FILE_NAME)))
    .map((filePath) => ({
      relativePath: normalizeRelativePath(path.relative(outputDir, filePath)),
      size: fs.statSync(filePath).size,
      ...resolveDesktopInstallerManifestMetadata({
        descriptor,
        outputFamilyDir,
        filePath,
      }),
    }));

  const manifest = {
    family: descriptor.family,
    profileId: descriptor.profileId,
    productName: profile.productName,
    releaseTag: descriptor.releaseTag,
    platform: descriptor.platform,
    arch: descriptor.arch,
    target: descriptor.target,
    accelerator: descriptor.accelerator,
    imageRepository: descriptor.imageRepository || '',
    imageTag: descriptor.imageTag || '',
    imageDigest: descriptor.imageDigest || '',
    archiveFormat,
    archiveRelativePath: normalizeRelativePath(path.relative(outputDir, archivePath)),
    artifacts,
    createdAt: descriptor.createdAt,
  };

  const manifestPath = path.join(outputFamilyDir, RELEASE_ASSET_MANIFEST_FILE_NAME);
  writeJson(manifestPath, manifest);

  return {
    manifest,
    manifestPath,
  };
}

function resolveArchiveExtension(archiveFormat) {
  return '.tar.gz';
}

function packageReleaseAssets(family, options = {}) {
  const rootDir = process.cwd();
  const descriptor = createReleaseDescriptor(family, options);
  const profile = resolveReleaseProfile(descriptor.profileId);
  const outputDir = path.resolve(rootDir, options['output-dir'] ?? 'artifacts/release');
  const outputFamilyDir = resolveOutputFamilyDir(outputDir, descriptor);
  const bundleBaseName = buildBundleBaseName(descriptor);
  const archiveFormat = resolveArchiveFormat(family, descriptor);
  const archivePath = path.join(
    outputFamilyDir,
    `${bundleBaseName}${resolveArchiveExtension(archiveFormat)}`,
  );
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), `birdcoder-release-${family}-`));
  const bundleRoot = path.join(stagingRoot, bundleBaseName);
  const desktopReleaseTarget = family === 'desktop'
    ? resolveDesktopReleaseTarget({
      profile,
      descriptor,
    })
    : null;
  let desktopInstallerArtifacts;

  fs.rmSync(outputFamilyDir, { recursive: true, force: true });
  ensureDir(outputFamilyDir);

  try {
    stageFamilyPayload(bundleRoot, family, descriptor, rootDir, profile);
    if (family === 'desktop') {
      desktopInstallerArtifacts = resolveDesktopInstallerArtifacts({
        descriptor,
        rootDir,
      });
      assertRequiredDesktopInstallerBundles({
        bundleOutputRoot: desktopInstallerArtifacts.bundleOutputRoot,
        descriptor,
        installerPaths: desktopInstallerArtifacts.installerPaths,
        profile,
        desktopReleaseTarget,
      });
    }
    createArchive({
      sourceDir: bundleRoot,
      archivePath,
      archiveFormat,
    });
    if (family === 'desktop') {
      copyDesktopInstallerArtifacts({
        descriptor,
        profile,
        rootDir,
        outputFamilyDir,
        desktopInstallerArtifacts,
        desktopReleaseTarget,
      });
    }
    copyFamilySidecars(bundleRoot, outputFamilyDir, family);
    const { manifest, manifestPath } = createReleaseAssetManifest({
      descriptor,
      profile,
      outputDir,
      outputFamilyDir,
      archivePath,
      archiveFormat,
    });

    return {
      outputDir,
      outputFamilyDir,
      archivePath,
      manifestPath,
      descriptor,
      manifest,
    };
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

export {
  DEFAULT_KUBERNETES_IMAGE_REPOSITORY,
  createReleaseDescriptor,
  packageReleaseAssets,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [family = '', ...restArgs] = process.argv.slice(2);
  if (!family) {
    throw new Error('A release family is required: desktop, server, container, kubernetes, or web.');
  }

  const result = packageReleaseAssets(family, parseOptions(restArgs));
  console.log(JSON.stringify(result.manifest, null, 2));
}
