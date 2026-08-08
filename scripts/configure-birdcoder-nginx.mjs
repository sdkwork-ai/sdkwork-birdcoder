#!/usr/bin/env node
/**
 * Render or deploy the sdkwork-birdcoder docker test-domain nginx reverse
 * proxy config for the WSL Ubuntu host (mirrors
 * sdkwork-cloudrouter/scripts/configure-nginx.mjs).
 *
 * The config serves the portal SPA from /opt/sdkwork/birdcoder/portal and
 * proxies the canonical API prefixes to the gateway container host port
 * (127.0.0.1:10243). The three docker test domains share one server block:
 *
 *   testapidocker.sdkwork.com
 *   testapidocker.birdcoder.com
 *   testapidocker.dtupay.com
 *
 * Windows hosts binding (admin):
 *   127.0.0.1 testapidocker.sdkwork.com testapidocker.birdcoder.com testapidocker.dtupay.com
 *
 * Public scripts: `pnpm nginx:plan` / `pnpm nginx:render` / `pnpm nginx:deploy`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

export const TEST_DOMAINS = [
  'testapidocker.sdkwork.com',
  'testapidocker.birdcoder.com',
  'testapidocker.dtupay.com',
];
const DEFAULT_UPSTREAM = 'http://127.0.0.1:10243';
const DEFAULT_SPA_ROOT = '/opt/sdkwork/birdcoder/portal';
const DEFAULT_SERVER_ROOT = '/etc/nginx/sites-enabled';
const DEFAULT_SITE_FAMILY = 'sdkwork';
const DEFAULT_CLIENT_MAX_BODY_SIZE = '1100m';

// Canonical API prefixes proxied to the gateway (same list as the vite dev
// proxy in apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts).
const API_PREFIXES = [
  '/app',
  '/backend',
  '/api',
  '/readyz',
  '/healthz',
  '/livez',
  '/metrics',
  '/openapi.json',
];

function printHelp() {
  console.log(`Usage: node scripts/configure-birdcoder-nginx.mjs [options]

Render or deploy the SDKWork BirdCoder docker test-domain nginx reverse proxy.

Options:
  --domains <list>         Comma-separated test domains (default ${TEST_DOMAINS.join(',')}).
  --upstream <origin>      Gateway host origin (default ${DEFAULT_UPSTREAM}).
  --spa-root <path>        Portal SPA document root (default ${DEFAULT_SPA_ROOT}).
  --server-root <path>     Canonical nginx root (default ${DEFAULT_SERVER_ROOT}).
  --site-family <name>     sites-enabled child directory (default ${DEFAULT_SITE_FAMILY}).
  --client-max-body-size <n>  nginx client_max_body_size (default ${DEFAULT_CLIENT_MAX_BODY_SIZE}).
  --output <path>          Exact local output file path.
  --output-root <path>     Local staging root; writes sites-enabled/<family>/<domains>.conf.
  --platform <os>          Plan as linux, windows, or macos (default current OS).
  --dry-run                Print the plan and rendered config without writing.
  --write                  Write the rendered config to the selected output path.
  --deploy                 Write the config and print nginx validation/reload commands.
  -h, --help               Show this help.

Examples:
  pnpm nginx:plan
  pnpm nginx:render -- --output-root target/nginx
  sudo pnpm nginx:deploy
`);
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv = process.argv.slice(2)) {
  const settings = {
    help: false,
    dryRun: false,
    write: false,
    deploy: false,
    domains: TEST_DOMAINS.join(','),
    upstream: DEFAULT_UPSTREAM,
    spaRoot: DEFAULT_SPA_ROOT,
    serverRoot: DEFAULT_SERVER_ROOT,
    siteFamily: DEFAULT_SITE_FAMILY,
    clientMaxBodySize: DEFAULT_CLIENT_MAX_BODY_SIZE,
    output: null,
    outputRoot: null,
    platform: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    switch (arg) {
      case '--help':
      case '-h':
        settings.help = true;
        break;
      case '--dry-run':
        settings.dryRun = true;
        break;
      case '--write':
        settings.write = true;
        break;
      case '--deploy':
        settings.deploy = true;
        break;
      case '--domains':
        settings.domains = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--upstream':
        settings.upstream = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--spa-root':
        settings.spaRoot = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--server-root':
        settings.serverRoot = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--site-family':
        settings.siteFamily = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--client-max-body-size':
        settings.clientMaxBodySize = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--output':
        settings.output = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--output-root':
        settings.outputRoot = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--platform':
        settings.platform = requireValue(argv, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unsupported nginx configure option: ${arg}`);
    }
  }
  if (settings.dryRun && (settings.write || settings.deploy)) {
    throw new Error('--dry-run cannot be combined with --write or --deploy');
  }
  if (settings.output && settings.outputRoot) {
    throw new Error('--output cannot be combined with --output-root');
  }
  return settings;
}

function normalizePlatform(platform = process.platform) {
  if (platform === 'win32' || platform === 'windows') {
    return 'windows';
  }
  if (platform === 'darwin' || platform === 'mac' || platform === 'macos') {
    return 'macos';
  }
  return 'linux';
}

function normalizeDomains(value) {
  const domains = String(value ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) {
    throw new Error('--domains requires at least one domain');
  }
  const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
  for (const domain of domains) {
    const labels = domain.replace(/\.$/u, '').split('.');
    if (
      domain.length < 4
      || domain.length > 253
      || labels.length < 2
      || labels.some((label) => !labelPattern.test(label))
    ) {
      throw new Error(`domain must be a fully qualified hostname: ${domain}`);
    }
  }
  return domains;
}

function normalizeOrigin(value, flagName = '--upstream') {
  let parsed;
  try {
    parsed = new URL(String(value ?? '').trim());
  } catch {
    throw new Error(`${flagName} must be an HTTP/HTTPS origin`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${flagName} must be an HTTP/HTTPS origin`);
  }
  if ((parsed.pathname && parsed.pathname !== '/') || parsed.search || parsed.hash) {
    throw new Error(`${flagName} must be an origin without path, query, or hash`);
  }
  return parsed.origin;
}

function normalizePosixRoot(value, flagName) {
  const normalized = String(value ?? '').trim().replace(/[\\/]+$/u, '').replaceAll('\\', '/');
  if (!normalized.startsWith('/')) {
    throw new Error(`${flagName} must be an absolute nginx path`);
  }
  if (normalized.includes('/../') || normalized.endsWith('/..')) {
    throw new Error(`${flagName} must not contain parent-directory traversal`);
  }
  return normalized || '/';
}

function normalizeClientMaxBodySize(value) {
  const size = String(value ?? '').trim().toLowerCase();
  if (!/^\d+[kmg]?$/u.test(size)) {
    throw new Error('--client-max-body-size must be an nginx size such as 100m or 1100m');
  }
  return size;
}

function joinPosix(...parts) {
  return path.posix.join(...parts.map((part) => String(part).replaceAll('\\', '/')));
}

function resolveLocalPath(root, value) {
  if (path.isAbsolute(value)) {
    return path.normalize(value);
  }
  return path.resolve(root, value);
}

function createNginxDeploymentPlan(
  settings = parseArgs([]),
  {
    platform = settings.platform ?? process.platform,
    workspaceRoot: root = workspaceRoot,
  } = {},
) {
  const normalizedPlatform = normalizePlatform(settings.platform ?? platform);
  const domains = normalizeDomains(settings.domains);
  const siteFamily = String(settings.siteFamily ?? DEFAULT_SITE_FAMILY).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(siteFamily)) {
    throw new Error('--site-family must be a safe nginx directory name');
  }
  const upstream = normalizeOrigin(settings.upstream ?? DEFAULT_UPSTREAM);
  const spaRoot = normalizePosixRoot(settings.spaRoot ?? DEFAULT_SPA_ROOT, '--spa-root');
  const serverRoot = normalizePosixRoot(settings.serverRoot ?? DEFAULT_SERVER_ROOT, '--server-root');
  const clientMaxBodySize = normalizeClientMaxBodySize(
    settings.clientMaxBodySize ?? DEFAULT_CLIENT_MAX_BODY_SIZE,
  );
  const fileName = 'testapidocker-birdcoder.conf';
  const nginxConfigPath = joinPosix(serverRoot, siteFamily, fileName);
  const localRelativeOutput = path.join('sites-enabled', siteFamily, fileName);
  let outputPath;
  if (settings.output) {
    outputPath = resolveLocalPath(root, settings.output);
  } else if (settings.outputRoot) {
    outputPath = path.join(resolveLocalPath(root, settings.outputRoot), localRelativeOutput);
  } else if (normalizedPlatform === 'linux') {
    outputPath = nginxConfigPath;
  } else {
    outputPath = path.join(root, 'target', 'nginx', localRelativeOutput);
  }
  return {
    platform: normalizedPlatform,
    domains,
    fileName,
    nginxConfigPath,
    outputPath,
    upstream,
    spaRoot,
    serverRoot,
    siteFamily,
    clientMaxBodySize,
    write: Boolean(settings.write),
    deploy: Boolean(settings.deploy),
    dryRun: Boolean(settings.dryRun),
  };
}

function renderProxyHeaders() {
  return [
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    '        proxy_set_header X-Forwarded-Host $host;',
    '        proxy_set_header Upgrade $http_upgrade;',
    '        proxy_set_header Connection "upgrade";',
    '        proxy_buffering off;',
    '        proxy_cache off;',
  ].join('\n');
}

function renderApiLocation(upstream, clientMaxBodySize) {
  return `    # Canonical API/infra prefixes proxied to the gateway container
    # (same list as the vite dev proxy).
    location ~ ^/(${API_PREFIXES.map((prefix) => prefix.replace(/^\//u, '').replace(/\./u, '\\.')).join('|')})(/|$) {
        proxy_pass ${upstream};
${renderProxyHeaders()}
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        client_max_body_size ${clientMaxBodySize};
    }`;
}

function renderSpaLocation(spaRoot) {
  return `    # Portal SPA static delivery (built dist unpacked from the container
    # image by pnpm deploy:apply:standalone) with history-mode fallback.
    root ${spaRoot};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }`;
}

export function renderNginxConfig(plan) {
  const serverNames = plan.domains.join(' ');
  return `# SDKWork BirdCoder docker test domains -> container gateway.
# WSL Ubuntu host nginx. Windows hosts (admin):
#   127.0.0.1 ${serverNames}
# Domain: ${plan.domains.join(', ')}
# Upstream: ${plan.upstream}
# SPA root: ${plan.spaRoot}
# Deploy path: ${plan.nginxConfigPath}

server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};

    access_log /var/log/nginx/${plan.fileName.replace(/\.conf$/u, '')}.access.log;
    error_log /var/log/nginx/${plan.fileName.replace(/\.conf$/u, '')}.error.log;

${renderApiLocation(plan.upstream, plan.clientMaxBodySize)}

${renderSpaLocation(plan.spaRoot)}
}
`;
}

export function renderWindowsHostsEntries(domains = TEST_DOMAINS) {
  return `# SDKWork BirdCoder docker test domains (WSL2 localhost forwarding)
127.0.0.1 ${domains.join(' ')}`;
}

function renderNginxDeploymentPlan(plan) {
  const deployCommand = `sudo pnpm nginx:deploy`;
  return [
    '[birdcoder-nginx] Deployment Plan',
    `[birdcoder-nginx]   Domains: ${plan.domains.join(', ')}`,
    `[birdcoder-nginx]   Canonical nginx path: ${plan.nginxConfigPath}`,
    `[birdcoder-nginx]   Output path: ${plan.outputPath}`,
    `[birdcoder-nginx]   Upstream: ${plan.upstream}`,
    `[birdcoder-nginx]   SPA root: ${plan.spaRoot}`,
    '[birdcoder-nginx] Windows hosts entries (C:\\Windows\\System32\\drivers\\etc\\hosts):',
    `[birdcoder-nginx]   ${renderWindowsHostsEntries(plan.domains)}`,
    '[birdcoder-nginx] Validation and reload:',
    `[birdcoder-nginx]   ${plan.platform === 'linux' ? deployCommand : `pnpm nginx:deploy -- --platform ${plan.platform} --output-root <nginx-conf-root>`}`,
    '[birdcoder-nginx]   sudo nginx -t',
    '[birdcoder-nginx]   sudo systemctl reload nginx',
  ];
}

export function writeNginxConfig(plan) {
  const config = renderNginxConfig(plan);
  mkdirSync(path.dirname(plan.outputPath), { recursive: true });
  writeFileSync(plan.outputPath, config, 'utf8');
  return {
    outputPath: plan.outputPath,
    bytes: Buffer.byteLength(config, 'utf8'),
  };
}

async function main(argv = process.argv.slice(2)) {
  const settings = parseArgs(argv);
  if (settings.help) {
    printHelp();
    return;
  }

  const plan = createNginxDeploymentPlan(settings, {
    platform: settings.platform ?? process.platform,
    workspaceRoot,
  });

  for (const line of renderNginxDeploymentPlan(plan)) {
    console.log(line);
  }

  if (settings.dryRun || (!settings.write && !settings.deploy)) {
    console.log('[birdcoder-nginx] Rendered config preview:');
    console.log(renderNginxConfig(plan));
    return;
  }

  try {
    const result = writeNginxConfig(plan);
    console.log(`[birdcoder-nginx] wrote ${result.bytes} bytes to ${result.outputPath}`);
  } catch (error) {
    if (error && (error.code === 'EACCES' || error.code === 'EPERM')) {
      throw new Error(
        `Cannot write nginx config to ${plan.outputPath}. On Linux rerun with sudo, or render locally with --output-root target/nginx.`,
      );
    }
    throw error;
  }

  if (settings.deploy) {
    console.log('[birdcoder-nginx] Next commands:');
    console.log('sudo nginx -t');
    console.log('sudo systemctl reload nginx');
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  main().catch((error) => {
    console.error(`[birdcoder-nginx] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

export {
  API_PREFIXES,
  DEFAULT_SERVER_ROOT,
  DEFAULT_SITE_FAMILY,
  DEFAULT_SPA_ROOT,
  DEFAULT_UPSTREAM,
  createNginxDeploymentPlan,
  main,
  normalizeDomains,
  normalizePlatform,
  parseArgs,
};
