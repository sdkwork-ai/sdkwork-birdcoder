import fs from 'node:fs';
import path from 'node:path';

export const BIRDCODER_APPLICATION_PACKAGE_ROOTS = Object.freeze([
  'apps/sdkwork-birdcoder-pc/packages',
  'apps/sdkwork-birdcoder-h5/packages',
  'apps/sdkwork-birdcoder-common/packages',
]);

export function resolveBirdcoderApplicationPackageRoots(rootDir = process.cwd()) {
  return BIRDCODER_APPLICATION_PACKAGE_ROOTS.map((relativePath) => path.join(rootDir, relativePath));
}

export function walkBirdcoderApplicationPackageFiles(rootDir, visitFile) {
  for (const packageRoot of resolveBirdcoderApplicationPackageRoots(rootDir)) {
    if (!fs.existsSync(packageRoot)) {
      continue;
    }

    const stack = [packageRoot];
    while (stack.length > 0) {
      const currentPath = stack.pop();
      for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
        const entryPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'target') {
            continue;
          }
          stack.push(entryPath);
          continue;
        }

        visitFile(entryPath);
      }
    }
  }
}

export function collectBirdcoderApplicationPackageManifests(rootDir, readJson) {
  const manifests = [];

  for (const packageRoot of resolveBirdcoderApplicationPackageRoots(rootDir)) {
    if (!fs.existsSync(packageRoot)) {
      continue;
    }

    for (const entry of fs.readdirSync(packageRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageJsonPath = path.join(packageRoot, entry.name, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        continue;
      }

      manifests.push({
        dirName: entry.name,
        relativePath: path.relative(rootDir, packageJsonPath).split(path.sep).join('/'),
        manifest: readJson(packageJsonPath),
      });
    }
  }

  return manifests.sort((left, right) => left.dirName.localeCompare(right.dirName));
}
