import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(appRoot, 'lib', 'src', 'i18n');
const outputRoot = path.join(appRoot, 'lib', 'l10n');
const manifestPath = path.join(sourceRoot, 'manifest.json');

const fragments = [
  { prefixes: ['app_', 'nav_'], path: 'platform/shell/bootstrap.arb' },
  { prefixes: ['common_'], path: 'platform/common/actions.arb' },
  { prefixes: ['chat_'], path: 'intelligence/chat/conversation.arb' },
  { prefixes: ['auth_'], path: 'iam/auth/session.arb' },
  { prefixes: ['settings_'], path: 'platform/settings/preferences.arb' },
  { prefixes: ['native_error_'], path: 'platform/native/errors.arb' },
  { prefixes: ['error_'], path: 'platform/runtime/errors.arb' },
];

const locales = [
  { source: 'en-US', outputLocale: 'en', output: 'app_en.arb' },
  { source: 'zh-CN', outputLocale: 'zh', output: 'app_zh.arb' },
  { source: 'zh-TW', outputLocale: 'zh_TW', output: 'app_zh_TW.arb' },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fragmentForKey(key) {
  const messageKey = key.startsWith('@') ? key.slice(1) : key;
  return fragments.find((fragment) => fragment.prefixes.some((prefix) => messageKey.startsWith(prefix)));
}

function bootstrapFragments() {
  for (const locale of locales) {
    const aggregate = readJson(path.join(outputRoot, locale.output));
    const buckets = new Map(fragments.map((fragment) => [fragment.path, { '@@locale': locale.source }]));
    for (const [key, value] of Object.entries(aggregate)) {
      if (key.startsWith('@@')) continue;
      const fragment = fragmentForKey(key);
      if (!fragment) throw new Error(`No i18n fragment owns ${key}`);
      buckets.get(fragment.path)[key] = value;
    }
    for (const fragment of fragments) {
      writeJson(path.join(sourceRoot, locale.source, fragment.path), buckets.get(fragment.path));
    }
  }
}

function generateAggregates() {
  const manifest = {
    schemaVersion: 1,
    generatedMarker: 'sdkwork-i18n-generated',
    outputs: [],
  };

  for (const locale of locales) {
    const aggregate = {
      '@@locale': locale.outputLocale,
      '@@sdkworkGenerated': 'sdkwork-i18n-generated',
      '@@sdkworkSourceManifest': 'lib/src/i18n/manifest.json',
    };
    const sourceFiles = [];
    for (const fragment of fragments) {
      const relativeSource = path.posix.join('lib/src/i18n', locale.source, fragment.path);
      const sourcePath = path.join(appRoot, ...relativeSource.split('/'));
      const source = readJson(sourcePath);
      sourceFiles.push(relativeSource);
      for (const [key, value] of Object.entries(source)) {
        if (key.startsWith('@@')) continue;
        if (Object.hasOwn(aggregate, key)) throw new Error(`Duplicate i18n key ${key}`);
        aggregate[key] = value;
      }
    }
    const outputPath = path.join(outputRoot, locale.output);
    writeJson(outputPath, aggregate);
    manifest.outputs.push({
      file: path.posix.join('lib/l10n', locale.output),
      locale: locale.source,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(outputPath)).digest('hex'),
      sources: sourceFiles,
    });
  }
  writeJson(manifestPath, manifest);
}

if (process.argv.includes('--bootstrap')) bootstrapFragments();
generateAggregates();
