import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const INTERNAL_SEARCH_EXCLUDED_PREFIXES = [
  'prompts/',
  'release/',
  'step/',
  'superpowers/',
  `${String.fromCodePoint(0x67b6, 0x6784)}/`,
];

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

function createNotFoundDocument() {
  return createHtmlDocument([
    '# Page not found',
    '',
    'The requested SDKWork BirdCoder documentation page could not be found.',
    '',
  ].join('\n'));
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

function normalizeSearchRelativePath(relativePath) {
  return String(relativePath ?? '').replaceAll('\\', '/').replace(/^\.\//u, '');
}

function shouldIndexSearchPage(relativePath) {
  const normalizedPath = normalizeSearchRelativePath(relativePath);
  return !INTERNAL_SEARCH_EXCLUDED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}

function stripMarkdown(markdown) {
  return String(markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSearchTitle(markdown, relativePath) {
  const heading = String(markdown ?? '').split(/\r?\n/u)
    .map((line) => line.match(/^#\s+(.+?)\s*$/u)?.[1]?.trim())
    .find(Boolean);
  if (heading) {
    return heading;
  }

  const normalizedRelativePath = normalizeSearchRelativePath(relativePath);
  const basename = path.posix.basename(normalizedRelativePath, '.md');
  return basename === 'index' ? 'Home' : basename.replaceAll('-', ' ');
}

function resolveSearchUrl(relativePath) {
  const normalizedRelativePath = normalizeSearchRelativePath(relativePath).replace(/\.md$/u, '');
  if (normalizedRelativePath === 'index') {
    return '/';
  }
  if (normalizedRelativePath.endsWith('/index')) {
    return `/${normalizedRelativePath.slice(0, -'/index'.length)}`;
  }

  return `/${normalizedRelativePath}`;
}

function collectMarkdownFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '.vitepress' && entry.name !== 'public') {
          stack.push(absolutePath);
        }
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export function writePublicDocsSearchIndex(docsDir) {
  const outputDir = path.join(docsDir, '.vitepress', 'dist');
  mkdirSync(outputDir, { recursive: true });

  const entries = collectMarkdownFiles(docsDir)
    .map((markdownPath) => {
      const relativePath = normalizeSearchRelativePath(path.relative(docsDir, markdownPath));
      if (!shouldIndexSearchPage(relativePath)) {
        return null;
      }

      const markdown = readFileSync(markdownPath, 'utf8');
      return {
        title: extractSearchTitle(markdown, relativePath),
        url: resolveSearchUrl(relativePath),
        text: stripMarkdown(markdown),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.url.localeCompare(right.url));
  const outputPath = path.join(outputDir, 'search-index.json');
  writeFileSync(outputPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');

  return {
    outputPath,
    entries,
  };
}

export function writePublicDocsNotFoundPage(docsDir) {
  const outputDir = path.join(docsDir, '.vitepress', 'dist');
  mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, '404.html');
  if (!statSync(outputDir).isDirectory()) {
    throw new Error(`Docs output directory is not a directory: ${outputDir}`);
  }
  writeFileSync(outputPath, createNotFoundDocument(), 'utf8');

  return outputPath;
}

export function writePublicDocsReleaseSidecars(docsDir) {
  const searchIndex = writePublicDocsSearchIndex(docsDir);
  const notFoundPath = writePublicDocsNotFoundPage(docsDir);

  return {
    searchIndex,
    notFoundPath,
  };
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

  writePublicDocsReleaseSidecars(docsDir);
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
    if (command === 'build') {
      writePublicDocsReleaseSidecars(docsDir);
    }
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
