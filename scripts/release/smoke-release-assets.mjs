import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { smokeDeploymentReleaseAssets } from './smoke-deployment-release-assets.mjs';
import { smokeDesktopInstallers } from './smoke-desktop-installers.mjs';
import { smokeServerReleaseAssets } from './smoke-server-release-assets.mjs';
import {
  smokeWebReleaseAssets,
} from './smoke-web-release-assets.mjs';

function readOption(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return '';
  }

  return process.argv[index + 1];
}

export async function smokeReleaseAssets({
  family = '',
  releaseAssetsDir = '',
  platform = process.platform,
  arch = process.arch,
  target = '',
  accelerator = 'cpu',
} = {}) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();
  const normalizedAssetsDir = String(releaseAssetsDir ?? '').trim();
  if (!normalizedFamily) {
    throw new Error('A release family is required for smoke verification.');
  }
  if (!normalizedAssetsDir) {
    throw new Error('A release assets directory is required for smoke verification.');
  }

  if (normalizedFamily === 'desktop') {
    return smokeDesktopInstallers({
      releaseAssetsDir: normalizedAssetsDir,
      platform,
      arch,
      target,
    });
  }
  if (normalizedFamily === 'server') {
    return smokeServerReleaseAssets({
      releaseAssetsDir: normalizedAssetsDir,
      platform,
      arch,
      target,
    });
  }
  if (normalizedFamily === 'container' || normalizedFamily === 'kubernetes') {
    return smokeDeploymentReleaseAssets({
      family: normalizedFamily,
      releaseAssetsDir: normalizedAssetsDir,
      platform,
      arch,
      target,
      accelerator,
    });
  }
  if (normalizedFamily === 'web') {
    const result = await smokeWebReleaseAssets({
      releaseAssetsDir: normalizedAssetsDir,
    });
    return {
      archivePath: result.archivePath,
      family: 'web',
      manifestPath: result.manifestPath,
      smokeReportPath: result.report.reportPath,
    };
  }

  throw new Error(`Unsupported release family: ${family}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await smokeReleaseAssets({
    family: process.argv[2] || readOption('--family'),
    releaseAssetsDir: readOption('--release-assets-dir'),
    platform: readOption('--platform') || process.platform,
    arch: readOption('--arch') || process.arch,
    target: readOption('--target') || '',
    accelerator: readOption('--accelerator') || 'cpu',
  });
  console.log(JSON.stringify(result, null, 2));
}
