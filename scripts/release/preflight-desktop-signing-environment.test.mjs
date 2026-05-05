import assert from 'node:assert/strict';
import path from 'node:path';

import {
  parseArgs,
  preflightDesktopSigningEnvironment,
  runPreflightDesktopSigningEnvironmentCli,
} from './preflight-desktop-signing-environment.mjs';

assert.throws(
  () => parseArgs(['--platform']),
  /Missing value for --platform/,
);
assert.deepEqual(
  parseArgs([
    '--platform',
    'win32',
    '--arch',
    'x64',
    '--target',
    'x86_64-pc-windows-msvc',
    '--bundles',
    'nsis,msi,nsis',
  ]),
  {
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
    bundles: ['msi', 'nsis'],
  },
);

{
  const commandCalls = [];
  const report = preflightDesktopSigningEnvironment({
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
    bundles: ['nsis', 'msi'],
    checkedAt: '2026-04-08T12:30:00.000Z',
    env: {
      BIRDCODER_WINDOWS_SIGNING_CERT_SHA1: 'AA BB CC DD',
      BIRDCODER_WINDOWS_SIGNING_TIMESTAMP_URL: 'https://timestamp.example.com',
    },
    commandRunner(command, args) {
      commandCalls.push([command, ...args]);
      return {
        status: 0,
        stdout: 'ok',
        stderr: '',
      };
    },
  });

  assert.equal(report.status, 'passed');
  assert.equal(report.platform, 'windows');
  assert.equal(report.arch, 'x64');
  assert.equal(report.target, 'x86_64-pc-windows-msvc');
  assert.deepEqual(report.bundles, ['msi', 'nsis']);
  assert.equal(report.checkedAt, '2026-04-08T12:30:00.000Z');
  assert.deepEqual(
    report.checks.map((check) => check.id),
    [
      'windows-signtool-available',
      'windows-code-signing-certificate',
      'windows-timestamp-url',
    ],
  );
  assert.equal(
    commandCalls.some((call) => call[0] === 'powershell.exe' && call.join(' ').includes('Get-Command signtool')),
    true,
  );
  assert.equal(
    commandCalls.some((call) => call[0] === 'powershell.exe' && call.join(' ').includes('Get-ChildItem Cert:\\CurrentUser\\My -CodeSigningCert')),
    true,
  );
}

{
  assert.throws(
    () => preflightDesktopSigningEnvironment({
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-msvc',
      bundles: ['msi'],
      env: {
        BIRDCODER_WINDOWS_SIGNING_CERT_SHA1: 'super-secret-thumbprint',
      },
      commandRunner() {
        return {
          status: 0,
          stdout: '',
          stderr: '',
        };
      },
    }),
    (error) => {
      assert.match(error.message, /BIRDCODER_WINDOWS_SIGNING_TIMESTAMP_URL/);
      assert.doesNotMatch(error.message, /super-secret-thumbprint/);
      return true;
    },
  );
}

{
  const commandCalls = [];
  const report = preflightDesktopSigningEnvironment({
    platform: 'macos',
    arch: 'arm64',
    target: 'aarch64-apple-darwin',
    bundles: ['dmg', 'app'],
    checkedAt: '2026-04-08T12:30:00.000Z',
    env: {
      BIRDCODER_MACOS_CODESIGN_IDENTITY: 'Developer ID Application: SDKWork BirdCoder',
      APPLE_ID: 'release@example.com',
      APPLE_TEAM_ID: 'TEAM123456',
      APPLE_APP_SPECIFIC_PASSWORD: 'not-printed',
    },
    commandRunner(command, args) {
      commandCalls.push([command, ...args]);
      if (command === 'security') {
        return {
          status: 0,
          stdout: '1) ABCDEF1234567890 "Developer ID Application: SDKWork BirdCoder"',
          stderr: '',
        };
      }
      return {
        status: 0,
        stdout: path.join('/Applications/Xcode.app/Contents/Developer/usr/bin', args.at(-1) ?? ''),
        stderr: '',
      };
    },
  });

  assert.equal(report.status, 'passed');
  assert.deepEqual(report.bundles, ['app', 'dmg']);
  assert.deepEqual(
    commandCalls,
    [
      ['xcrun', '--find', 'codesign'],
      ['spctl', '--version'],
      ['xcrun', '--find', 'stapler'],
      ['xcrun', '--find', 'notarytool'],
      ['security', 'find-identity', '-v', '-p', 'codesigning'],
    ],
  );
  assert.deepEqual(
    report.checks.map((check) => check.id),
    [
      'macos-codesign-toolchain',
      'macos-gatekeeper-toolchain',
      'macos-stapler-toolchain',
      'macos-notarytool-toolchain',
      'macos-codesign-identity',
      'macos-notarization-credentials',
    ],
  );
  assert.deepEqual(
    report.checks.find((check) => check.id === 'macos-notarization-credentials')?.envNames,
    ['APPLE_ID', 'APPLE_TEAM_ID', 'APPLE_APP_SPECIFIC_PASSWORD'],
  );
}

{
  const report = preflightDesktopSigningEnvironment({
    platform: 'darwin',
    arch: 'x64',
    target: 'x86_64-apple-darwin',
    bundles: ['dmg'],
    env: {
      BIRDCODER_MACOS_CODESIGN_IDENTITY: 'Developer ID Application: SDKWork BirdCoder',
      APP_STORE_CONNECT_API_KEY_ID: 'KEY1234567',
      APP_STORE_CONNECT_API_ISSUER_ID: 'issuer-id',
      APP_STORE_CONNECT_API_KEY: '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----',
    },
    commandRunner(command) {
      if (command === 'security') {
        return {
          status: 0,
          stdout: '1) ABCDEF1234567890 "Developer ID Application: SDKWork BirdCoder"',
          stderr: '',
        };
      }
      return {
        status: 0,
        stdout: '',
        stderr: '',
      };
    },
  });

  assert.equal(report.platform, 'macos');
  assert.deepEqual(
    report.checks.find((check) => check.id === 'macos-notarization-credentials')?.envNames,
    [
      'APP_STORE_CONNECT_API_KEY_ID',
      'APP_STORE_CONNECT_API_ISSUER_ID',
      'APP_STORE_CONNECT_API_KEY',
    ],
  );
}

{
  assert.throws(
    () => preflightDesktopSigningEnvironment({
      platform: 'macos',
      arch: 'x64',
      target: 'x86_64-apple-darwin',
      bundles: ['dmg'],
      env: {
        BIRDCODER_MACOS_CODESIGN_IDENTITY: 'Developer ID Application: SDKWork BirdCoder',
        APPLE_APP_SPECIFIC_PASSWORD: 'notary-secret-value',
      },
      commandRunner() {
        return {
          status: 0,
          stdout: '1) ABCDEF1234567890 "Developer ID Application: SDKWork BirdCoder"',
          stderr: '',
        };
      },
    }),
    (error) => {
      assert.match(error.message, /APPLE_ID/);
      assert.match(error.message, /APPLE_TEAM_ID/);
      assert.match(error.message, /APP_STORE_CONNECT_API_KEY_ID/);
      assert.doesNotMatch(error.message, /notary-secret-value/);
      return true;
    },
  );
}

{
  const commandCalls = [];
  const report = preflightDesktopSigningEnvironment({
    platform: 'linux',
    arch: 'arm64',
    target: 'aarch64-unknown-linux-gnu',
    bundles: ['deb', 'appimage'],
    checkedAt: '2026-04-08T12:30:00.000Z',
    env: {},
    commandRunner(command, args) {
      commandCalls.push([command, ...args]);
      return {
        status: 0,
        stdout: '',
        stderr: '',
      };
    },
  });

  assert.equal(report.status, 'passed');
  assert.deepEqual(report.bundles, ['appimage', 'deb']);
  assert.deepEqual(commandCalls, [
    ['file', '--version'],
    ['dpkg-deb', '--version'],
  ]);
  assert.deepEqual(
    report.checks.map((check) => check.id),
    [
      'linux-appimage-file-tool',
      'linux-deb-package-metadata-tool',
    ],
  );
}

{
  assert.throws(
    () => preflightDesktopSigningEnvironment({
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      bundles: ['flatpak'],
      env: {},
      commandRunner() {
        return {
          status: 0,
          stdout: '',
          stderr: '',
        };
      },
    }),
    /Unsupported linux desktop bundle for signing preflight: flatpak/,
  );
}

{
  const stderr = [];
  const stdout = [];
  const exitCode = await runPreflightDesktopSigningEnvironmentCli(
    [
      '--platform',
      'macos',
      '--arch',
      'arm64',
      '--target',
      'aarch64-apple-darwin',
      '--bundles',
      'dmg',
    ],
    {
      env: {
        BIRDCODER_MACOS_CODESIGN_IDENTITY: 'Developer ID Application: SDKWork BirdCoder',
        APPLE_APP_SPECIFIC_PASSWORD: 'cli-secret-value',
      },
      commandRunner() {
        return {
          status: 0,
          stdout: '',
          stderr: '',
        };
      },
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    },
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.match(stderr.join(''), /Desktop signing environment preflight failed/);
  assert.doesNotMatch(stderr.join(''), /cli-secret-value/);
}

{
  assert.throws(
    () => preflightDesktopSigningEnvironment({
      platform: 'macos',
      arch: 'arm64',
      target: 'aarch64-apple-darwin',
      bundles: ['dmg'],
      env: {
        BIRDCODER_MACOS_CODESIGN_IDENTITY: 'Developer ID Application: SDKWork BirdCoder',
        APPLE_ID: 'release@example.com',
        APPLE_TEAM_ID: 'TEAM123456',
        APPLE_APP_SPECIFIC_PASSWORD: 'command-output-secret',
      },
      commandRunner(command) {
        if (command === 'xcrun') {
          return {
            status: 1,
            stdout: 'failed with command-output-secret',
            stderr: '',
          };
        }

        return {
          status: 0,
          stdout: '1) ABCDEF1234567890 "Developer ID Application: SDKWork BirdCoder"',
          stderr: '',
        };
      },
    }),
    (error) => {
      assert.match(error.message, /<redacted>/);
      assert.doesNotMatch(error.message, /command-output-secret/);
      return true;
    },
  );
}

console.log('desktop signing environment preflight contract passed.');
