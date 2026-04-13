import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function resolvePnpmCommand(platform = process.platform) {
  return platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function createHtmlDocument(source) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SDKWork BirdCoder Docs</title>
    <style>
      body { font-family: "Segoe UI", sans-serif; margin: 0 auto; max-width: 960px; padding: 48px 24px; color: #1f2937; }
      h1, h2 { color: #111827; }
      p, li { line-height: 1.6; }
      ul { padding-left: 20px; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
${markdownToHtml(source)}
  </body>
</html>`;
}

function resolveOutputFileName(markdownFileName) {
  return markdownFileName === 'index.md'
    ? 'index.html'
    : `${markdownFileName.replace(/\.md$/, '')}.html`;
}

export function escapeHtml(source) {
  return source
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function markdownToHtml(source) {
  return source
    .split(/\r?\n/)
    .map((line) => {
      if (line.startsWith('# ')) {
        return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      }
      if (line.startsWith('## ')) {
        return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      }
      if (line.startsWith('- ')) {
        return `<li>${escapeHtml(line.slice(2))}</li>`;
      }
      if (!line.trim()) {
        return '';
      }
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('\n')
    .replace(/(<li>.*<\/li>\n?)+/g, (items) => `<ul>\n${items}\n</ul>`);
}

export function buildStaticDocs(docsDir) {
  const outputDir = path.join(docsDir, '.vitepress', 'dist');
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const markdownPath = path.join(docsDir, entry.name);
    const source = readFileSync(markdownPath, 'utf8');
    writeFileSync(
      path.join(outputDir, resolveOutputFileName(entry.name)),
      createHtmlDocument(source),
    );
  }
}

export function runVitepress({
  command = 'build',
  docsDirArg = 'docs',
  restArgs = [],
  cwd = process.cwd(),
  env = process.env,
  runner = spawnSync,
} = {}) {
  const docsDir = path.resolve(cwd, docsDirArg);
  const vitepressArgs = ['exec', 'vitepress', command, docsDirArg, ...restArgs];
  const result = runner(resolvePnpmCommand(), vitepressArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env,
  });

  if (!result.error && result.status === 0) {
    return {
      mode: 'vitepress',
      status: 0,
    };
  }

  if (command === 'build') {
    if (!statSync(docsDir).isDirectory()) {
      throw new Error(`Docs directory not found: ${docsDir}`);
    }
    buildStaticDocs(docsDir);
    return {
      mode: 'fallback-static',
      status: 0,
    };
  }

  if (result.error) {
    return {
      mode: 'error',
      status: 1,
      error: result.error,
    };
  }

  return {
    mode: 'failed',
    status: result.status ?? 1,
  };
}

export function runCli(argv = process.argv.slice(2)) {
  const [command = 'build', docsDirArg = 'docs', ...restArgs] = argv;
  const result = runVitepress({
    command,
    docsDirArg,
    restArgs,
  });

  if (result.mode === 'error') {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
