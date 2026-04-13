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

function copyPreferredTarget(targetPath, candidatePaths) {
  for (const candidatePath of candidatePaths) {
    if (copyIfExists(candidatePath, targetPath)) {
      return candidatePath;
    }
  }

  return '';
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

function stageFamilyPayload(bundleRoot, family, descriptor, rootDir) {
  writeJson(path.join(bundleRoot, 'release-descriptor.json'), descriptor);

  if (family === 'desktop') {
    copyIfExists(
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop', 'src-tauri'),
      path.join(bundleRoot, 'desktop'),
    );
    copyPreferredTarget(path.join(bundleRoot, 'app'), [
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop', 'dist'),
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'dist'),
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'src'),
    ]);
    return;
  }

  if (family === 'server') {
    copyIfExists(
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-server', 'src-host'),
      path.join(bundleRoot, 'server'),
    );
    copyIfExists(
      path.join(rootDir, 'artifacts', 'openapi', 'coding-server-v1.json'),
      path.join(bundleRoot, 'openapi', 'coding-server-v1.json'),
    );
    copyPreferredTarget(path.join(bundleRoot, 'web'), [
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'dist'),
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'src'),
    ]);
    return;
  }

  if (family === 'container') {
    copyIfExists(path.join(rootDir, 'deploy', 'docker'), path.join(bundleRoot, 'deploy'));
    copyIfExists(
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-server', 'src-host'),
      path.join(bundleRoot, 'server'),
    );
    copyPreferredTarget(path.join(bundleRoot, 'web'), [
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'dist'),
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'src'),
    ]);
    writeContainerReleaseSidecars(bundleRoot, descriptor);
    return;
  }

  if (family === 'kubernetes') {
    copyIfExists(path.join(rootDir, 'deploy', 'kubernetes'), path.join(bundleRoot, 'chart'));
    writeKubernetesReleaseSidecars(bundleRoot, descriptor);
    return;
  }

  if (family === 'web') {
    copyPreferredTarget(path.join(bundleRoot, 'app'), [
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'dist'),
      path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'src'),
    ]);
    copyPreferredTarget(path.join(bundleRoot, 'docs'), [
      path.join(rootDir, 'docs', '.vitepress', 'dist'),
      path.join(rootDir, 'docs'),
    ]);
    copyIfExists(path.join(rootDir, 'docs'), path.join(bundleRoot, 'docs-source'));
    return;
  }

  throw new Error(`Unsupported release family: ${family}`);
}

function copyFamilySidecars(bundleRoot, outputFamilyDir, family) {
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

  fs.rmSync(outputFamilyDir, { recursive: true, force: true });
  ensureDir(outputFamilyDir);

  try {
    stageFamilyPayload(bundleRoot, family, descriptor, rootDir);
    createArchive({
      sourceDir: bundleRoot,
      archivePath,
      archiveFormat,
    });
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
