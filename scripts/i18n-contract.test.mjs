import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { resolveBirdcoderApplicationPackageRoots } from './lib/birdcoder-package-scan-roots.mjs';

const rootDir = process.cwd();

function collectSourceFiles(entryPath, files) {
  if (!fs.existsSync(entryPath)) {
    return;
  }

  const stats = fs.statSync(entryPath);
  if (stats.isDirectory()) {
    for (const entry of fs.readdirSync(entryPath)) {
      if (['node_modules', '.git', 'dist', 'artifacts'].includes(entry)) {
        continue;
      }
      collectSourceFiles(path.join(entryPath, entry), files);
    }
    return;
  }

  if (/\.(ts|tsx)$/.test(entryPath)) {
    files.push(entryPath);
  }
}

const i18nModule = await import(
  pathToFileURL(
    path.join(rootDir, 'apps', 'sdkwork-birdcoder-pc', 'packages', 'sdkwork-birdcoder-pc-i18n', 'src', 'index.ts'),
  ).href
);

assert.equal(
  typeof i18nModule.buildBirdCoderLocaleResources,
  'function',
  'sdkwork-birdcoder-i18n must export buildBirdCoderLocaleResources so runtime resources and validation share the same locale composition path.',
);

assert.equal(
  typeof i18nModule.buildLocaleResource,
  'function',
  'sdkwork-birdcoder-i18n must export buildLocaleResource so duplicate-key conflicts can be enforced in the validation chain.',
);

assert.equal(
  typeof i18nModule.defineLocaleModule,
  'function',
  'sdkwork-birdcoder-i18n must export defineLocaleModule so locale modules can be composed with source-aware conflict reporting.',
);

assert.equal(
  typeof i18nModule.flattenLocaleKeys,
  'function',
  'sdkwork-birdcoder-i18n must export flattenLocaleKeys so locale parity and usage coverage checks operate on the built runtime resources.',
);

const resources = i18nModule.buildBirdCoderLocaleResources();

for (const locale of ['en', 'zh']) {
  assert.equal(
    resources[locale]?.translation?.app?.menu?.file,
    locale === 'en' ? 'File' : '文件',
    `${locale} runtime resources must preserve the merged app.menu.file label.`,
  );
  assert.ok(
    resources[locale]?.translation?.app?.workspace,
    `${locale} runtime resources must preserve the merged app.workspace label.`,
  );
  assert.ok(
    resources[locale]?.translation?.app?.somethingWentWrong,
    `${locale} runtime resources must preserve the merged app.somethingWentWrong label.`,
  );
  assert.ok(
    resources[locale]?.translation?.app?.menu?.newSession,
    `${locale} runtime resources must preserve the merged app.menu.newSession label.`,
  );
}

const translationKeys = Object.fromEntries(
  Object.entries(resources).map(([locale, resource]) => [
    locale,
    new Set(i18nModule.flattenLocaleKeys(resource.translation)),
  ]),
);

const sourceFiles = [];
collectSourceFiles(path.join(rootDir, 'src'), sourceFiles);
for (const packageRoot of resolveBirdcoderApplicationPackageRoots(rootDir)) {
  collectSourceFiles(packageRoot, sourceFiles);
}
collectSourceFiles(path.join(rootDir, 'apps', 'sdkwork-birdcoder-pc', 'src'), sourceFiles);
collectSourceFiles(path.join(rootDir, 'apps', 'sdkwork-birdcoder-h5', 'src'), sourceFiles);

const forbiddenProductUiLiterals = [
  'Validating SDKWork session',
  'Application Error',
  'Search templates',
  'Search files...',
  'Search files by name...',
  'An unexpected error occurred. Please try refreshing the page.',
  'An unexpected error occurred. Please reload the application.',
  'Starting SDKWork BirdCoder',
  'Project folder path is unavailable',
  'Sign in to create a project from a template.',
  'Select a workspace before creating a project from a template.',
  'Project not found',
  'Project folder path is unavailable:',
  'Preview is available once the file has visible content.',
  'Rendering Markdown preview...',
  'Rendering structured data preview...',
  'Rendering config preview...',
  'Rendering table preview...',
  'Rendering code preview...',
  'The Rust debugger host API is not wired yet',
];

for (const filePath of sourceFiles) {
  if (!filePath.includes(`${path.sep}apps${path.sep}sdkwork-birdcoder-pc${path.sep}packages${path.sep}`)) {
    continue;
  }
  if (filePath.includes(`${path.sep}sdkwork-birdcoder-pc-i18n${path.sep}src${path.sep}locales${path.sep}`)) {
    continue;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  for (const literal of forbiddenProductUiLiterals) {
    assert.doesNotMatch(
      source,
      new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
      `${path.relative(rootDir, filePath)} must not hardcode product UI copy: "${literal}"`,
    );
  }
}

const usedTranslationKeys = new Set();
const translationCallPattern = /\b(?:t|i18n\.t)\(\s*['"]([^'"]+)['"]/g;

for (const filePath of sourceFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  let match;
  while ((match = translationCallPattern.exec(source))) {
    usedTranslationKeys.add(match[1]);
  }
}

const missingByLocale = Object.fromEntries(
  Object.entries(translationKeys).map(([locale, keys]) => [
    locale,
    [...usedTranslationKeys].filter((key) => !keys.has(key)).sort(),
  ]),
);

for (const [locale, missingKeys] of Object.entries(missingByLocale)) {
  assert.equal(
    missingKeys.length,
    0,
    `${locale} locale is missing translation keys:\n${missingKeys.join('\n')}`,
  );
}

const enOnlyKeys = [...translationKeys.en].filter((key) => !translationKeys.zh.has(key)).sort();
const zhOnlyKeys = [...translationKeys.zh].filter((key) => !translationKeys.en.has(key)).sort();

assert.deepEqual(
  enOnlyKeys,
  [],
  `en locale contains keys missing from zh:\n${enOnlyKeys.join('\n')}`,
);

assert.deepEqual(
  zhOnlyKeys,
  [],
  `zh locale contains keys missing from en:\n${zhOnlyKeys.join('\n')}`,
);

assert.throws(
  () =>
    i18nModule.buildLocaleResource('contract', [
      i18nModule.defineLocaleModule('contract/a', {
        app: {
          menu: {
            file: 'File',
          },
        },
      }),
      i18nModule.defineLocaleModule('contract/b', {
        app: {
          menu: {
            file: 'Another file label',
          },
        },
      }),
    ]),
  /app\.menu\.file/,
  'duplicate locale keys must throw before they can reach the UI as raw i18n keys.',
);

console.log(
  `i18n contract passed for ${usedTranslationKeys.size} used translation keys across ${Object.keys(resources).length} locales.`,
);
