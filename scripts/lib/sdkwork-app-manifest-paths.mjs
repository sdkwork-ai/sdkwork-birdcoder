import fs from 'node:fs';
import path from 'node:path';

export function listSdkworkAppManifestPaths(rootDir = process.cwd()) {
  const manifests = [path.join(rootDir, 'sdkwork.app.config.json')];
  const appsDir = path.join(rootDir, 'apps');

  if (fs.existsSync(appsDir)) {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(appsDir, entry.name, 'sdkwork.app.config.json');
      if (fs.existsSync(manifestPath)) {
        manifests.push(manifestPath);
      }
    }
  }

  return manifests.filter((manifestPath) => {
    const manifest = readSdkworkAppManifest(manifestPath);
    return typeof manifest.publish?.status === 'string';
  });
}

export function readSdkworkAppManifest(manifestPath) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}
