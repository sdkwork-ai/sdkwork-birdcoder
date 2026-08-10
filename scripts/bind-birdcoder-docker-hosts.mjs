#!/usr/bin/env node
/**
 * Bind the sdkwork-birdcoder docker test domains in the Windows hosts file.
 *
 * The three docker test domains resolve to 127.0.0.1 so the Windows browser
 * reaches the WSL nginx through the WSL2 localhost forwarding:
 *
 *   testapidocker.sdkwork.com
 *   testapidocker.birdcoder.com
 *   testapidocker.dtupay.com
 *
 * Writing C:\Windows\System32\drivers\etc\hosts requires administrator
 * rights. This script attempts an elevated write through PowerShell
 * (UAC prompt) and falls back to printing the exact commands when elevation
 * is not available.
 *
 * Public script: `pnpm workflow:hosts:bind`.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { TEST_DOMAINS, renderWindowsHostsEntries } from './configure-birdcoder-nginx.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const HOSTS_FILE = [
  process.env.SystemRoot ?? 'C:/Windows',
  'System32',
  'drivers',
  'etc',
  'hosts',
].join('/');
const MARKER_BEGIN = '# === SDKWORK BIRDCODER DOCKER TEST DOMAINS BEGIN ===';
const MARKER_END = '# === SDKWORK BIRDCODER DOCKER TEST DOMAINS END ===';

function printHelp() {
  console.log(`Usage: node scripts/bind-birdcoder-docker-hosts.mjs [options]

Bind the BirdCoder docker test domains in the Windows hosts file (admin).

Options:
  --check     Print the current binding state without writing.
  --write     Write the hosts entries (elevated UAC when required).
  -h, --help  Show this help.

Windows hosts entries (${TEST_DOMAINS.join(', ')}):
  ${renderWindowsHostsEntries(TEST_DOMAINS)}
`);
}

function parseArgs(argv = process.argv.slice(2)) {
  const settings = { check: false, write: false, help: false };
  for (const arg of argv) {
    switch (arg) {
      case '--check':
        settings.check = true;
        break;
      case '--write':
        settings.write = true;
        break;
      case '-h':
      case '--help':
        settings.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return settings;
}

function currentBlock(hostsContent) {
  const begin = hostsContent.indexOf(MARKER_BEGIN);
  const end = hostsContent.indexOf(MARKER_END);
  if (begin === -1 || end === -1 || end <= begin) {
    return null;
  }
  return hostsContent.slice(begin, end + MARKER_END.length);
}

function renderBlock() {
  return [
    MARKER_BEGIN,
    renderWindowsHostsEntries(TEST_DOMAINS),
    MARKER_END,
  ].join('\n');
}

function readHosts() {
  try {
    return readFileSync(HOSTS_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return null;
    }
    throw error;
  }
}

function writeHostsElevated(block) {
  // Try a direct write first (already elevated shells).
  try {
    const content = readFileSync(HOSTS_FILE, 'utf8');
    const withoutBlock = content
      .split(/\r?\n/u)
      .filter((line) => line !== MARKER_BEGIN && line !== MARKER_END)
      .join('\n')
      .replace(/\n{3,}/gu, '\n\n');
    writeFileSync(HOSTS_FILE, `${withoutBlock.replace(/\s+$/u, '')}\n\n${block}\n`, 'utf8');
    return { method: 'direct' };
  } catch (error) {
    if (error.code !== 'EACCES' && error.code !== 'EPERM') {
      throw error;
    }
  }
  // Fall back to an elevated PowerShell script (UAC prompt).
  const scriptPath = path.join(os.tmpdir(), `bind-birdcoder-hosts-${process.pid}.ps1`);
  const ps1 = [
    '$ErrorActionPreference = "Stop"',
    `$hosts = '${HOSTS_FILE.replaceAll("'", "''")}'`,
    `$markerBegin = '${MARKER_BEGIN.replaceAll("'", "''")}'`,
    `$markerEnd = '${MARKER_END.replaceAll("'", "''")}'`,
    `$block = @'`,
    block,
    `'@`,
    `$content = Get-Content -Raw -LiteralPath $hosts`,
    `$lines = $content -split "\\r?\\n" | Where-Object { $_ -ne $markerBegin -and $_ -ne $markerEnd }`,
    `$newline = [string][char]10`,
    `$updated = ($lines -join $newline).TrimEnd() + $newline + $newline + $block + $newline`,
    `Set-Content -LiteralPath $hosts -Value $updated -Encoding ASCII`,
  ].join('\n');
  writeFileSync(scriptPath, ps1, 'utf8');
  try {
    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
        `Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${scriptPath}'`],
      { encoding: 'utf8', timeout: 120_000 },
    );
    if (result.error || result.status !== 0) {
      throw new Error(
        `elevated hosts write failed: ${result.stderr?.trim() ?? result.error?.message ?? 'UAC cancelled'}`,
      );
    }
    return { method: 'elevated' };
  } finally {
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-Command', `Remove-Item -LiteralPath '${scriptPath}' -Force`], { stdio: 'ignore' });
    } catch {
      // temp script cleanup is best-effort
    }
  }
}

function main(argv = process.argv.slice(2)) {
  const settings = parseArgs(argv);
  if (settings.help) {
    printHelp();
    return 0;
  }

  const hostsContent = readHosts();
  const block = renderBlock();

  if (settings.check || !settings.write) {
    if (hostsContent === null) {
      console.log(`[birdcoder-hosts] cannot read ${HOSTS_FILE} without elevation`);
    } else {
      const existing = currentBlock(hostsContent);
      // A domain counts as bound when some hosts line maps 127.0.0.1 to it
      // (multiple domains may share one line, so the check is line-scoped).
      const domainsBound = TEST_DOMAINS.every((domain) => hostsContent
        .split(/\r?\n/u)
        .some((line) => /^\s*127\.0\.0\.1[\s\t]/u.test(line)
          && line.split(/\s+/u).includes(domain)));
      console.log(`[birdcoder-hosts] hosts file: ${HOSTS_FILE}`);
      console.log(`[birdcoder-hosts] managed block: ${existing ? 'present' : 'absent'}`);
      console.log(`[birdcoder-hosts] domains bound: ${domainsBound ? 'yes' : 'no'}`);
    }
    console.log(`[birdcoder-hosts] required entries (admin):`);
    console.log(`[birdcoder-hosts]   ${renderWindowsHostsEntries(TEST_DOMAINS)}`);
    return 0;
  }

  const result = writeHostsElevated(block);
  console.log(`[birdcoder-hosts] bound via ${result.method} write: ${TEST_DOMAINS.join(', ')} -> 127.0.0.1`);
  console.log('[birdcoder-hosts] flush DNS cache: ipconfig /flushdns');
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  process.exitCode = main();
}

export { main, renderBlock };
