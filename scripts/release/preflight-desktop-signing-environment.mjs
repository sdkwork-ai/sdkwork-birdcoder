#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_PLATFORM_BUNDLES = Object.freeze({
  linux: Object.freeze(['appimage', 'deb', 'rpm']),
  macos: Object.freeze(['app', 'dmg']),
  windows: Object.freeze(['msi', 'nsis']),
});

const APPLE_ID_NOTARIZATION_ENV_NAMES = Object.freeze([
  'APPLE_ID',
  'APPLE_TEAM_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
]);

const APP_STORE_CONNECT_API_KEY_ENV_NAMES = Object.freeze([
  'APP_STORE_CONNECT_API_KEY_ID',
  'APP_STORE_CONNECT_API_ISSUER_ID',
  'APP_STORE_CONNECT_API_KEY',
]);

const SECRET_ENV_NAME_PATTERNS = Object.freeze([
  /PASSWORD/i,
  /PRIVATE.*KEY/i,
  /SECRET/i,
  /TOKEN/i,
  /APP_STORE_CONNECT_API_KEY$/i,
]);

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

function normalizeBundles(bundles, platform) {
  const normalizedBundles = (Array.isArray(bundles) ? bundles : String(bundles ?? '').split(','))
    .map((entry) => String(entry ?? '').trim().toLowerCase())
    .filter(Boolean);
  const selectedBundles = normalizedBundles.length > 0
    ? normalizedBundles
    : [...(DEFAULT_PLATFORM_BUNDLES[platform] ?? [])];

  return Array.from(new Set(selectedBundles)).sort((left, right) => left.localeCompare(right));
}

function hasEnvValue(env, name) {
  return String(env?.[name] ?? '').trim().length > 0;
}

function collectSensitiveEnvValues(env) {
  return Object.entries(env ?? {})
    .filter(([name, value]) => SECRET_ENV_NAME_PATTERNS.some((pattern) => pattern.test(name)) && String(value ?? '').trim())
    .map(([, value]) => String(value))
    .filter((value) => value.length >= 4)
    .sort((left, right) => right.length - left.length);
}

function redactSensitiveValues(value, sensitiveValues = []) {
  let redactedValue = String(value ?? '');
  for (const sensitiveValue of sensitiveValues) {
    redactedValue = redactedValue.split(sensitiveValue).join('<redacted>');
  }

  return redactedValue;
}

function resolveEnvCredentialSet(env, credentialSets) {
  return credentialSets.find((entry) => entry.every((name) => hasEnvValue(env, name))) ?? null;
}

function assertRequiredEnv({
  env,
  names,
  id,
  label,
  failures,
}) {
  const missing = names.filter((name) => !hasEnvValue(env, name));
  if (missing.length > 0) {
    failures.push(`${label} is missing required environment variables: ${missing.join(', ')}.`);
    return null;
  }

  return {
    id,
    label,
    status: 'passed',
    required: true,
    envNames: [...names],
  };
}

function assertHttpUrl({
  env,
  name,
  label,
  failures,
}) {
  const value = String(env?.[name] ?? '').trim();
  if (!value) {
    failures.push(`${label} is missing required environment variable: ${name}.`);
    return;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      failures.push(`${label} must be an http or https URL declared by ${name}.`);
    }
  } catch {
    failures.push(`${label} must be a valid URL declared by ${name}.`);
  }
}

function summarizeCommandFailure(command, args, result, sensitiveValues = []) {
  const detail = [
    result?.stderr,
    result?.stdout,
    result?.error instanceof Error ? result.error.message : '',
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join('\n');
  const invocation = [command, ...(args ?? [])].join(' ');

  const summary = detail
    ? `${invocation} failed: ${detail}`
    : `${invocation} failed with exit code ${result?.status ?? 1}.`;

  return redactSensitiveValues(summary, sensitiveValues);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  return {
    status: typeof result.status === 'number' ? result.status : result.error ? 1 : 0,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
    error: result.error,
  };
}

function assertCommand({
  id,
  label,
  command,
  args,
  env,
  commandRunner,
  failures,
  requiredCapabilities = [],
  sensitiveValues = [],
}) {
  let result;
  try {
    result = commandRunner(command, args, { env });
  } catch (error) {
    failures.push(`${label} is unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }

  if ((result?.status ?? 0) !== 0 || result?.error) {
    failures.push(`${label} is unavailable: ${summarizeCommandFailure(command, args, result, sensitiveValues)}.`);
    return null;
  }

  const check = {
    id,
    label,
    status: 'passed',
    required: true,
    command,
    args: [...args],
    requiredCapabilities: [...requiredCapabilities],
  };
  Object.defineProperty(check, 'stdout', {
    value: String(result?.stdout ?? ''),
    enumerable: false,
  });
  Object.defineProperty(check, 'stderr', {
    value: String(result?.stderr ?? ''),
    enumerable: false,
  });

  return check;
}

function buildPowerShellArgs(command) {
  return [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    command,
  ];
}

function assertSupportedBundles(platform, bundles) {
  const supportedBundles = new Set(DEFAULT_PLATFORM_BUNDLES[platform] ?? []);
  if (supportedBundles.size === 0) {
    throw new Error(`Unsupported desktop signing preflight platform: ${platform}.`);
  }

  for (const bundle of bundles) {
    if (!supportedBundles.has(bundle)) {
      throw new Error(`Unsupported ${platform} desktop bundle for signing preflight: ${bundle}.`);
    }
  }
}

function buildWindowsChecks({
  env,
  commandRunner,
  failures,
  sensitiveValues,
}) {
  const checks = [];
  const signtoolCheck = assertCommand({
    id: 'windows-signtool-available',
    label: 'Windows signtool',
    command: 'powershell.exe',
    args: buildPowerShellArgs('Get-Command signtool -ErrorAction Stop | Out-Null'),
    env,
    commandRunner,
    failures,
    requiredCapabilities: ['Windows SDK signtool'],
    sensitiveValues,
  });
  if (signtoolCheck) {
    checks.push(signtoolCheck);
  }

  const certificateCheck = assertRequiredEnv({
    env,
    names: ['BIRDCODER_WINDOWS_SIGNING_CERT_SHA1'],
    id: 'windows-code-signing-certificate',
    label: 'Windows code signing certificate',
    failures,
  });
  if (certificateCheck) {
    const certStoreCheck = assertCommand({
      id: 'windows-code-signing-certificate-store',
      label: 'Windows CurrentUser code signing certificate store',
      command: 'powershell.exe',
      args: buildPowerShellArgs([
        '$thumbprint = $env:BIRDCODER_WINDOWS_SIGNING_CERT_SHA1',
        '$normalizedThumbprint = $thumbprint -replace "\\s", ""',
        '$certificate = Get-ChildItem Cert:\\CurrentUser\\My -CodeSigningCert | Where-Object { ($_.Thumbprint -replace "\\s", "") -ieq $normalizedThumbprint } | Select-Object -First 1',
        'if (-not $certificate) { throw "No CurrentUser code signing certificate matches BIRDCODER_WINDOWS_SIGNING_CERT_SHA1." }',
      ].join('; ')),
      env,
      commandRunner,
      failures,
      requiredCapabilities: ['Windows CurrentUser code signing certificate'],
      sensitiveValues,
    });
    if (certStoreCheck) {
      checks.push({
        ...certificateCheck,
        command: certStoreCheck.command,
        args: certStoreCheck.args,
        requiredCapabilities: certStoreCheck.requiredCapabilities,
      });
    }
  }

  assertHttpUrl({
    env,
    name: 'BIRDCODER_WINDOWS_SIGNING_TIMESTAMP_URL',
    label: 'Windows Authenticode timestamp URL',
    failures,
  });
  if (hasEnvValue(env, 'BIRDCODER_WINDOWS_SIGNING_TIMESTAMP_URL')) {
    checks.push({
      id: 'windows-timestamp-url',
      label: 'Windows Authenticode timestamp URL',
      status: 'passed',
      required: true,
      envNames: ['BIRDCODER_WINDOWS_SIGNING_TIMESTAMP_URL'],
    });
  }

  return checks;
}

function buildMacosChecks({
  env,
  commandRunner,
  failures,
  sensitiveValues,
}) {
  const checks = [];
  for (const check of [
    {
      id: 'macos-codesign-toolchain',
      label: 'macOS codesign toolchain',
      command: 'xcrun',
      args: ['--find', 'codesign'],
      requiredCapabilities: ['Xcode command line codesign'],
    },
    {
      id: 'macos-gatekeeper-toolchain',
      label: 'macOS Gatekeeper assessment toolchain',
      command: 'spctl',
      args: ['--version'],
      requiredCapabilities: ['macOS Gatekeeper spctl'],
    },
    {
      id: 'macos-stapler-toolchain',
      label: 'macOS notarization stapler toolchain',
      command: 'xcrun',
      args: ['--find', 'stapler'],
      requiredCapabilities: ['Xcode stapler'],
    },
    {
      id: 'macos-notarytool-toolchain',
      label: 'macOS notarytool toolchain',
      command: 'xcrun',
      args: ['--find', 'notarytool'],
      requiredCapabilities: ['Xcode notarytool'],
    },
  ]) {
    const commandCheck = assertCommand({
      ...check,
      env,
      commandRunner,
      failures,
      sensitiveValues,
    });
    if (commandCheck) {
      checks.push(commandCheck);
    }
  }

  const identityCheck = assertRequiredEnv({
    env,
    names: ['BIRDCODER_MACOS_CODESIGN_IDENTITY'],
    id: 'macos-codesign-identity',
    label: 'macOS Developer ID code signing identity',
    failures,
  });
  if (identityCheck) {
    const identityName = String(env.BIRDCODER_MACOS_CODESIGN_IDENTITY ?? '').trim();
    const keychainCheck = assertCommand({
      id: 'macos-codesign-identity-keychain',
      label: 'macOS Developer ID code signing identity keychain lookup',
      command: 'security',
      args: ['find-identity', '-v', '-p', 'codesigning'],
      env,
      commandRunner,
      failures,
      requiredCapabilities: ['macOS codesigning keychain identity'],
      sensitiveValues,
    });
    if (keychainCheck) {
      const identityOutput = `${keychainCheck.stdout ?? ''}\n${keychainCheck.stderr ?? ''}`;
      if (!identityOutput.includes(identityName)) {
        failures.push(
          'macOS Developer ID code signing identity keychain lookup did not find BIRDCODER_MACOS_CODESIGN_IDENTITY.',
        );
      } else {
        checks.push({
          ...identityCheck,
          command: keychainCheck.command,
          args: keychainCheck.args,
          requiredCapabilities: keychainCheck.requiredCapabilities,
        });
      }
    }
  }

  const credentialSet = resolveEnvCredentialSet(env, [
    APPLE_ID_NOTARIZATION_ENV_NAMES,
    APP_STORE_CONNECT_API_KEY_ENV_NAMES,
  ]);
  if (!credentialSet) {
    failures.push(
      [
        'macOS notarization credentials are missing.',
        `Set either ${APPLE_ID_NOTARIZATION_ENV_NAMES.join(', ')} or ${APP_STORE_CONNECT_API_KEY_ENV_NAMES.join(', ')}.`,
      ].join(' '),
    );
  } else {
    checks.push({
      id: 'macos-notarization-credentials',
      label: 'macOS notarization credentials',
      status: 'passed',
      required: true,
      envNames: [...credentialSet],
    });
  }

  return checks;
}

function buildLinuxChecks({
  bundles,
  env,
  commandRunner,
  failures,
  sensitiveValues,
}) {
  const checks = [];
  const checkByBundle = {
    appimage: {
      id: 'linux-appimage-file-tool',
      label: 'Linux AppImage file metadata tool',
      command: 'file',
      args: ['--version'],
      requiredCapabilities: ['file metadata inspection'],
    },
    deb: {
      id: 'linux-deb-package-metadata-tool',
      label: 'Linux deb package metadata tool',
      command: 'dpkg-deb',
      args: ['--version'],
      requiredCapabilities: ['dpkg-deb package metadata inspection'],
    },
    rpm: {
      id: 'linux-rpm-package-metadata-tool',
      label: 'Linux rpm package metadata tool',
      command: 'rpm',
      args: ['--version'],
      requiredCapabilities: ['rpm package metadata inspection'],
    },
  };

  for (const bundle of bundles) {
    const commandCheck = assertCommand({
      ...checkByBundle[bundle],
      env,
      commandRunner,
      failures,
      sensitiveValues,
    });
    if (commandCheck) {
      checks.push(commandCheck);
    }
  }

  return checks;
}

function assertNoFailures(failures, sensitiveValues = []) {
  if (failures.length === 0) {
    return;
  }

  throw new Error(redactSensitiveValues([
    'Desktop signing environment preflight failed:',
    ...failures.map((failure) => `- ${failure}`),
  ].join('\n'), sensitiveValues));
}

export function preflightDesktopSigningEnvironment({
  platform = process.platform,
  arch = process.arch,
  target = '',
  bundles = [],
  checkedAt = new Date().toISOString(),
  env = process.env,
  commandRunner = runCommand,
} = {}) {
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedArch = normalizeArch(arch);
  const normalizedTarget = String(target ?? '').trim();
  const normalizedBundles = normalizeBundles(bundles, normalizedPlatform);

  if (!normalizedPlatform) {
    throw new Error('Desktop signing environment preflight requires a platform.');
  }
  if (!normalizedArch) {
    throw new Error('Desktop signing environment preflight requires an architecture.');
  }
  assertSupportedBundles(normalizedPlatform, normalizedBundles);

  const failures = [];
  const sensitiveValues = collectSensitiveEnvValues(env);
  const checks = normalizedPlatform === 'windows'
    ? buildWindowsChecks({ env, commandRunner, failures, sensitiveValues })
    : normalizedPlatform === 'macos'
      ? buildMacosChecks({ env, commandRunner, failures, sensitiveValues })
      : buildLinuxChecks({ bundles: normalizedBundles, env, commandRunner, failures, sensitiveValues });

  assertNoFailures(failures, sensitiveValues);

  return {
    status: 'passed',
    platform: normalizedPlatform,
    arch: normalizedArch,
    target: normalizedTarget,
    bundles: normalizedBundles,
    checkedAt: String(checkedAt ?? '').trim(),
    checks,
  };
}

export function parseArgs(argv) {
  const options = {
    platform: process.platform,
    arch: process.arch,
    target: '',
    bundles: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
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
    if (token === '--bundles') {
      options.bundles = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported option: ${token}`);
  }

  const platform = normalizePlatform(options.platform);
  return {
    platform,
    arch: normalizeArch(options.arch),
    target: String(options.target ?? '').trim(),
    bundles: normalizeBundles(options.bundles, platform),
  };
}

export async function runPreflightDesktopSigningEnvironmentCli(
  argv = process.argv.slice(2),
  {
    env = process.env,
    commandRunner = runCommand,
    stdout = (message) => process.stdout.write(message),
    stderr = (message) => process.stderr.write(message),
  } = {},
) {
  try {
    const report = preflightDesktopSigningEnvironment({
      ...parseArgs(argv),
      env,
      commandRunner,
    });
    stdout(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr(`${message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runPreflightDesktopSigningEnvironmentCli();
  process.exit(exitCode);
}
