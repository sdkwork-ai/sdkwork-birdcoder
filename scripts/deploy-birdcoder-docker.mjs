#!/usr/bin/env node
/**
 * sdkwork-birdcoder standalone docker quick deployment (WSL Ubuntu).
 *
 * One-command deployment to the WSL Ubuntu docker host:
 *   1. build (or reuse) the birdcoder:local image
 *   2. prepare deployments/docker/.env from the template
 *   3. docker compose up -d (postgres + birdcoder gateway)
 *   4. wait for the gateway /readyz probe
 *   5. extract the portal SPA dist from the image for the host nginx
 *   6. take over the three docker test domains: disable the stale
 *      testapidocker-im.conf and install testapidocker-birdcoder.conf
 *   7. nginx -t + reload
 *
 * The script runs on Windows and shells out to the WSL distro (root access
 * through `wsl -u root`, which needs no password). Select the distro with
 * --wsl-distro (default Ubuntu-22.04).
 *
 * Public scripts: `pnpm deploy:plan:standalone`, `pnpm deploy:apply:standalone`,
 * `pnpm deploy:validate:standalone`, `pnpm deploy:rollback:standalone`.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  TEST_DOMAINS,
  createNginxDeploymentPlan,
  renderNginxConfig,
  renderWindowsHostsEntries,
} from './configure-birdcoder-nginx.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const DEFAULT_WSL_DISTRO = 'Ubuntu-22.04';
const IMAGE_TAG = 'birdcoder:local';
const GATEWAY_HOST_PORT = 10243;
const SPA_ROOT = '/opt/sdkwork/birdcoder/portal';
const NGINX_SITE_NAME = 'testapidocker-birdcoder.conf';
const NGINX_SITES_ENABLED = '/etc/nginx/sites-enabled';
const NGINX_SITES_AVAILABLE = '/etc/nginx/sites-available';
// Canonical site family directory (matches scripts/configure-birdcoder-nginx.mjs).
const NGINX_SITE_FAMILY = 'sdkwork';
const IM_CONF = path.posix.join(NGINX_SITES_ENABLED, 'testapidocker-im.conf');
const KNOWLEDGEBASE_CONF = path.posix.join(
  NGINX_SITES_ENABLED,
  NGINX_SITE_FAMILY,
  'testapidocker-knowledgebase.conf',
);
const COMPOSE_FILE = "deployments/docker/docker-compose.yml";

function printHelp() {
  console.log(`Usage: node scripts/deploy-birdcoder-docker.mjs <plan|apply|validate|rollback> [options]

Deploy the sdkwork-birdcoder standalone docker stack on WSL Ubuntu.

Commands:
  plan       Print the deployment plan (prerequisites, ports, domains).
  apply      Build the image and bring the stack up (default).
  validate   Check stack health: containers, /readyz, nginx config.
  rollback   Stop the stack and restore the previous nginx config.

Options:
  --wsl-distro <name>   WSL distro (default ${DEFAULT_WSL_DISTRO}).
  --skip-build          Reuse the existing birdcoder:local image.
  --force               Rebuild the image even when inputs are unchanged.
  --nginx-only          Only install/reload the nginx config.
  --json                Print machine-readable output.
  -h, --help            Show this help.
`);
}

function parseArgs(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!['plan', 'apply', 'validate', 'rollback'].includes(command)) {
    throw new Error(`Unknown command: ${command}. Expected plan|apply|validate|rollback.`);
  }
  const settings = {
    command,
    json: false,
    help: false,
    wslDistro: DEFAULT_WSL_DISTRO,
    skipBuild: false,
    force: false,
    nginxOnly: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--json':
        settings.json = true;
        break;
      case '-h':
      case '--help':
        settings.help = true;
        break;
      case '--wsl-distro':
        settings.wslDistro = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--skip-build':
        settings.skipBuild = true;
        break;
      case '--force':
        settings.force = true;
        break;
      case '--nginx-only':
        settings.nginxOnly = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return settings;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

/** Runs a command inside the WSL distro, optionally as root. */
function wsl(settings, args, { root = false, env = {}, stdio = 'pipe' } = {}) {
  const wslArgs = ['-d', settings.wslDistro];
  if (root) {
    wslArgs.push('-u', 'root');
  }
  // Shell operator tokens must stay unquoted; every other argument that
  // carries whitespace or shell metacharacters is single-quoted so the joined
  // command line survives the wsl.exe -> bash boundary intact.
  const shellOperators = new Set(['>', '<', '>>', '2>&1', '&&', '||', ';', '|', '&']);
  const quoted = args.map((arg) => {
    if (shellOperators.has(arg) || /^[A-Za-z0-9_@%+=:,./-]+$/u.test(arg)) {
      return arg;
    }
    return `'${String(arg).replaceAll("'", `'\\''`)}'`;
  });
  wslArgs.push('--', 'bash', '-lc', quoted.join(' '));
  const result = spawnSync('wsl.exe', wslArgs, {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function wslOut(settings, args, options = {}) {
  const result = wsl(settings, args, options);
  if (result.status !== 0) {
    throw new Error(`wsl command failed (${result.status}): ${result.stderr?.trim() ?? ''}`);
  }
  return result.stdout.trim();
}

function planDeployment(settings) {
  const nginxPlan = createNginxDeploymentPlan(
    { domains: TEST_DOMAINS.join(',') },
    { platform: 'linux' },
  );
  return {
    wslDistro: settings.wslDistro,
    imageTag: IMAGE_TAG,
    gatewayHostPort: GATEWAY_HOST_PORT,
    composeFile: COMPOSE_FILE,
    hostsEntries: renderWindowsHostsEntries(nginxPlan.domains),
    ...nginxPlan,
  };
}

function printPlan(plan) {
  return [
    '[birdcoder-deploy] Deployment Plan',
    `[birdcoder-deploy]   WSL distro: ${plan.wslDistro}`,
    `[birdcoder-deploy]   image: ${plan.imageTag}`,
    `[birdcoder-deploy]   compose: ${plan.composeFile}`,
    `[birdcoder-deploy]   gateway host port: ${plan.gatewayHostPort} -> 10240`,
    `[birdcoder-deploy]   domains: ${plan.domains.join(', ')}`,
    `[birdcoder-deploy]   nginx config: ${plan.nginxConfigPath}`,
    `[birdcoder-deploy]   spa root: ${plan.spaRoot}`,
    `[birdcoder-deploy]   Windows hosts:`,
    `[birdcoder-deploy]     ${plan.hostsEntries}`,
  ];
}

function ensureEnvFile() {
  const envTemplate = path.join(workspaceRoot, 'deployments', 'docker', 'docker', '.env.example');
  const envFile = path.join(workspaceRoot, 'deployments', 'docker', '.env');
  if (!existsSync(envFile)) {
    writeFileSync(envFile, readFileSync(envTemplate, 'utf8'), 'utf8');
    console.log('[birdcoder-deploy] created deployments/docker/.env from template');
  }
  return envFile;
}

async function buildImage(settings, plan) {
  if (settings.skipBuild) {
    const exists = wslOut(settings, ['docker', 'image', 'inspect', plan.imageTag, '>', '/dev/null', '2>&1', '&&', 'echo', 'yes', '||', 'echo', 'no']);
    if (exists !== 'yes') {
      throw new Error(`image ${plan.imageTag} does not exist; run without --skip-build`);
    }
    console.log(`[birdcoder-deploy] reusing image ${plan.imageTag}`);
    return;
  }
  const args = ['node', 'scripts/build-birdcoder-container.mjs'];
  if (settings.force) {
    args.push('--force');
  }
  wsl(settings, args, { stdio: 'inherit' });
  console.log(`[birdcoder-deploy] image built: ${plan.imageTag}`);
}

function composeUp(settings, plan) {
  // WSL paths must use forward slashes (path.join on Windows yields backslashes).
  const projectDir = `/mnt/e/sdkwork-space/${path.basename(workspaceRoot)}`;
  const composeFile = COMPOSE_FILE.replaceAll('\\', '/');
  const args = [
    'cd', projectDir, '&&',
    'docker', 'compose', '-f', composeFile, 'up', '-d',
  ];
  wsl(settings, args, { root: true, stdio: 'inherit' });
}

function waitForReady(settings, plan, timeoutSeconds = 300) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  const args = [
    'curl', '-fsS', '-m', '5', `http://127.0.0.1:${plan.gatewayHostPort}/readyz`, '>', '/dev/null', '2>&1',
  ];
  while (Date.now() < deadline) {
    const result = wsl(settings, args, { root: true });
    if (result.status === 0) {
      console.log(`[birdcoder-deploy] gateway ready at http://127.0.0.1:${plan.gatewayHostPort}/readyz`);
      return;
    }
    process.stdout.write('.');
    execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 5'], { stdio: 'ignore' });
  }
  throw new Error(`gateway did not become ready within ${timeoutSeconds}s; check 'docker compose -f ${COMPOSE_FILE} logs'`);
}

function extractPortalDist(settings, plan) {
  // Every step runs with explicit arguments (no shell variables or command
  // substitution: wsl.exe splits/re-parses the command line itself, so
  // `$(...)`/`$var` are unreliable across the Git Bash -> wsl boundary).
  const containerId = wslOut(settings, ['docker', 'create', plan.imageTag], { root: true });
  try {
    wslOut(settings, ['rm', '-rf', plan.spaRoot], { root: true });
    wslOut(settings, ['mkdir', '-p', plan.spaRoot], { root: true });
    wslOut(settings, [
      'docker', 'cp', `${containerId}:/opt/sdkwork/birdcoder/portal/dist/.`, `${plan.spaRoot}/`,
    ], { root: true });
    wslOut(settings, ['chmod', '-R', 'a+rX', plan.spaRoot], { root: true });
  } finally {
    wsl(settings, ['docker', 'rm', '-f', containerId], { root: true });
  }
  console.log(`[birdcoder-deploy] portal SPA extracted to ${plan.spaRoot}`);
}

/** Writes a bash script to the shared drive and returns its /mnt path. */
function writeWslScript(name, content) {
  const localPath = path.join(workspaceRoot, 'target', 'wsl', name);
  mkdirSync(path.dirname(localPath), { recursive: true });
  writeFileSync(localPath, content, 'utf8');
  return `/mnt/e/sdkwork-space/${path.basename(workspaceRoot)}/target/wsl/${name}`;
}

function installNginxConfig(settings, plan) {
  // Render to a staging path on the shared drive, then install via a script
  // file (inline multi-statement scripts are unreliable across wsl.exe).
  const localStaging = path.join(workspaceRoot, 'target', 'nginx', 'sites-enabled', 'sdkwork', NGINX_SITE_NAME);
  mkdirSync(path.dirname(localStaging), { recursive: true });
  writeFileSync(localStaging, renderNginxConfig(plan), 'utf8');
  const remoteStaging = `/mnt/e/sdkwork-space/${path.basename(workspaceRoot)}/target/nginx/sites-enabled/sdkwork/${NGINX_SITE_NAME}`;
  const script = [
    '#!/bin/bash',
    'set -e',
    // Disable stale claims on the three docker test domains (the established
    // .orig pattern for displaced test-domain configs).
    `if [ -f ${IM_CONF} ]; then mv ${IM_CONF} ${IM_CONF}.orig; echo 'disabled stale testapidocker-im.conf'; fi`,
    `if [ -f ${KNOWLEDGEBASE_CONF} ]; then mv ${KNOWLEDGEBASE_CONF} ${KNOWLEDGEBASE_CONF}.orig; echo 'disabled stale testapidocker-knowledgebase.conf'; fi`,
    `cp '${remoteStaging}' ${NGINX_SITES_AVAILABLE}/${NGINX_SITE_NAME}`,
    `mkdir -p ${NGINX_SITES_ENABLED}/${NGINX_SITE_FAMILY}`,
    `ln -sf ${NGINX_SITES_AVAILABLE}/${NGINX_SITE_NAME} ${NGINX_SITES_ENABLED}/${NGINX_SITE_FAMILY}/${NGINX_SITE_NAME}`,
    `rm -f ${NGINX_SITES_ENABLED}/${NGINX_SITE_NAME}`,
    'nginx -t',
    'systemctl reload nginx',
    "echo 'nginx config installed and reloaded'",
  ].join('\n');
  const scriptPath = writeWslScript('install-nginx.sh', script);
  const out = wslOut(settings, ['bash', scriptPath], { root: true });
  console.log(`[birdcoder-deploy] ${out}`);
}

function validateStack(settings, plan) {
  const checks = [];
  const containerStatus = wslOut(settings, [
    'docker', 'compose', '-f', COMPOSE_FILE, 'ps', '--format', '{{.Name}} {{.Status}}',
  ], { root: true });
  checks.push({ name: 'compose ps', ok: containerStatus.includes('birdcoder') });
  console.log(containerStatus);

  const ready = wsl(settings, [
    'curl', '-fsS', '-m', '5', `http://127.0.0.1:${plan.gatewayHostPort}/readyz`, '>', '/dev/null', '2>&1', '&&', 'echo', 'yes', '||', 'echo', 'no',
  ], { root: true });
  const readyOk = ready.stdout.trim() === 'yes';
  checks.push({ name: '/readyz', ok: readyOk });

  const nginxTest = wsl(settings, ['nginx', '-t'], { root: true });
  checks.push({ name: 'nginx -t', ok: nginxTest.status === 0 });

  for (const domain of plan.domains) {
    const response = wsl(settings, [
      'curl', '-fsS', '-m', '5', 'http://127.0.0.1/', '-H', `Host: ${domain}`, '-o', '/dev/null', '-w', '%{http_code}',
    ], { root: true });
    const code = response.stdout.trim();
    const ok = code === '200' || code === '301' || code === '302';
    checks.push({ name: `http://${domain}`, ok, detail: `HTTP ${code}` });
    console.log(`[birdcoder-deploy] ${domain} -> HTTP ${code}`);
  }

  for (const check of checks) {
    console.log(`[birdcoder-deploy] check ${check.name}: ${check.ok ? 'PASS' : 'FAIL'}${check.detail ? ` (${check.detail})` : ''}`);
  }
  return checks;
}

function rollback(settings, plan) {
  wsl(settings, [
    'docker', 'compose', '-f', COMPOSE_FILE, 'down',
  ], { root: true, stdio: 'inherit' });
  const script = [
    '#!/bin/bash',
    'set -e',
    `if [ -f ${IM_CONF}.orig ]; then mv ${IM_CONF}.orig ${IM_CONF}; echo 'restored testapidocker-im.conf'; fi`,
    `if [ -f ${KNOWLEDGEBASE_CONF}.orig ]; then mv ${KNOWLEDGEBASE_CONF}.orig ${KNOWLEDGEBASE_CONF}; echo 'restored testapidocker-knowledgebase.conf'; fi`,
    `rm -f ${NGINX_SITES_ENABLED}/${NGINX_SITE_FAMILY}/${NGINX_SITE_NAME} ${NGINX_SITES_AVAILABLE}/${NGINX_SITE_NAME}`,
    "nginx -t && systemctl reload nginx && echo 'nginx restored'",
  ].join('\n');
  const scriptPath = writeWslScript('rollback-nginx.sh', script);
  const out = wslOut(settings, ['bash', scriptPath], { root: true });
  console.log(`[birdcoder-deploy] ${out}`);
}

async function main(argv = process.argv.slice(2)) {
  const settings = parseArgs(argv);
  if (settings.help) {
    printHelp();
    return 0;
  }
  const plan = planDeployment(settings);
  for (const line of printPlan(plan)) {
    console.log(line);
  }
  if (settings.json) {
    console.log(JSON.stringify({ ok: true, plan }, null, 2));
  }
  if (settings.command === 'plan') {
    return 0;
  }
  if (settings.command === 'validate') {
    const checks = validateStack(settings, plan);
    const ok = checks.every((check) => check.ok);
    console.log(`[birdcoder-deploy] validation ${ok ? 'PASS' : 'FAIL'}`);
    return ok ? 0 : 1;
  }
  if (settings.command === 'rollback') {
    rollback(settings, plan);
    return 0;
  }

  // apply
  if (!settings.nginxOnly) {
    ensureEnvFile();
    await buildImage(settings, plan);
    composeUp(settings, plan);
    waitForReady(settings, plan);
    extractPortalDist(settings, plan);
  }
  installNginxConfig(settings, plan);
  console.log('[birdcoder-deploy] deployment complete; verify:');
  console.log('[birdcoder-deploy]   pnpm deploy:validate:standalone');
  console.log(`[birdcoder-deploy]   hosts: ${plan.hostsEntries}`);
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  main().catch((error) => {
    console.error(`[birdcoder-deploy] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

export { main, parseArgs, planDeployment };
