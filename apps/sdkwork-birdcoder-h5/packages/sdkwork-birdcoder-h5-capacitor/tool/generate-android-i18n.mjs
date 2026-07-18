import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(
  packageRoot,
  'android',
  'app',
  'src',
  'main',
  'i18n',
  'en-US',
  'application',
  'shell',
  'metadata.json',
);
const output = path.join(packageRoot, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const messages = JSON.parse(fs.readFileSync(source, 'utf8'));
const lines = [
  "<?xml version='1.0' encoding='utf-8'?>",
  '<!-- sdkwork-i18n-generated: android/app/src/main/i18n/en-US/application/shell/metadata.json -->',
  '<resources>',
  ...Object.entries(messages).map(([key, value]) => `    <string name="${escapeXml(key)}">${escapeXml(value)}</string>`),
  '</resources>',
  '',
];
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, lines.join('\n'), 'utf8');
