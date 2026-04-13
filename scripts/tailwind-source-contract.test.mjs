import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';

const rootDir = process.cwd();
const require = createRequire(import.meta.url);
const { Scanner } = require(
  path.join(
    rootDir,
    'node_modules',
    '.pnpm',
    '@tailwindcss+oxide@4.2.2',
    'node_modules',
    '@tailwindcss',
    'oxide',
  ),
);
const entryCssPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-shell',
  'src',
  'styles',
  'index.css',
);
const entryCssDir = path.dirname(entryCssPath);
const entryCss = await fs.readFile(entryCssPath, 'utf8');

function resolveCssImport(id, baseDir) {
  if (id === 'tailwindcss') {
    return require.resolve('tailwindcss/index.css');
  }

  if (id.startsWith('.')) {
    return path.resolve(baseDir || entryCssDir, id);
  }

  return require.resolve(id);
}

function resolveModuleImport(id, baseDir) {
  if (id.startsWith('.')) {
    return path.resolve(baseDir || entryCssDir, id);
  }

  return require.resolve(id);
}

const compiled = await compile(entryCss, {
  from: entryCssPath,
  base: entryCssDir,
  loadStylesheet: async (id, baseDir) => {
    const resolvedPath = resolveCssImport(id, baseDir);
    return {
      path: resolvedPath,
      base: path.dirname(resolvedPath),
      content: await fs.readFile(resolvedPath, 'utf8'),
    };
  },
  loadModule: async (id, baseDir) => {
    const resolvedPath = resolveModuleImport(id, baseDir);
    return {
      path: resolvedPath,
      base: path.dirname(resolvedPath),
      module: require(resolvedPath),
    };
  },
});

assert.ok(
  compiled.sources.length > 0,
  'Tailwind entry stylesheet must declare explicit sources so the web package build can scan root src and workspace packages.',
);

const scanner = new Scanner({ sources: compiled.sources });
const candidates = new Set(scanner.scan());

for (const candidate of ['w-1/3', 'h-screen', 'w-screen', 'grid-cols-2']) {
  assert.ok(
    candidates.has(candidate),
    `Tailwind source scan missed layout candidate "${candidate}".`,
  );
}

console.log(
  `tailwind source contract passed with ${compiled.sources.length} source roots and ${candidates.size} candidates.`,
);
