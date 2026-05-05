#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  assertDesktopInstallerSignatureEvidence,
  collectDesktopInstallerTrustSignals,
  normalizeDesktopInstallerSignatureEvidence,
  resolveDesktopInstallerSignatureScheme,
} from './desktop-installer-trust-evidence.mjs';
import {
  RELEASE_ASSET_MANIFEST_FILE_NAME,
} from './release-profiles.mjs';

export const DESKTOP_INSTALLER_TRUST_REPORT_FILENAME = 'desktop-installer-trust-report.json';

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function normalizePlatform(platform) {
  const normalizedPlatform = String(platform ?? '').trim().toLowerCase();
  if (normalizedPlatform === 'win32') {
    return 'windows';
  }
  if (normalizedPlatform === 'darwin') {
    return 'macos';
  }

  return normalizedPlatform;
}

function normalizeArch(arch) {
  return String(arch ?? '').trim().toLowerCase();
}

function normalizeRelativePath(relativePath) {
  return String(relativePath ?? '').trim().replaceAll('\\', '/');
}

function assertSafeRelativePath(relativePath) {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  if (!normalizedRelativePath) {
    throw new Error('Desktop installer artifact is missing relativePath.');
  }
  if (
    path.posix.isAbsolute(normalizedRelativePath)
    || path.win32.isAbsolute(normalizedRelativePath)
    || normalizedRelativePath.split('/').includes('..')
  ) {
    throw new Error(`Unsafe desktop installer artifact path: ${normalizedRelativePath}`);
  }

  return normalizedRelativePath;
}

function parseKeyValueLines(output) {
  const values = new Map();
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index <= 0) {
      continue;
    }

    values.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
  }

  return values;
}

function runPowerShell(args) {
  return execFileSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join('\n');
    throw new Error(
      detail
        ? `${command} ${args.join(' ')} failed: ${detail}`
        : `${command} ${args.join(' ')} failed with exit code ${result.status}.`,
    );
  }

  return {
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
}

function verifyWindowsAuthenticode({
  artifactPath,
  verifiedAt,
} = {}) {
  const output = runPowerShell([
    '-Command',
    [
      '$signature = Get-AuthenticodeSignature -LiteralPath $args[0]',
      'if ($signature.Status -ne "Valid") { throw "Authenticode signature status is $($signature.Status)" }',
      '$subject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { "" }',
      '$issuer = if ($signature.SignerCertificate) { $signature.SignerCertificate.Issuer } else { "" }',
      '$timestamped = $signature.TimeStamperCertificate -ne $null',
      'Write-Output "subject:$subject"',
      'Write-Output "issuer:$issuer"',
      'Write-Output "timestamped:$timestamped"',
    ].join('; '),
    artifactPath,
  ]);
  const values = parseKeyValueLines(output);

  return {
    status: 'passed',
    required: true,
    scheme: 'windows-authenticode',
    verifiedAt,
    subject: values.get('subject') ?? '',
    issuer: values.get('issuer') ?? '',
    timestamped: String(values.get('timestamped') ?? '').trim().toLowerCase() === 'true',
    notarized: false,
    stapled: false,
    packageMetadataVerified: true,
  };
}

function verifyMacosCodesignNotarization({
  artifactPath,
  verifiedAt,
  commandRunner = runCommand,
} = {}) {
  const codesignOutput = commandRunner(
    'codesign',
    ['--verify', '--deep', '--strict', '--verbose=2', artifactPath],
  );
  commandRunner(
    'spctl',
    ['--assess', '--type', 'execute', '--verbose=2', artifactPath],
  );
  commandRunner(
    'xcrun',
    ['stapler', 'validate', artifactPath],
  );
  const displayOutput = commandRunner(
    'codesign',
    ['--display', '--verbose=4', artifactPath],
  );
  const authorities = [
    codesignOutput?.stdout,
    codesignOutput?.stderr,
    displayOutput?.stdout,
    displayOutput?.stderr,
  ]
    .join('\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('Authority='))
    .map((line) => line.slice('Authority='.length).trim())
    .filter(Boolean);
  const subject = authorities[0] ?? '';
  const issuer = authorities[1] ?? authorities[0] ?? '';

  return {
    status: 'passed',
    required: true,
    scheme: 'macos-codesign-notarization',
    verifiedAt,
    subject,
    issuer,
    timestamped: false,
    notarized: true,
    stapled: true,
    packageMetadataVerified: true,
  };
}

function verifyLinuxPackageMetadata({
  artifactPath,
  relativePath,
  verifiedAt,
} = {}) {
  const normalizedRelativePath = String(relativePath ?? '').trim().toLowerCase();
  if (normalizedRelativePath.endsWith('.deb')) {
    execFileSync(
      'dpkg-deb',
      ['--field', artifactPath],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } else if (normalizedRelativePath.endsWith('.rpm')) {
    execFileSync(
      'rpm',
      ['-qip', artifactPath],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } else {
    const stat = fs.statSync(artifactPath);
    if (!stat.isFile() || stat.size <= 0) {
      throw new Error(`Linux installer package metadata verification failed for ${relativePath}.`);
    }
  }

  return {
    status: 'passed',
    required: true,
    scheme: 'linux-package-metadata',
    verifiedAt,
    subject: '',
    issuer: '',
    timestamped: false,
    notarized: false,
    stapled: false,
    packageMetadataVerified: true,
  };
}

export function verifyDesktopInstallerArtifactSignature({
  artifact,
  artifactPath,
  expectedScheme = '',
  verifiedAt = new Date().toISOString(),
  commandRunner = runCommand,
} = {}) {
  const scheme = String(expectedScheme ?? '').trim().toLowerCase()
    || resolveDesktopInstallerSignatureScheme({
      platform: artifact?.platform,
      bundle: artifact?.bundle,
    });

  if (scheme === 'windows-authenticode') {
    return verifyWindowsAuthenticode({ artifactPath, verifiedAt });
  }
  if (scheme === 'macos-codesign-notarization') {
    return verifyMacosCodesignNotarization({ artifactPath, verifiedAt, commandRunner });
  }
  if (scheme === 'linux-package-metadata') {
    return verifyLinuxPackageMetadata({
      artifactPath,
      relativePath: artifact?.relativePath,
      verifiedAt,
    });
  }

  const stat = fs.statSync(artifactPath);
  if (!stat.isFile() || stat.size <= 0) {
    throw new Error(`Native installer attestation failed for ${artifact?.relativePath ?? artifactPath}.`);
  }

  return {
    status: 'passed',
    required: true,
    scheme,
    verifiedAt,
    subject: '',
    issuer: '',
    timestamped: false,
    notarized: false,
    stapled: false,
    packageMetadataVerified: true,
  };
}

function resolveManifestPath({
  releaseAssetsDir,
  platform,
  arch,
} = {}) {
  return path.join(releaseAssetsDir, 'desktop', platform, arch, RELEASE_ASSET_MANIFEST_FILE_NAME);
}

function resolveReportPath({
  releaseAssetsDir,
  platform,
  arch,
} = {}) {
  return path.join(releaseAssetsDir, 'desktop', platform, arch, DESKTOP_INSTALLER_TRUST_REPORT_FILENAME);
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing desktop release asset manifest: ${manifestPath}`);
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function normalizeInstallerArtifact({
  artifact,
  manifestPath,
} = {}) {
  const relativePath = assertSafeRelativePath(artifact?.relativePath);
  const kind = String(artifact?.kind ?? '').trim();
  const bundle = String(artifact?.bundle ?? '').trim();
  const installerFormat = String(artifact?.installerFormat ?? '').trim();
  const target = String(artifact?.target ?? '').trim();
  if (kind !== 'installer') {
    return null;
  }
  if (!bundle || !installerFormat || !target) {
    throw new Error(
      `Desktop installer manifest artifact must declare kind=installer, bundle, installerFormat, and target: ${relativePath} in ${manifestPath}.`,
    );
  }
  const signatureEvidence = assertDesktopInstallerSignatureEvidence({
    artifact,
    manifestPath,
    relativePath,
  });

  return {
    ...artifact,
    relativePath,
    kind,
    bundle,
    installerFormat,
    target,
    signatureEvidence,
  };
}

export function verifyDesktopInstallerTrust({
  releaseAssetsDir = path.join(process.cwd(), 'artifacts', 'release'),
  platform = process.platform,
  arch = process.arch,
  target = '',
  verifiedAt = new Date().toISOString(),
  verifierFn = verifyDesktopInstallerArtifactSignature,
} = {}) {
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedArch = normalizeArch(arch);
  const manifestPath = resolveManifestPath({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    platform: normalizedPlatform,
    arch: normalizedArch,
  });
  const manifest = readManifest(manifestPath);

  if (manifest.family !== 'desktop') {
    throw new Error(`Desktop manifest family mismatch at ${manifestPath}.`);
  }
  if (String(manifest.platform ?? '').trim() !== normalizedPlatform) {
    throw new Error(`Desktop manifest platform mismatch at ${manifestPath}.`);
  }
  if (String(manifest.arch ?? '').trim() !== normalizedArch) {
    throw new Error(`Desktop manifest architecture mismatch at ${manifestPath}.`);
  }

  const installerArtifacts = (manifest.artifacts ?? [])
    .map((artifact) => normalizeInstallerArtifact({ artifact, manifestPath }))
    .filter(Boolean)
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  if (installerArtifacts.length === 0) {
    throw new Error(`Desktop manifest must include native installer artifacts before trust verification: ${manifestPath}.`);
  }

  const artifactEvidence = new Map();
  const reportInstallers = [];
  for (const artifact of installerArtifacts) {
    if (String(target ?? '').trim() && artifact.target !== String(target).trim()) {
      throw new Error(
        `Desktop installer manifest artifact target mismatch in ${manifestPath}: ${artifact.relativePath} declares ${artifact.target}, expected ${target}.`,
      );
    }
    const artifactPath = path.join(normalizedReleaseAssetsDir, artifact.relativePath);
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Missing native desktop installer artifact referenced by ${manifestPath}: ${artifact.relativePath}`);
    }
    if (!fs.statSync(artifactPath).isFile()) {
      throw new Error(`Native desktop installer artifact referenced by ${manifestPath} must be a file: ${artifact.relativePath}`);
    }

    const expectedScheme = resolveDesktopInstallerSignatureScheme({
      platform: normalizedPlatform,
      bundle: artifact.bundle,
    });
    const signatureEvidence = normalizeDesktopInstallerSignatureEvidence(verifierFn({
      artifact: {
        ...artifact,
        platform: normalizedPlatform,
      },
      artifactPath,
      expectedScheme,
      verifiedAt,
    }));
    if (
      !signatureEvidence
      || signatureEvidence.status !== 'passed'
      || signatureEvidence.required !== true
      || signatureEvidence.scheme !== expectedScheme
    ) {
      throw new Error(
        `Desktop installer trust verifier did not produce passed ${expectedScheme} evidence for ${artifact.relativePath}.`,
      );
    }
    const evidenceSignals = collectDesktopInstallerTrustSignals({
      artifacts: [
        {
          ...artifact,
          signatureEvidence,
        },
      ],
    });
    if (evidenceSignals.length > 0) {
      throw new Error(evidenceSignals.join('; '));
    }

    artifactEvidence.set(artifact.relativePath, signatureEvidence);
    reportInstallers.push({
      relativePath: artifact.relativePath,
      bundle: artifact.bundle,
      installerFormat: artifact.installerFormat,
      target: artifact.target,
      signatureEvidence,
    });
  }

  const nextManifest = {
    ...manifest,
    artifacts: (manifest.artifacts ?? []).map((artifact) => {
      const relativePath = normalizeRelativePath(artifact?.relativePath);
      if (!artifactEvidence.has(relativePath)) {
        return artifact;
      }

      return {
        ...artifact,
        signatureEvidence: artifactEvidence.get(relativePath),
      };
    }),
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');

  const reportPath = resolveReportPath({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    platform: normalizedPlatform,
    arch: normalizedArch,
  });
  const report = {
    status: 'passed',
    platform: normalizedPlatform,
    arch: normalizedArch,
    target: String(target ?? '').trim(),
    manifestPath: path.resolve(manifestPath),
    verifiedAt: String(verifiedAt ?? '').trim(),
    installerCount: reportInstallers.length,
    installers: reportInstallers,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return {
    status: 'passed',
    releaseAssetsDir: normalizedReleaseAssetsDir,
    platform: normalizedPlatform,
    arch: normalizedArch,
    target: String(target ?? '').trim(),
    manifestPath,
    reportPath,
    installerCount: reportInstallers.length,
  };
}

export function parseArgs(argv) {
  const options = {
    releaseAssetsDir: path.resolve('artifacts', 'release'),
    platform: process.platform,
    arch: process.arch,
    target: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(readOptionValue(argv, index, token));
      index += 1;
      continue;
    }
    if (token === '--platform') {
      options.platform = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--arch') {
      options.arch = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--target') {
      options.target = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported option: ${token}`);
  }

  return {
    releaseAssetsDir: options.releaseAssetsDir,
    platform: normalizePlatform(options.platform),
    arch: normalizeArch(options.arch),
    target: options.target,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = verifyDesktopInstallerTrust(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
